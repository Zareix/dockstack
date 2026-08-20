const API_BASE = ""

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    headers,
    ...init,
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" })
}

export function post<T = { success: boolean }>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function put<T = { success: boolean }>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function del<T = { success: boolean }>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" })
}

export type StackStatus =
  | "running"
  | "healthy"
  | "unhealthy"
  | "starting"
  | "restarting"
  | "partial"
  | "stopped"
  | "down"
  | "unknown"
  | "missing"

export type Stack = {
  name: string
  status: StackStatus
}

export type Port = {
  hostPort: number
  containerPort: number
  protocol: string
  hostName: string
}

export type ContainerInfo = {
  id: string
  serviceName: string | null
  name: string
  image: string
  stack: string | null
  status: string
  uptime: string
  ports: Port[]
  urls: string[]
}

export type ImageInfo = {
  id: string
  tags: string[]
  repoDigests: string[]
  size: number
  created: number
}

export type VolumeInfo = {
  name: string
  driver: string
  created: string
  size: number
  inUse: boolean
  status: "in-use" | "unused"
}

export type NetworkInfo = {
  id: string
  name: string
  driver: string
  scope: string
  status: "system" | "in-use" | "unused"
}

export type StackFiles = {
  compose: string
  composeFile: string
  env: string | null
}

export type PruneResult = {
  deleted: string[]
  spaceReclaimed: number
}

export type StaleStatus = "outdated" | "up-to-date" | "unknown"

export type LogEntry = {
  containerName: string
  message: string
  stream: "stdout" | "stderr"
  timestamp: string
}

export type Settings = {
  appTitle: string
  instanceName: string
  instances: { title: string; url: string; isCurrent: boolean }[]
}

// --- settings ---

export const getSettings = () => get<Settings>("/api/settings")

export const getSocialProviders = () => get<string[]>("/api/auth/providers")

// --- stacks ---

export const listStacks = () => get<Stack[]>("/api/stacks")

export const stackExists = (stackName: string) =>
  get<Stack>("/api/stacks/" + encodeURIComponent(stackName)).then(
    () => true,
    () => false,
  )

export const getStackStatus = (stackName: string) =>
  get<{ name: string; status: StackStatus }>("/api/stacks/" + encodeURIComponent(stackName)).then(
    (r) => r.status,
  )

export const getStackContainers = (stackName: string) =>
  get<ContainerInfo[]>("/api/stacks/" + encodeURIComponent(stackName) + "/containers")

export const getStackFiles = (stackName: string) =>
  get<StackFiles>("/api/stacks/" + encodeURIComponent(stackName) + "/files")

export const saveStackFiles = (
  stackName: string,
  data: { composeFile: string; compose: string; env: string | null },
) => put("/api/stacks/" + encodeURIComponent(stackName) + "/files", data)

export const createStack = (stackName: string) => post("/api/stacks", { name: stackName })

export const createDotEnv = (stackName: string) =>
  post("/api/stacks/" + encodeURIComponent(stackName) + "/env")

export const stackAction = (
  stackName: string,
  action: "up" | "stop" | "down" | "restart" | "pull",
) => post("/api/stacks/" + encodeURIComponent(stackName) + "/" + action)

export const stackUp = (stackName: string) => stackAction(stackName, "up")
export const stackStop = (stackName: string) => stackAction(stackName, "stop")
export const stackDown = (stackName: string) => stackAction(stackName, "down")
export const stackRestart = (stackName: string) => stackAction(stackName, "restart")
export const stackPull = (stackName: string) => stackAction(stackName, "pull")

export const stackDestroy = (stackName: string) =>
  del("/api/stacks/" + encodeURIComponent(stackName))

// --- containers ---

export const listAllContainers = () => get<ContainerInfo[]>("/api/containers")

export const containerStart = (id: string) => post(`/api/containers/${id}/start`)
export const containerStop = (id: string) => post(`/api/containers/${id}/stop`)
export const containerRestart = (id: string) => post(`/api/containers/${id}/restart`)
export const containerRemove = (id: string) => del(`/api/containers/${id}`)
export const containerPrune = () => post<PruneResult>("/api/containers/prune")

// --- images ---

export const listImages = () => get<ImageInfo[]>("/api/images")
export const imageRemove = (id: string) => del(`/api/images/${encodeURIComponent(id)}`)
export const imagePrune = () => post<PruneResult>("/api/images/prune")
export const checkImagesStale = () => get<Record<string, StaleStatus>>("/api/images/stale")

// --- volumes ---

export const listVolumes = () => get<VolumeInfo[]>("/api/volumes")
export const volumeRemove = (name: string) => del(`/api/volumes/${encodeURIComponent(name)}`)
export const volumePrune = () => post<PruneResult>("/api/volumes/prune")

// --- networks ---

export const listNetworks = () => get<NetworkInfo[]>("/api/networks")
