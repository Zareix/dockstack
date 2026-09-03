import { BroomIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "#/components/ui/alert-dialog"
import { Button } from "#/components/ui/button"
import { getGetImagesQueryKey, usePostImagesPrune } from "#/lib/api/generated/default/default"

export function PruneImagesButton() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const pruneM = usePostImagesPrune({
    mutation: {
      onSuccess: (result) => {
        const count = result.deleted?.length ?? 0
        const mb = (result.spaceReclaimed / 1e6).toFixed(1)
        toast.success(`Pruned ${count} image${count !== 1 ? "s" : ""}, freed ${mb} MB`)
        queryClient.invalidateQueries({ queryKey: getGetImagesQueryKey() })
      },
      onError: (e) => toast.error(e.message),
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={pruneM.isPending}>
            <BroomIcon data-icon="inline-start" className="size-4" />
            Prune unused
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Prune unused images?</AlertDialogTitle>
          <AlertDialogDescription>
            All images not referenced by any container will be removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false)
              pruneM.mutate()
            }}
          >
            Prune
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
