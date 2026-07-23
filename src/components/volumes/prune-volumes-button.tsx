import { BroomIcon } from "@phosphor-icons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { volumePrune } from "#/lib/functions"

export function PruneVolumesButton() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const pruneM = useMutation({
    mutationFn: () => volumePrune(),
    onSuccess: (result) => {
      const count = result.prunedVolumes.length
      const mb = (result.spaceReclaimed / 1e6).toFixed(1)
      toast.success(`Pruned ${count} volume${count !== 1 ? "s" : ""}, freed ${mb} MB`)
      queryClient.invalidateQueries({ queryKey: ["volumes"] })
    },
    onError: (e) => toast.error(e.message),
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
          <AlertDialogTitle>Prune unused volumes?</AlertDialogTitle>
          <AlertDialogDescription>
            All volumes not referenced by any container will be removed. This cannot be undone.
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
