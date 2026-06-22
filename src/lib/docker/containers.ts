import type Docker from "dockerode"

import { env } from "#/env"
import { formatImageTag } from "#/lib/docker/images"

import { dockerClient } from "./client"
import { findComposePath } from "./stacks"
import type { StackStatus } from "./stacks"

export type ContainerInfo = {
  id: string
  serviceName: string | null
  name: string
  image: string
  stack: string | null
  status: StackStatus
  uptime: string
  ports: {
    hostPort: number
    containerPort: number
    protocol: string
    hostName: string
  }[]
}

const containerStateToStatus = (state: string, statusStr: string): StackStatus => {
  switch (state) {
    case "running":
      if (statusStr.includes("(healthy)")) return "healthy"
      if (statusStr.includes("(unhealthy)")) return "unhealthy"
      if (statusStr.includes("(health: starting)")) return "starting"
      return "running"
    case "restarting":
      return "partial"
    case "exited":
    case "paused":
      return "stopped"
    case "dead":
    case "created":
    case "removing":
      return "down"
    default:
      return "unknown"
  }
}

const mapContainer = (c: Docker.ContainerInfo): ContainerInfo => ({
  id: c.Id.slice(0, 12),
  serviceName: c.Labels["com.docker.compose.service"] ?? null,
  name: c.Names[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12),
  image: formatImageTag(c.Image),
  stack: c.Labels["com.docker.compose.project"] ?? null,
  status: containerStateToStatus(c.State, c.Status),
  uptime: c.Status.replace(/\s*\(.*?\)/, "").trim(),
  ports: c.Ports.filter((p) => p.PublicPort)
    .map((p) => ({
      hostPort: p.PublicPort,
      containerPort: p.PrivatePort,
      protocol: p.Type,
      hostName: env.SERVER_HOST,
    }))
    .filter(
      (p, i, a) =>
        a.findIndex((p2) => p.hostPort === p2.hostPort && p.protocol === p2.protocol) === i,
    ),
})

export const getStackContainers = async (stackName: string): Promise<ContainerInfo[]> => {
  const containers = await dockerClient.listContainers({
    all: true,
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
    }),
  })

  const mapped = containers.map(mapContainer)
  const knownServices = new Set(
    containers.map((c) => c.Labels["com.docker.compose.service"]).filter(Boolean),
  )

  try {
    const composePath = await findComposePath(stackName)
    const compose = (await Bun.YAML.parse(await Bun.file(composePath).text())) as {
      services?: Record<
        string,
        {
          image?: string
          build?: unknown
        }
      >
    }

    for (const [serviceName, svc] of Object.entries(compose.services ?? {})) {
      if (knownServices.has(serviceName)) continue

      mapped.push({
        id: serviceName,
        serviceName,
        name: "-",
        image: svc.image ? formatImageTag(svc.image) : "-",
        stack: stackName,
        status: "missing",
        uptime: "-",
        ports: [],
      })
    }
  } catch {}

  return mapped.sort((a, b) => (a.serviceName ?? a.name).localeCompare(b.serviceName ?? b.name))
}

export const listAllContainers = async (): Promise<ContainerInfo[]> => {
  return (await dockerClient.listContainers({ all: true }))
    .map(mapContainer)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const containerStart = (id: string) => dockerClient.getContainer(id).start()
export const containerStop = (id: string) => dockerClient.getContainer(id).stop()
export const containerRestart = (id: string) => dockerClient.getContainer(id).restart()
export const containerRemove = (id: string) => dockerClient.getContainer(id).remove({ force: true })

export const containerPrune = () => dockerClient.pruneContainers({})
