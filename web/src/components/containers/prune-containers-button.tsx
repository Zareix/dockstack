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
import {
  getGetContainersQueryKey,
  usePostContainersPrune,
} from "#/lib/api/generated/default/default"

export function PruneContainersButton() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const pruneM = usePostContainersPrune({
    mutation: {
      onSuccess: (result) => {
        const count = result.deleted?.length ?? 0
        const mb = (result.spaceReclaimed / 1e6).toFixed(1)
        toast.success(`Pruned ${count} container${count !== 1 ? "s" : ""}, freed ${mb} MB`)
        queryClient.invalidateQueries({ queryKey: getGetContainersQueryKey() })
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
