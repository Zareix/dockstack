import Docker from 'dockerode'

const dockerClient = new Docker({ socketPath: '/var/run/docker.sock' })

export type StackStatus = 'running' | 'partial' | 'stopped' | 'unknown'

export const streamContainerLogs = async (containerId: string) => {
  const container = dockerClient.getContainer(containerId)
  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
  })
  return stream
}

export const streamStackLogs = async function* (stackName: string) {
  const containers = await dockerClient.listContainers({
    filters: JSON.stringify({ label: [`com.docker.compose.project=${stackName}`] }),
  })

  const streams = await Promise.all(
    containers.map(async (info) => {
      const name = info.Names[0]?.replace(/^\//, '') ?? info.Id.slice(0, 12)
      const stream = await dockerClient.getContainer(info.Id).logs({
        follow: true,
        stdout: true,
        stderr: true,
      })
      return { name, stream }
    })
  )

  async function* labeledStream(name: string, stream: NodeJS.ReadableStream) {
    for await (const chunk of stream) {
      yield `[${name}] ${chunk.toString()}`
    }
  }

  // Merge all streams via async iteration round-robin using a shared queue
  const queue: string[] = []
  let done = 0
  let resolve: (() => void) | null = null

  const push = (line: string) => {
    queue.push(line)
    resolve?.()
  }

  for (const { name, stream } of streams) {
    ;(async () => {
      for await (const line of labeledStream(name, stream)) {
        push(line)
      }
      done++
      resolve?.()
    })()
  }

  while (done < streams.length || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((r) => (resolve = r))
      resolve = null
    }
    while (queue.length > 0) {
      yield queue.shift()!
    }
  }
}

export const getStackStatus = async (stackName: string): Promise<StackStatus> => {
  const containers = await dockerClient.listContainers({
    all: true,
    filters: JSON.stringify({ label: [`com.docker.compose.project=${stackName}`] }),
  })

  if (containers.length === 0) return 'unknown'

  const running = containers.filter((c) => c.State === 'running').length

  if (running === containers.length) return 'running'
  if (running === 0) return 'stopped'
  return 'partial'
}
