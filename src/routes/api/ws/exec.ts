import net from 'node:net'
import { createFileRoute } from '@tanstack/react-router'
import { defineHooks } from 'crossws'
import type Docker from 'dockerode'
import { dockerClient } from '#/lib/docker/client'

type ExecSession = {
  socket: net.Socket
  exec: Docker.Exec
}

const sessions = new Map<string, ExecSession>()

function startExecHijack(
  execId: string,
): Promise<{ socket: net.Socket; remaining: Buffer }> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection('/var/run/docker.sock')
    const body = JSON.stringify({ Detach: false, Tty: true })
    const request = [
      `POST /exec/${execId}/start HTTP/1.1`,
      'Host: localhost',
      `Content-Length: ${Buffer.byteLength(body)}`,
      'Content-Type: application/json',
      'Upgrade: tcp',
      'Connection: Upgrade',
      '',
      body,
    ].join('\r\n')

    let headerBuf = Buffer.alloc(0)
    let upgraded = false

    const onData = (chunk: Buffer) => {
      if (upgraded) return
      headerBuf = Buffer.concat([headerBuf, chunk])
      const idx = headerBuf.indexOf('\r\n\r\n')
      if (idx !== -1) {
        upgraded = true
        socket.removeListener('data', onData)
        const statusLine = headerBuf.slice(0, idx).toString().split('\r\n')[0]
        if (statusLine.includes('101') || statusLine.includes('200')) {
          resolve({ socket, remaining: headerBuf.slice(idx + 4) })
        } else {
          reject(new Error(`exec start failed: ${statusLine}`))
          socket.destroy()
        }
      }
    }

    socket.on('data', onData)
    socket.on('error', reject)
    socket.once('connect', () => socket.write(request))
  })
}

const hooks = defineHooks({
  async message(peer, message) {
    const raw = message.rawData

    // Binary messages → raw terminal input
    if (
      raw instanceof Uint8Array ||
      raw instanceof ArrayBuffer ||
      Buffer.isBuffer(raw)
    ) {
      const session = sessions.get(peer.id)
      if (session)
        session.socket.write(
          Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer),
        )
      return
    }

    try {
      const msg = message.json()

      if (msg.type === 'init') {
        const containerId = msg.containerId as string
        const cols = (msg.cols as number) ?? 80
        const rows = (msg.rows as number) ?? 24
        const shell = (msg.shell as string) ?? '/bin/sh'

        try {
          const container = dockerClient.getContainer(containerId)
          const exec = await container.exec({
            Cmd: [shell],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Env: [`TERM=xterm-256color`, `COLUMNS=${cols}`, `LINES=${rows}`],
          })

          const { socket, remaining } = await startExecHijack(exec.id)

          try {
            await exec.resize({ h: rows, w: cols })
          } catch {
            // process may have already exited (shell not found)
          }

          sessions.set(peer.id, { socket, exec })

          if (remaining.length > 0) peer.send(remaining)

          socket.on('data', (chunk: Buffer) => peer.send(chunk))

          socket.on('end', () => {
            peer.send(JSON.stringify({ type: 'exit' }))
            sessions.delete(peer.id)
          })

          socket.on('error', (err: Error) => {
            peer.send(JSON.stringify({ type: 'error', message: err.message }))
            sessions.delete(peer.id)
          })
        } catch (err) {
          peer.send(JSON.stringify({ type: 'error', message: String(err) }))
        }

        return
      }

      if (msg.type === 'resize') {
        const session = sessions.get(peer.id)
        if (session) {
          await session.exec.resize({
            h: msg.rows as number,
            w: msg.cols as number,
          })
        }
        return
      }
    } catch {
      // Not JSON — raw terminal input
      const session = sessions.get(peer.id)
      if (session) session.socket.write(message.text())
      return
    }
  },

  close(peer) {
    const session = sessions.get(peer.id)
    if (session) {
      session.socket.destroy()
      sessions.delete(peer.id)
    }
  },
})

export const Route = createFileRoute('/api/ws/exec')({
  server: {
    handlers: {
      GET: async () => {
        return Object.assign(
          new Response('WebSocket upgrade is required.', {
            status: 426,
          }),
          {
            crossws: hooks,
          },
        )
      },
    },
  },
})
