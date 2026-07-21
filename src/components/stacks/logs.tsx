import {
  CaretRightIcon,
  ArrowLineDownIcon,
  PlayCircleIcon,
  StopCircleIcon,
} from "@phosphor-icons/react"
import { AlignBottomSimpleIcon } from "@phosphor-icons/react/dist/ssr/AlignBottomSimple"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"

import { Button } from "#/components/ui/button"
import { Label } from "#/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import { Switch } from "#/components/ui/switch"
import { cn } from "#/lib/utils"
import type { LogEntry } from "#/routes/api/ws/logs"

type ParsedLog =
  | { kind: "text"; text: string }
  | {
      kind: "json"
      text: string
      level: string | null
      fields: Record<string, unknown>
    }

const LEVEL_COLORS: Record<string, string> = {
  trace: "text-zinc-500",
  debug: "text-zinc-400",
  info: "text-green-400",
  warn: "text-yellow-400",
  warning: "text-yellow-400",
  error: "text-red-400",
  fatal: "text-red-600",
}

function parseJsonLog(raw: string): ParsedLog {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return { kind: "text", text: raw }

    const obj = parsed as Record<string, unknown>
    const text = obj.msg ?? obj.message ?? obj.log ?? obj.text
    if (typeof text !== "string") return { kind: "text", text: raw }

    const level = typeof obj.level === "string" ? obj.level.toLowerCase() : null

    const { msg: _a, message: _b, log: _c, text: _d, level: _e, ...fields } = obj
    return { kind: "json", text, level, fields }
  } catch {
    return { kind: "text", text: raw }
  }
}

function FieldValue({ value }: { value: unknown }) {
  switch (typeof value) {
    case "string":
      return <span className="text-green-400">"{value}"</span>
    case "boolean":
      return <span className="text-purple-400">{String(value)}</span>
    case "number":
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
  const [selectedContainers, setSelectedContainers] = useState<string[]>([])

  const parentRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const availableContainers = useMemo(
    () => [...new Set(lines.map((l) => l.containerName))].sort(),
    [lines],
  )

  const filteredLines = useMemo(
    () =>
      selectedContainers.length === 0
        ? lines
        : lines.filter((l) => selectedContainers.includes(l.containerName)),
    [lines, selectedContainers],
  )

  const virtualizer = useVirtualizer({
    count: filteredLines.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) =>
      filteredLines[index].timestamp + filteredLines[index].containerName + index,
    estimateSize: () => 20,
    overscan: 50,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: 50,
  })

  const startStreaming = useCallback(() => {
    setStreaming(true)
    setLines([])
    setExpanded(new Set())
    setSelectedContainers([])

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/logs`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "init", stackName }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as
          | ({ type: "log" } & LogEntry)
          | { type: "end" }
          | { type: "error"; message: string }

        if (msg.type === "log") {
          const { type: _, ...entry } = msg
          setLines((prev) =>
            [...prev, entry].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
          )
          // oxlint-disable-next-line typescript/no-unnecessary-condition
        } else if (msg.type === "end" || msg.type === "error") {
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
      ws.send(JSON.stringify({ type: "close" }))
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
      <div className="mb-3 flex items-center gap-3">
        <Button onClick={streaming ? stopStreaming : startStreaming} size="sm">
          {streaming ? (
            <>
              <StopCircleIcon /> Stop
            </>
          ) : (
            <>
              <PlayCircleIcon /> Start
            </>
          )}
        </Button>
        <Select
          value={selectedContainers}
          onValueChange={setSelectedContainers}
          multiple
          disabled={availableContainers.length === 0}
        >
          <SelectTrigger size="sm" className="w-36 md:w-52">
            <SelectValue placeholder="All containers">
              {(value: string[]) =>
                value.length === 0 || value.length === availableContainers.length
                  ? "All containers"
                  : `${value.length} selected`
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableContainers.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-2">
          <Switch id="timestamp" checked={showTimestamp} onCheckedChange={setShowTimestamp} />
          <Label htmlFor="timestamp">Timestamps</Label>
        </div>
        <Button
          onClick={() => virtualizer.scrollToEnd()}
          variant="outline"
          size="icon"
          className="ml-auto"
        >
          <AlignBottomSimpleIcon />
        </Button>
      </div>
      <div
        ref={parentRef}
        className="h-[60vh] overflow-auto rounded-md bg-card px-2 font-mono text-xs leading-5 text-card-foreground md:h-[68vh]"
      >
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((item) => {
            const entry = filteredLines[item.index]
            const date = new Date(entry.timestamp)
            const itemKey = String(item.key)
            const isExpanded = expanded.has(itemKey)
            const parsed = parseJsonLog(entry.message)

            const toggle = () => {
              if (parsed.kind !== "json") return
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
                className="absolute top-0 left-0 w-full"
              >
                <div
                  onClick={toggle}
                  className={cn(
                    "flex gap-2 whitespace-pre",
                    parsed.kind === "json" && "cursor-pointer rounded px-0.5 hover:bg-muted/40",
                  )}
                >
                  {parsed.kind === "json" && (
                    <CaretRightIcon
                      className={cn(
                        "mt-0.5 size-3 shrink-0 text-muted-foreground transition-transform",
                        isExpanded && "rotate-90",
                      )}
                    />
                  )}
                  {showTimestamp && (
                    <span className="shrink-0 text-muted-foreground">
                      {date.toLocaleDateString()} {date.toLocaleTimeString()}
                    </span>
                  )}
                  <span className="shrink-0 text-blue-400">[{entry.containerName}]</span>
                  {parsed.kind === "json" && parsed.level && (
                    <span className={cn("shrink-0", LEVEL_COLORS[parsed.level] ?? "text-zinc-400")}>
                      {parsed.level.toUpperCase()}
                    </span>
                  )}
                  <span className={entry.stream === "stderr" ? "text-red-400" : ""}>
                    {parsed.text}
                  </span>
                </div>
                {parsed.kind === "json" && isExpanded && (
                  <div className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l border-muted pl-3">
                    {Object.entries(parsed.fields).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="shrink-0 text-muted-foreground">{k}:</span>
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
      <div className="mt-2 text-xs text-muted-foreground">{filteredLines.length} lines</div>
    </>
  )
}
