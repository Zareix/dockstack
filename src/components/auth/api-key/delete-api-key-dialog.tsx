import {
  type ApiKeyAuthClient,
  type ListedApiKey,
  useAuth,
  useAuthPlugin,
  useDeleteApiKey,
} from "@better-auth-ui/react"
import { KeyIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog.tsx"
import { Button } from "#/components/ui/button.tsx"
import { Field } from "#/components/ui/field.tsx"
import { Input } from "#/components/ui/input.tsx"
import { Label } from "#/components/ui/label.tsx"
import { Spinner } from "#/components/ui/spinner.tsx"
import { apiKeyPlugin } from "#/lib/auth/api-key-plugin.ts"

export type DeleteApiKeyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiKey: ListedApiKey
  /** Scope the delete payload to an organization (sets `configId`). */
  organizationId?: string
}

export function DeleteApiKeyDialog({
  open,
  onOpenChange,
  apiKey,
  organizationId,
}: DeleteApiKeyDialogProps) {
  const { authClient, localization } = useAuth()
  const { localization: apiKeyLocalization } = useAuthPlugin(apiKeyPlugin)
  const preview = `${apiKey.start}${"*".repeat(16)}`
  const previewId = `delete-api-key-preview-${apiKey.id}`
  const { mutate: deleteApiKey, isPending: isDeleting } = useDeleteApiKey(
    authClient as ApiKeyAuthClient,
    {
      onSuccess: () => {
        onOpenChange(false)
        toast.success(`${apiKeyLocalization.apiKey} deleted`)
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
    },
  )

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <KeyIcon />
          </AlertDialogMedia>

          <AlertDialogTitle>{apiKeyLocalization.deleteApiKey}</AlertDialogTitle>

          <AlertDialogDescription>{apiKeyLocalization.deleteApiKeyWarning}</AlertDialogDescription>
        </AlertDialogHeader>

        <Field>
          <Label htmlFor={previewId}>{apiKey.name || apiKeyLocalization.apiKey}</Label>

          <Input id={previewId} value={preview} readOnly className="font-mono text-xs" disabled />
        </Field>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {localization.settings.cancel}
          </AlertDialogCancel>

          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={() =>
              deleteApiKey({
                keyId: apiKey.id,
                ...(organizationId ? { configId: "organization" } : {}),
              })
            }
          >
            {isDeleting && <Spinner />}

            {apiKeyLocalization.deleteApiKey}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
