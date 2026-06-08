import { createFileRoute } from '@tanstack/react-router'
import { defineHooks } from 'crossws'
import { dockerClient } from '#/lib/docker/client'

export type LogEntry = {
  containerName: string
  message: string
  stream: 'stdout' | 'stderr'
  timestamp: string
}

type LogSession = {
  processes: ReturnType<typeof Bun.spawn>[]
}

const sessions = new Map<string, LogSession>()

const decoder = new TextDecoder()

function processStream(
  stream: ReadableStream<Uint8Array>,
  containerName: string,
  streamType: 'stdout' | 'stderr',
  send: (data: string) => void,
): Promise<void> {
  const reader = stream.getReader()
  let buf = ''
  return (async () => {
    try {
      // eslint-disable-next-line
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() ?? ''
        for (const line of parts) {
          if (!line) continue
          const spaceIdx = line.indexOf(' ')
          const timestamp = spaceIdx > -1 ? line.slice(0, spaceIdx) : ''
          const message = spaceIdx > -1 ? line.slice(spaceIdx + 1) : line
          const entry: LogEntry = {
            containerName,
            message,
            stream: streamType,
            timestamp,
          }
          send(JSON.stringify({ type: 'log', ...entry }))
        }
      }
      if (buf) {
        send(
          JSON.stringify({
            type: 'log',
            containerName,
            message: buf,
            stream: streamType,
            timestamp: '',
          }),
        )
      }
    } finally {
      reader.releaseLock()
    }
  })()
}

const hooks = defineHooks({
  async message(peer, message) {
    try {
      const msg = message.json<
        { type: 'init'; stackName: string } | { type: 'close' }
      >()

      if (msg.type === 'init') {
        const existing = sessions.get(peer.id)
        if (existing) {
          for (const p of existing.processes) p.kill()
          sessions.delete(peer.id)
        }

        try {
          const containers = await dockerClient.listContainers({
            filters: JSON.stringify({
              label: [`com.docker.compose.project=${msg.stackName}`],
            }),
          })

          if (containers.length === 0) {
            peer.send(JSON.stringify({ type: 'end' }))
            return
          }

          const processes: ReturnType<typeof Bun.spawn>[] = []
          sessions.set(peer.id, { processes })

          let finished = 0
          const total = containers.length * 2

          const checkDone = () => {
            finished++
            if (finished >= total) {
              peer.send(JSON.stringify({ type: 'end' }))
              sessions.delete(peer.id)
            }
          }

          for (const info of containers) {
            const containerName =
              info.Names[0]?.replace(/^\//, '') ?? info.Id.slice(0, 12)
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
            processes.push(proc)

            processStream(proc.stdout, containerName, 'stdout', (data) =>
              peer.send(data),
            ).finally(checkDone)

            processStream(proc.stderr, containerName, 'stderr', (data) =>
              peer.send(data),
            ).finally(checkDone)
          }
        } catch (err) {
          peer.send(JSON.stringify({ type: 'error', message: String(err) }))
        }
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (msg.type === 'close') {
        const session = sessions.get(peer.id)
        if (session) {
          for (const p of session.processes) p.kill()
          sessions.delete(peer.id)
        }
        return
      }
    } catch {
      // not JSON
    }
  },

  close(peer) {
    const session = sessions.get(peer.id)
    if (session) {
      for (const p of session.processes) p.kill()
      sessions.delete(peer.id)
    }
  },
})

export const Route = createFileRoute('/api/ws/logs')({
  server: {
    handlers: {
      GET: async () => {
        return Object.assign(
          new Response('WebSocket upgrade is required.', { status: 426 }),
          { crossws: hooks },
        )
      },
    },
  },
})
