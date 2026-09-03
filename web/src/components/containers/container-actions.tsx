import { PlayIcon, ArrowsClockwiseIcon, SquareIcon, TrashIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import {
  getGetContainersQueryKey,
  getGetStacksNameContainersQueryKey,
  getGetStacksNameQueryKey,
  getGetStacksQueryKey,
  useDeleteContainersId,
  usePostContainersIdRestart,
  usePostContainersIdStart,
  usePostContainersIdStop,
} from "#/lib/api/generated/default/default"
import type { ContainerInfo } from "#/lib/api/generated/model"

export function ContainerActions({
  container,
  stackName,
}: {
  container: ContainerInfo
  stackName?: string
}) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetContainersQueryKey() })
    queryClient.invalidateQueries({
      queryKey: stackName ? getGetStacksNameQueryKey(stackName) : getGetStacksQueryKey(),
    })
    queryClient.invalidateQueries({
      queryKey: stackName ? getGetStacksNameContainersQueryKey(stackName) : getGetStacksQueryKey(),
    })
  }

  const startM = usePostContainersIdStart({
    mutation: {
      onSuccess: () => {
        toast.success(`${container.name} started`)
        invalidate()
      },
      onError: (e) => toast.error(e.message),
    },
  })
  const stopM = usePostContainersIdStop({
    mutation: {
      onSuccess: () => {
        toast.success(`${container.name} stopped`)
        invalidate()
      },
      onError: (e) => toast.error(e.message),
    },
  })
  const restartM = usePostContainersIdRestart({
    mutation: {
      onSuccess: () => {
        toast.success(`${container.name} restarted`)
        invalidate()
      },
      onError: (e) => toast.error(e.message),
    },
  })
  const removeM = useDeleteContainersId({
    mutation: {
      onSuccess: () => {
        toast.success(`${container.name} removed`)
        invalidate()
      },
      onError: (e) => toast.error(e.message),
    },
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
          onClick={() => stopM.mutate({ id: container.id })}
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
          onClick={() => startM.mutate({ id: container.id })}
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
        onClick={() => restartM.mutate({ id: container.id })}
        aria-label="Restart"
      >
        <ArrowsClockwiseIcon size={14} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7 text-destructive hover:text-destructive"
        disabled={busy}
        onClick={() => removeM.mutate({ id: container.id })}
        aria-label="Remove"
      >
        <TrashIcon size={14} />
      </Button>
    </div>
  )
}
