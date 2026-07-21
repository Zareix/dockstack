import { TrashIcon } from "@phosphor-icons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import type { VolumeInfo } from "#/lib/docker"
import { volumeRemove } from "#/lib/functions"

export function VolumeActions({ volume }: { volume: VolumeInfo }) {
  const queryClient = useQueryClient()

  const removeM = useMutation({
    mutationFn: () => volumeRemove({ data: { name: volume.name } }),
    onSuccess: () => {
      toast.success(`${volume.name} removed`)
      queryClient.invalidateQueries({ queryKey: ["volumes"] })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Button
      size="icon"
      variant="ghost"
      className="size-7 text-destructive hover:text-destructive"
      disabled={removeM.isPending}
      onClick={() => removeM.mutate()}
      title="Remove"
    >
      <TrashIcon size={14} />
    </Button>
  )
}
