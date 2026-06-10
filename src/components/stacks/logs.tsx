import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ChevronRight,
  ListEnd,
  PlayCircleIcon,
  StopCircleIcon,
} from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { LogEntry } from '#/routes/api/ws/logs'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { cn } from '#/lib/utils'

type ParsedLog =
  | { kind: 'text'; text: string }
  | {
      kind: 'json'
      text: string
      level: string | null
      fields: Record<string, unknown>
    }

const LEVEL_COLORS: Record<string, string> = {
  trace: 'text-zinc-500',
  debug: 'text-zinc-400',
  info: 'text-green-400',
  warn: 'text-yellow-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  fatal: 'text-red-600',
}

function parseJsonLog(raw: string): ParsedLog {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      return { kind: 'text', text: raw }

    const obj = parsed as Record<string, unknown>
    const text = obj.msg ?? obj.message ?? obj.log ?? obj.text
    if (typeof text !== 'string') return { kind: 'text', text: raw }

    const level = typeof obj.level === 'string' ? obj.level.toLowerCase() : null

    const {
      msg: _a,
      message: _b,
      log: _c,
      text: _d,
      level: _e,
      ...fields
    } = obj
    return { kind: 'json', text, level, fields }
  } catch {
    return { kind: 'text', text: raw }
  }
}

function FieldValue({ value }: { value: unknown }) {
  switch (typeof value) {
    case 'string':
      return <span className="text-green-400">"{value}"</span>
    case 'boolean':
      return <span className="text-purple-400">{String(value)}</span>
    case 'number':
      return <span className="text-yellow-400">{String(value)}</span>
    default:
      return <span className="text-zinc-300">{JSON.stringify(value)}</span>
  }
}

export function ContainerLogs({ stackName }: { stackName: string }) {
  const [streaming, setStreaming] = useState(false)
  const [lines, setLines] = useState<LogEntry[]>([])
  const [showTimestamp, setShowTimestamp] = useState(false)
  const [didInitialScroll, setDidInitialScroll] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const parentRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) =>
      lines[index].timestamp + lines[index].containerName + index,
    estimateSize: () => 20,
    overscan: 50,
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: 50,
  })

  const startStreaming = useCallback(() => {
    setStreaming(true)
    setLines([])
    setExpanded(new Set())

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/logs`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'init', stackName }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as
          | ({ type: 'log' } & LogEntry)
          | { type: 'end' }
          | { type: 'error'; message: string }

        if (msg.type === 'log') {
          const { type: _, ...entry } = msg
          setLines((prev) =>
            [...prev, entry].sort((a, b) =>
              a.timestamp.localeCompare(b.timestamp),
            ),
          )
          // oxlint-disable-next-line typescript/no-unnecessary-condition
        } else if (msg.type === 'end' || msg.type === 'error') {
          setStreaming(false)
          wsRef.current = null
        }
      } catch {}
    }

    ws.onclose = () => {
      setStreaming(false)
      wsRef.current = null
    }

    ws.onerror = () => {
      setStreaming(false)
      wsRef.current = null
    }
  }, [stackName])

  const stopStreaming = useCallback(() => {
    const ws = wsRef.current
    if (ws) {
      ws.send(JSON.stringify({ type: 'close' }))
      ws.close()
      wsRef.current = null
    }
    setStreaming(false)
  }, [])

  useLayoutEffect(() => {
    if (didInitialScroll) return
    virtualizer.scrollToEnd()
    setDidInitialScroll(true)
  }, [didInitialScroll, virtualizer])

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <Button onClick={streaming ? stopStreaming : startStreaming} size="sm">
          {streaming ? (
            <>
              <StopCircleIcon /> Streaming...
            </>
          ) : (
            <>
              <PlayCircleIcon /> Start
            </>
          )}
        </Button>
        <div className="flex items-center space-x-2">
          <Switch
            id="timestamp"
            checked={showTimestamp}
            onCheckedChange={setShowTimestamp}
          />
          <Label htmlFor="timestamp">Timestamps</Label>
        </div>
        <Button
          onClick={() => virtualizer.scrollToEnd()}
          variant="outline"
          className="ml-auto"
        >
          <ListEnd />
          Go to bottom
        </Button>
      </div>
      <div
        ref={parentRef}
        className="h-[60vh] md:h-[68vh] overflow-auto bg-card text-card-foreground rounded-md text-xs leading-5 font-mono px-2"
      >
        <div
          className="w-full relative"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const entry = lines[item.index]
            const date = new Date(entry.timestamp)
            const itemKey = String(item.key)
            const isExpanded = expanded.has(itemKey)
            const parsed = parseJsonLog(entry.message)

            const toggle = () => {
              if (parsed.kind !== 'json') return
              setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(itemKey)) next.delete(itemKey)
                else next.add(itemKey)
                return next
              })
            }

            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                style={{ transform: `translateY(${item.start}px)` }}
                className="absolute w-full top-0 left-0"
              >
                <div
                  onClick={toggle}
                  className={cn(
                    'flex gap-2 whitespace-pre',
                    parsed.kind === 'json' &&
                      'cursor-pointer hover:bg-muted/40 rounded px-0.5',
                  )}
                >
                  {parsed.kind === 'json' && (
                    <ChevronRight
                      className={cn(
                        'shrink-0 mt-0.5 size-3 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-90',
                      )}
                    />
                  )}
                  {showTimestamp && (
                    <span className="text-muted-foreground shrink-0">
                      {date.toLocaleDateString()} {date.toLocaleTimeString()}
                    </span>
                  )}
                  <span className="text-blue-400 shrink-0">
                    [{entry.containerName}]
                  </span>
                  {parsed.kind === 'json' && parsed.level && (
                    <span
                      className={cn(
                        'shrink-0',
                        LEVEL_COLORS[parsed.level] ?? 'text-zinc-400',
                      )}
                    >
                      {parsed.level.toUpperCase()}
                    </span>
                  )}
                  <span
                    className={entry.stream === 'stderr' ? 'text-red-400' : ''}
                  >
                    {parsed.text}
                  </span>
                </div>
                {parsed.kind === 'json' && isExpanded && (
                  <div className="ml-5 mt-0.5 mb-1 border-l border-muted pl-3 flex flex-col gap-0.5">
                    {Object.entries(parsed.fields).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground shrink-0">
                          {k}:
                        </span>
                        <FieldValue value={v} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 text-muted-foreground text-xs">
        {lines.length} lines
      </div>
    </>
  )
}
