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
import { containerPrune } from "#/lib/functions"

export function PruneContainersButton() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const pruneM = useMutation({
    mutationFn: () => containerPrune(),
    onSuccess: (result) => {
      const count = result.containersDeleted.length
      const mb = (result.spaceReclaimed / 1e6).toFixed(1)
      toast.success(`Pruned ${count} container${count !== 1 ? "s" : ""}, freed ${mb} MB`)
      queryClient.invalidateQueries({ queryKey: ["containers"] })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={pruneM.isPending}>
            <BroomIcon className="mr-2 h-4 w-4" />
            Prune stopped
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Prune stopped containers?</AlertDialogTitle>
          <AlertDialogDescription>
            All stopped containers will be removed. This cannot be undone.
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
