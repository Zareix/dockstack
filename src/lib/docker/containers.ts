import { env } from '#/env'
import { dockerClient } from './client'
import type { StackStatus } from './stacks'
import type Docker from 'dockerode'

export type ContainerInfo = {
  id: string
  name: string
  image: string
  stack: string | null
  state: StackStatus
  status: string
  ports: {
    hostPort: number
    containerPort: number
    protocol: string
    hostName: string
  }[]
}

const containerStateToStatus = (state: string): StackStatus => {
  switch (state) {
    case 'running': return 'running'
    case 'restarting': return 'partial'
    case 'exited':
    case 'paused': return 'stopped'
    case 'dead':
    case 'created':
    case 'removing': return 'down'
    default: return 'unknown'
  }
}

const mapContainer = (c: Docker.ContainerInfo): ContainerInfo => ({
  id: c.Id.slice(0, 12),
  name: c.Names[0]?.replace(/^\//, '') ?? c.Id.slice(0, 12),
  image: c.Image,
  stack: c.Labels['com.docker.compose.project'] ?? null,
  state: containerStateToStatus(c.State),
  status: c.Status,
  ports: c.Ports.filter((p) => p.PublicPort)
    .map((p) => ({
      hostPort: p.PublicPort,
      containerPort: p.PrivatePort,
      protocol: p.Type,
      hostName: env.SERVER_HOST,
    }))
    .filter(
      (p, i, a) =>
        a.findIndex(
          (p2) => p.hostPort === p2.hostPort && p.protocol === p2.protocol,
        ) === i,
    ),
})

export const getStackContainers = async (stackName: string): Promise<ContainerInfo[]> => {
  const containers = await dockerClient.listContainers({
    all: true,
    filters: JSON.stringify({ label: [`com.docker.compose.project=${stackName}`] }),
  })
  return containers.map(mapContainer).sort((a, b) => a.name.localeCompare(b.name))
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
