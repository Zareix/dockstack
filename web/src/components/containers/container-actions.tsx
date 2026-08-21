import { PlayIcon, ArrowsClockwiseIcon, SquareIcon, TrashIcon } from "@phosphor-icons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import type { ContainerInfo } from "#/lib/api"
import { containerRemove, containerRestart, containerStart, containerStop } from "#/lib/api"

export function ContainerActions({
  container,
  stackName,
}: {
  container: ContainerInfo
  stackName?: string
}) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["containers"] })
    queryClient.invalidateQueries({
      queryKey: stackName ? ["stacks", stackName, "status"] : ["stacks"],
    })
    queryClient.invalidateQueries({
      queryKey: stackName ? ["stacks", stackName, "services"] : ["stacks"],
    })
  }

  const startM = useMutation({
    mutationFn: () => containerStart(container.id),
    onSuccess: () => {
      toast.success(`${container.name} started`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const stopM = useMutation({
    mutationFn: () => containerStop(container.id),
    onSuccess: () => {
      toast.success(`${container.name} stopped`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const restartM = useMutation({
    mutationFn: () => containerRestart(container.id),
    onSuccess: () => {
      toast.success(`${container.name} restarted`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const removeM = useMutation({
    mutationFn: () => containerRemove(container.id),
    onSuccess: () => {
      toast.success(`${container.name} removed`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const busy = startM.isPending || stopM.isPending || restartM.isPending || removeM.isPending
  const running = container.status === "running" || container.status === "healthy"

  if (container.status === "missing") return null

  return (
    <div className="flex items-center gap-1">
      {running ? (
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={busy}
          onClick={() => stopM.mutate()}
          aria-label="Stop"
        >
          <SquareIcon size={14} />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={busy}
          onClick={() => startM.mutate()}
          aria-label="Start"
        >
          <PlayIcon size={14} />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        disabled={busy || !running}
        onClick={() => restartM.mutate()}
        aria-label="Restart"
      >
        <ArrowsClockwiseIcon size={14} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7 text-destructive hover:text-destructive"
        disabled={busy}
        onClick={() => removeM.mutate()}
        aria-label="Remove"
      >
        <TrashIcon size={14} />
      </Button>
    </div>
  )
}
