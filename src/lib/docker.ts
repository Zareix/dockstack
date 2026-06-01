import Docker from 'dockerode'
import { PassThrough } from 'node:stream'

const dockerClient = new Docker({ socketPath: '/var/run/docker.sock' })

export type StackStatus = 'running' | 'partial' | 'stopped' | 'unknown'

export const streamStackLogs = async function* (stackName: string) {
  const containers = await dockerClient.listContainers({
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
    }),
  })

  const queue: string[] = []
  let done = 0
  let notify: (() => void) | null = null

  const finish = () => {
    done++
    const fn = notify
    if (fn) fn()
  }

  for (const info of containers) {
    const name = info.Names[0]?.replace(/^\//, '') ?? info.Id.slice(0, 12)
    ;(async () => {
      try {
        const stream = await dockerClient.getContainer(info.Id).logs({
          follow: true,
          stdout: true,
          stderr: true,
          tail: 1000,
        })

        const output = new PassThrough()
        dockerClient.modem.demuxStream(stream, output, output)
        stream.on('error', (err) => output.destroy(err))

        let buf = ''
        output.on('data', (chunk: Buffer) => {
          buf += chunk.toString('utf8')
          const parts = buf.split('\n')
          buf = parts.pop() ?? ''
          for (const line of parts) {
            if (line) {
              queue.push(`[${name}] ${line}`)
              const fn = notify
              if (fn) fn()
            }
          }
        })

        await new Promise<void>((resolve) => {
          output.on('end', resolve)
          output.on('error', resolve)
        })

        if (buf) queue.push(`[${name}] ${buf}`)
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

export const getStackStatus = async (
  stackName: string,
): Promise<StackStatus> => {
  const containers = await dockerClient.listContainers({
    all: true,
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
    }),
  })

  if (containers.length === 0) return 'unknown'

  const running = containers.filter((c) => c.State === 'running').length

  if (running === containers.length) return 'running'
  if (running === 0) return 'stopped'
  return 'partial'
}
