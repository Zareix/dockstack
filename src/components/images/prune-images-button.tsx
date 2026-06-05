import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BrushCleaningIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { imagePrune } from '#/lib/functions'
import { Button } from '#/components/ui/button'
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
} from '#/components/ui/alert-dialog'

export function PruneImagesButton() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const pruneM = useMutation({
    mutationFn: () => imagePrune(),
    onSuccess: (result) => {
      const count = result.ImagesDeleted.length
      const mb = (result.SpaceReclaimed / 1e6).toFixed(1)
      toast.success(
        `Pruned ${count} image${count !== 1 ? 's' : ''}, freed ${mb} MB`,
      )
      queryClient.invalidateQueries({ queryKey: ['images'] })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={pruneM.isPending}>
            <BrushCleaningIcon className="mr-2 h-4 w-4" />
            Prune unused
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Prune unused images?</AlertDialogTitle>
          <AlertDialogDescription>
            All images not referenced by any container will be removed. This
            cannot be undone.
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
