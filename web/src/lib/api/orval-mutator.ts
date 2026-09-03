export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type ErrorType<_T = unknown> = ApiError

const API_BASE = ""

export const orvalInstance = async <T>(
  url: string,
  config?: RequestInit & { params?: Record<string, string | number | undefined> },
): Promise<T> => {
  const { params, ...init } = config ?? {}
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) searchParams.set(key, String(value))
  }
  const query = searchParams.toString()
  const path = `${API_BASE}${url}${query ? `?${query}` : ""}`

  const headers = new Headers(init.headers)
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const res = await fetch(path, { credentials: "same-origin", headers, ...init })
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

export default orvalInstance
