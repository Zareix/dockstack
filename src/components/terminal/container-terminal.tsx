import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

type Props = {
  containerId: string
  shell?: string
}

export function ContainerTerminal({ containerId, shell = '/bin/sh' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
      theme: {
        background: '#09090b',
        foreground: '#e4e4e7',
        cursor: '#a1a1aa',
        black: '#18181b',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e4e4e7',
        brightBlack: '#3f3f46',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#f4f4f5',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current)

    // Defer fit so browser has finished laying out the container
    const rafId = requestAnimationFrame(() => fitAddon.fit())

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/exec`)

    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'init',
          containerId,
          shell,
          cols: term.cols,
          rows: term.rows,
        }),
      )
    }

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data))
      } else {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: 'exit' | 'error' | (string & {})
            message?: string
          }
          if (msg.type === 'exit') {
            term.writeln(
              '\r\n\x1b[90m[process exited — shell not found or container stopped]\x1b[0m',
            )
          } else if (msg.type === 'error') {
            term.writeln(`\r\n\x1b[31m[error] ${msg.message}\x1b[0m`)
          }
        } catch {
          term.write(event.data as string)
        }
      }
    }

    ws.onclose = () => {
      term.writeln('\r\n\x1b[90m[connection closed]\x1b[0m')
    }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m[websocket error]\x1b[0m')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    const ro = new ResizeObserver(() => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }),
        )
      }
    })
    ro.observe(containerRef.current)

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      ws.close()
      term.dispose()
    }
  }, [containerId, shell])

  return (
    <div
      ref={containerRef}
      className="h-full w-full rounded-md overflow-hidden p-1"
      style={{ background: '#09090b' }}
    />
  )
}
