import { TrashIcon } from "@phosphor-icons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import type { ImageInfo } from "#/lib/docker"
import { imageRemove } from "#/lib/functions"

export function ImageActions({ image }: { image: ImageInfo }) {
  const queryClient = useQueryClient()
  const label = image.tags[0] ?? image.id

  const removeM = useMutation({
    mutationFn: () => imageRemove({ data: { id: image.id } }),
    onSuccess: () => {
      toast.success(`${label} removed`)
      queryClient.invalidateQueries({ queryKey: ["images"] })
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
