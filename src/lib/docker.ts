import { env } from '#/env'
import Docker from 'dockerode'
import { join } from 'node:path'

const COMPOSE_FILENAMES = [
  'compose.yaml',
  'compose.yml',
  'docker-compose.yml',
  'docker-compose.yaml',
]

const dockerClient = new Docker({ socketPath: '/var/run/docker.sock' })

export type StackStatus = 'running' | 'partial' | 'stopped' | 'down' | 'unknown'

export type LogEntry = {
  containerName: string
  message: string
  stream: 'stdout' | 'stderr'
  timestamp: string
}

export const streamStackLogs = async function* (stackName: string) {
  const containers = await dockerClient.listContainers({
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
    }),
  })

  const queue: LogEntry[] = []
  let done = 0
  let notify: (() => void) | null = null

  const finish = () => {
    done++
    const fn = notify
    if (fn) fn()
  }

  const decoder = new TextDecoder()

  const processStream = async (
    stream: ReadableStream<Uint8Array>,
    containerName: string,
    streamType: 'stdout' | 'stderr',
  ) => {
    const reader = stream.getReader()
    let buf = ''
    try {
      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() ?? ''
        for (const line of parts) {
          if (!line) continue
          const spaceIdx = line.indexOf(' ')
          const timestamp = spaceIdx > -1 ? line.slice(0, spaceIdx) : ''
          const message = spaceIdx > -1 ? line.slice(spaceIdx + 1) : line
          queue.push({ containerName, message, stream: streamType, timestamp })
          const fn = notify
          if (fn) fn()
        }
      }
      if (buf) {
        queue.push({
          containerName,
          message: buf,
          stream: streamType,
          timestamp: '',
        })
        const fn = notify
        if (fn) fn()
      }
    } finally {
      reader.releaseLock()
    }
  }

  for (const info of containers) {
    const containerName =
      info.Names[0]?.replace(/^\//, '') ?? info.Id.slice(0, 12)
    ;(async () => {
      try {
        const proc = Bun.spawn(
          [
            'docker',
            'logs',
            '--follow',
            '--timestamps',
            '--tail',
            '1000',
            info.Id,
          ],
          { stdout: 'pipe', stderr: 'pipe' },
        )
        await Promise.all([
          processStream(proc.stdout, containerName, 'stdout'),
          processStream(proc.stderr, containerName, 'stderr'),
        ])
      } catch {
        // container may have stopped or been removed
      } finally {
        finish()
      }
    })()
  }

  while (done < containers.length || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((r) => (notify = r))
      notify = null
    }
    while (queue.length > 0) yield queue.shift()!
  }
}

export const findComposePath = async (stackName: string): Promise<string> => {
  const dir = join(env.STACKS_DIR, stackName)
  for (const f of COMPOSE_FILENAMES) {
    const path = join(dir, f)
    if (await Bun.file(path).exists()) {
      return path
    }
  }
  throw new Error(`No compose file found in ${stackName}`)
}

export const stackUp = async (stackName: string) => {
  const composePath = await findComposePath(stackName)
  await Bun.$`docker compose -f ${composePath} up -d --remove-orphans`
}

export const stackDown = async (stackName: string) => {
  const composePath = await findComposePath(stackName)
  await Bun.$`docker compose -f ${composePath} down`
}

export const stackRestart = async (stackName: string) => {
  const composePath = await findComposePath(stackName)
  await Bun.$`docker compose -f ${composePath} restart`
}

export const stackPull = async (stackName: string) => {
  const composePath = await findComposePath(stackName)
  await Bun.$`docker compose -f ${composePath} pull`
}

export type ContainerInfo = {
  id: string
  name: string
  state: string
  status: string
  ports: {
    hostPort: number
    containerPort: number
    protocol: string
    hostName: string
  }[]
}

export const getStackContainers = async (
  stackName: string,
): Promise<ContainerInfo[]> => {
  const containers = await dockerClient.listContainers({
    all: true,
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
    }),
  })

  return containers
    .map((c) => ({
      id: c.Id.slice(0, 12),
      name: c.Names[0]?.replace(/^\//, '') ?? c.Id.slice(0, 12),
      state: c.State,
      status: c.Status,
      ports: c.Ports.filter((p) => p.PublicPort)
        .map((p) => ({
          hostPort: p.PublicPort!,
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
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const containerStart = (id: string) =>
  dockerClient.getContainer(id).start()

export const containerStop = (id: string) =>
  dockerClient.getContainer(id).stop()

export const containerRestart = (id: string) =>
  dockerClient.getContainer(id).restart()

export const containerRemove = (id: string) =>
  dockerClient.getContainer(id).remove({ force: true })

export const getStackStatus = async (
  stackName: string,
): Promise<StackStatus> => {
  const containers = await dockerClient.listContainers({
    all: true,
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
    }),
  })

  if (containers.length === 0) return 'down'

  const running = containers.filter((c) => c.State === 'running').length

  if (running === containers.length) return 'running'
  if (running === 0) return 'stopped'
  return 'partial'
}
