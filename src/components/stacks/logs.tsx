import { useVirtualizer } from '@tanstack/react-virtual'
import { PlayCircleIcon, StopCircleIcon } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { LogEntry } from '#/lib/functions'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { streamLogs } from '#/lib/functions'

export function ContainerLogs({ stackName }: { stackName: string }) {
  const [streaming, setStreaming] = useState(false)
  const [lines, setLines] = useState<LogEntry[]>([])

  const [showTimestamp, setShowTimestamp] = useState(false)
  const [didInitialScroll, setDidInitialScroll] = useState(false)

  const parentRef = useRef<HTMLDivElement>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => lines[index].timestamp,
    estimateSize: () => 500,
    overscan: 50,
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: 50,
  })

  const startStreaming = useCallback(async () => {
    setStreaming(true)
    setLines([])

    const stopPromise = new Promise<void>((resolve) => {
      stopRef.current = resolve
    })
    const stopped = { done: true as const, value: undefined }

    const iter = (await streamLogs({ data: { stackName } }))[
      Symbol.asyncIterator
    ]()
    try {
      // eslint-disable-next-line
      while (true) {
        const result = await Promise.race([
          iter.next(),
          stopPromise.then(() => stopped),
        ])
        if (result.done) break
        setLines((prev) =>
          [...prev, result.value].sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp),
          ),
        )
      }
    } finally {
      // eslint-disable-next-line
      await iter.return?.()
      stopRef.current = null
      setStreaming(false)
    }
  }, [stackName])

  const stopStreaming = useCallback(() => {
    stopRef.current?.()
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
      </div>
      <div
        ref={parentRef}
        className="h-[68vh] overflow-auto bg-card text-card-foreground rounded-md text-xs leading-5 font-mono px-2"
      >
        <div className="w-full relative">
          {virtualizer
            .getVirtualItems()

            .map((item) => {
              const entry = lines[item.index]
              const date = new Date(entry.timestamp)
              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  style={{
                    transform: `translateY(${item.start}px)`,
                  }}
                  className="absolute w-full top-0 left-0 whitespace-pre flex gap-2"
                >
                  {showTimestamp && (
                    <span className="text-muted-foreground shrink-0">
                      {date.toLocaleDateString()} {date.toLocaleTimeString()}
                    </span>
                  )}
                  <span className="text-blue-400 shrink-0">
                    [{entry.containerName}]
                  </span>
                  <span
                    className={entry.stream === 'stderr' ? 'text-red-400' : ''}
                  >
                    {entry.message}
                  </span>
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
