import { streamLogs } from '#/lib/functions'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useRef, useState } from 'react'

export function ContainerLogs({ stackName }: { stackName: string }) {
  const [lines, setLines] = useState<string[]>([])
  const [streaming, setStreaming] = useState(false)
  const parentRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef(true)
  const stopRef = useRef(false)

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 20,
  })

  const startStreaming = useCallback(async () => {
    stopRef.current = false
    setStreaming(true)
    setLines([])
    for await (const msg of await streamLogs({ data: { stackName } })) {
      if (stopRef.current) break
      const text = typeof msg === 'string' ? msg : Buffer.from(msg).toString('utf8')
      const newLines = text.split('\n').filter(Boolean)
      setLines((prev) => [...prev, ...newLines])
    }
    setStreaming(false)
  }, [stackName])

  const stopStreaming = useCallback(() => {
    stopRef.current = true
  }, [])

  useEffect(() => {
    if (bottomRef.current && lines.length > 0) {
      virtualizer.scrollToIndex(lines.length - 1, { align: 'end' })
    }
  }, [lines.length, virtualizer])

  const handleScroll = () => {
    const el = parentRef.current
    if (!el) return
    bottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
  }

  return (
    <div style={{ fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button onClick={startStreaming} disabled={streaming}>
          {streaming ? 'Streaming...' : 'Start Logs'}
        </button>
        <button onClick={stopStreaming} disabled={!streaming}>
          Stop
        </button>
      </div>
      <div
        ref={parentRef}
        onScroll={handleScroll}
        style={{
          height: '600px',
          overflow: 'auto',
          background: '#0d1117',
          color: '#c9d1d9',
          borderRadius: '6px',
          padding: '8px',
          fontSize: '12px',
          lineHeight: '20px',
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
                whiteSpace: 'pre',
              }}
            >
              {lines[item.index]}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: '8px', color: '#666', fontSize: '12px' }}>
        {lines.length} lines
      </div>
    </div>
  )
}
