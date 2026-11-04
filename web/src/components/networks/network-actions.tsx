import { TrashIcon } from "@phosphor-icons/react"
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
import { getGetNetworksQueryKey, useDeleteNetworksName } from "#/lib/api/generated/default/default"
import type { NetworkInfo } from "#/lib/api/generated/model"

export function NetworkActions({ network }: { network: NetworkInfo }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const removeM = useDeleteNetworksName({
    mutation: {
      onSuccess: () => {
        toast.success(`${network.name} removed`)
        queryClient.invalidateQueries({ queryKey: getGetNetworksQueryKey() })
      },
      onError: (e) => toast.error(e.message),
    },
  })

  const removable = network.status === "unused"

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <span
        title={
          removable
            ? undefined
            : network.status === "system"
              ? "Default Docker networks cannot be removed"
              : "Network is in use by one or more containers"
        }
      >
        <AlertDialogTrigger
          render={
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-destructive hover:text-destructive"
              disabled={!removable || removeM.isPending}
              aria-label="Remove"
            >
              <TrashIcon size={14} />
            </Button>
          }
        />
      </span>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove network?</AlertDialogTitle>
          <AlertDialogDescription>
            {network.name} will be removed. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setOpen(false)
              removeM.mutate({ name: network.name })
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
