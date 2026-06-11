import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PlayIcon, RefreshCwIcon, SquareIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import type { ContainerInfo } from "#/lib/docker"
import { containerRemove, containerRestart, containerStart, containerStop } from "#/lib/functions"

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
    mutationFn: () => containerStart({ data: { id: container.id } }),
    onSuccess: () => {
      toast.success(`${container.name} started`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const stopM = useMutation({
    mutationFn: () => containerStop({ data: { id: container.id } }),
    onSuccess: () => {
      toast.success(`${container.name} stopped`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const restartM = useMutation({
    mutationFn: () => containerRestart({ data: { id: container.id } }),
    onSuccess: () => {
      toast.success(`${container.name} restarted`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const removeM = useMutation({
    mutationFn: () => containerRemove({ data: { id: container.id } }),
    onSuccess: () => {
      toast.success(`${container.name} removed`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const busy = startM.isPending || stopM.isPending || restartM.isPending || removeM.isPending
  const running = container.status === "running"

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
          title="Stop"
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
          title="Start"
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
        title="Restart"
      >
        <RefreshCwIcon size={14} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7 text-destructive hover:text-destructive"
        disabled={busy}
        onClick={() => removeM.mutate()}
        title="Remove"
      >
        <Trash2Icon size={14} />
      </Button>
    </div>
  )
}
