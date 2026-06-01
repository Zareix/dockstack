import { Button } from '#/components/ui/button'
import { streamLogs } from '#/lib/functions'
import { useVirtualizer } from '@tanstack/react-virtual'
import { PlayCircleIcon, SquareStopIcon, StopCircleIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export function ContainerLogs({ stackName }: { stackName: string }) {
  const [lines, setLines] = useState<string[]>([])
  const [streaming, setStreaming] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef(true)
  const stopRef = useRef<(() => void) | null>(null)

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 20,
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
      while (true) {
        const result = await Promise.race([
          iter.next(),
          stopPromise.then(() => stopped),
        ])
        if (result.done) break
        const text =
          typeof result.value === 'string'
            ? result.value
            : Buffer.from(result.value).toString('utf8')
        setLines((prev) => [...prev, ...text.split('\n').filter(Boolean)])
      }
    } finally {
      await iter.return?.()
      stopRef.current = null
      setStreaming(false)
    }
  }, [stackName])

  const stopStreaming = useCallback(() => {
    stopRef.current?.()
  }, [])

  useEffect(() => {
    if (bottomRef.current && lines.length > 0) {
      const el = parentRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [lines.length])

  return (
    <>
      <div className="flex gap-2 mb-3">
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
      </div>
      <div
        ref={parentRef}
        className="h-[68vh] overflow-auto bg-card text-card-foreground rounded-md text-xs leading-5 font-mono"
      >
        <div
          style={{ height: `${virtualizer.getTotalSize()}px` }}
          className="w-full relative"
        >
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              style={{
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
              }}
              className="absolute top-0 left-0 w-full whitespace-pre"
            >
              {lines[item.index]}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 text-[#666] text-xs">{lines.length} lines</div>
    </>
  )
}
