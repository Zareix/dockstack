import { TrashIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import { getGetImagesQueryKey, useDeleteImagesId } from "#/lib/api/generated/default/default"
import type { ImageInfo } from "#/lib/api/generated/model"

export function ImageActions({ image }: { image: ImageInfo }) {
  const queryClient = useQueryClient()
  const label = image.tags?.[0] ?? image.id

  const removeM = useDeleteImagesId({
    mutation: {
      onSuccess: () => {
        toast.success(`${label} removed`)
        queryClient.invalidateQueries({ queryKey: getGetImagesQueryKey() })
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
      onClick={() => removeM.mutate({ id: image.id })}
      aria-label="Remove"
    >
      <TrashIcon size={14} />
    </Button>
  )
}
