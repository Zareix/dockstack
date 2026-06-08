import { useCallback, useEffect, useRef, useState } from 'react'
import { streamStackUp } from '#/lib/functions'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'

type Props = {
  stackName: string
  onDone?: () => void
  children: React.ReactElement
}

export function DeployDialog({ stackName, onDone, children }: Props) {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const run = useCallback(async () => {
    setLines([])
    setRunning(true)

    const stopPromise = new Promise<void>((r) => (stopRef.current = r))
    const stopped = { done: true as const, value: undefined }

    const iter = (await streamStackUp({ data: { stackName } }))[
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
        setLines((prev) => [...prev, result.value])
      }
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      await iter.return?.()
      stopRef.current = null
      setRunning(false)
      onDone?.()
    }
  }, [stackName, onDone])

  useEffect(() => {
    if (open) run()
    else stopRef.current?.()
  }, [open, run])

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [lines])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Deploying {stackName}
            {running && (
              <span className="ml-2 inline-block size-2 rounded-full bg-green-400 animate-pulse" />
            )}
          </DialogTitle>
        </DialogHeader>
        <div
          ref={scrollRef}
          className="h-96 overflow-auto bg-zinc-950 rounded-md text-xs font-mono leading-5 p-3 text-zinc-200"
        >
          {lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {line}
            </div>
          ))}
          {running && lines.length === 0 && (
            <span className="text-zinc-500">Starting...</span>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={running}
            onClick={() => setOpen(false)}
          >
            {running ? 'Running…' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
