import { TrashIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import { getGetVolumesQueryKey, useDeleteVolumesName } from "#/lib/api/generated/default/default"
import type { VolumeInfo } from "#/lib/api/generated/model"

export function VolumeActions({ volume }: { volume: VolumeInfo }) {
  const queryClient = useQueryClient()

  const removeM = useDeleteVolumesName({
    mutation: {
      onSuccess: () => {
        toast.success(`${volume.name} removed`)
        queryClient.invalidateQueries({ queryKey: getGetVolumesQueryKey() })
      },
      onError: (e) => toast.error(e.message),
    },
  })

  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-7 text-destructive hover:text-destructive"
      disabled={removeM.isPending}
      onClick={() => removeM.mutate({ name: volume.name })}
      aria-label="Remove"
    >
      <TrashIcon size={14} />
    </Button>
  )
}
