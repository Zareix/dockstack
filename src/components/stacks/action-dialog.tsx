import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "#/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog"
import { HEARTBEAT } from "#/lib/streams.ts"
import { cn } from "#/lib/utils.ts"

import { ScrollArea } from "../ui/scroll-area"

type Props = {
  title: string
  action: () => Promise<AsyncIterable<string>>
  onDone?: () => void
  children: React.ReactElement
}

export function StackActionDialog({ title, action, onDone, children }: Props) {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const actionRef = useRef(action)
  actionRef.current = action
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const run = useCallback(async () => {
    setLines([])
    setRunning(true)

    const stopPromise = new Promise<void>((r) => (stopRef.current = r))
    const iter = (await actionRef.current())[Symbol.asyncIterator]()

    try {
      // eslint-disable-next-line typescript/no-unnecessary-condition
      while (true) {
        const result = await Promise.race([
          iter.next(),
          stopPromise.then(() => ({ done: true as const, value: undefined })),
        ])
        if (result.done) break
        if (result.value === HEARTBEAT) continue
        setLines((prev) => [...prev, result.value])
      }
    } finally {
      await iter.return?.()
      stopRef.current = null
      setRunning(false)
      setLines((prev) => [...prev, "Done."])
      onDoneRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (open) run()
    else stopRef.current?.()
  }, [open, run])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [lines])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent className="md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {title}
            {running && (
              <span className="ml-2 inline-block size-2 rounded-full bg-green-400 motion-safe:animate-pulse" />
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-hidden rounded-md bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-200">
          <ScrollArea ref={scrollRef} className="h-96">
            {lines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "whitespace-pre",
                  line === "Done." && "text-emerald-400",
                  line.startsWith("$ ") && "text-zinc-400",
                )}
              >
                {line}
              </div>
            ))}
            {running && lines.length === 0 && <span className="text-zinc-500">Starting...</span>}
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={running} onClick={() => setOpen(false)}>
            {running ? "Running…" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
