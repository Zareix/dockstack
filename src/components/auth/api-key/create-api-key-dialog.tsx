import {
  type ApiKeyAuthClient,
  useAuth,
  useAuthPlugin,
  useCreateApiKey,
} from "@better-auth-ui/react"
import { KeyIcon } from "@phosphor-icons/react"
import { type SyntheticEvent, useState } from "react"
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
import { Field, FieldError } from "#/components/ui/field.tsx"
import { Input } from "#/components/ui/input.tsx"
import { Label } from "#/components/ui/label.tsx"
import { Spinner } from "#/components/ui/spinner.tsx"
import { apiKeyPlugin } from "#/lib/auth/api-key-plugin.ts"

import { NewApiKeyDialog } from "./new-api-key-dialog"

export type CreateApiKeyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Create an organization-owned key by passing the organization id. */
  organizationId?: string
}

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  organizationId,
}: CreateApiKeyDialogProps) {
  const { authClient, localization } = useAuth()
  const { localization: apiKeyLocalization } = useAuthPlugin(apiKeyPlugin)

  const { mutate: createApiKey, isPending: isCreating } = useCreateApiKey(
    authClient as ApiKeyAuthClient,
  )

  const [isNewKeyDialogOpen, setIsNewKeyDialogOpen] = useState(false)
  const [keyName, setKeyName] = useState<string | null>(null)
  const [secretKey, setSecretKey] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string>()

  const handleOpenChange = (nextOpen: boolean) => {
    // Ignore dismiss attempts (Escape, Cancel) while a create request is in
    // flight so the trigger stays disabled for the whole async action, not
    // just the submit button.
    if (isCreating) return

    if (!nextOpen) {
      setKeyName(null)
      setSecretKey(null)
      setNameError(undefined)
    }

    onOpenChange(nextOpen)
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.target as HTMLFormElement)
    const name = (formData.get("name") as string).trim()

    const payload =
      name || organizationId
        ? {
            ...(name ? { name } : {}),
            ...(organizationId ? { organizationId, configId: "organization" } : {}),
          }
        : undefined

    createApiKey(payload, {
      onSuccess: (result) => {
        handleOpenChange(false)
        setKeyName(name)
        setSecretKey(result.key)
        setIsNewKeyDialogOpen(true)
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
    })
  }

  return (
    <>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <AlertDialogHeader>
              <AlertDialogMedia>
                <KeyIcon />
              </AlertDialogMedia>

              <AlertDialogTitle>{apiKeyLocalization.createApiKey}</AlertDialogTitle>

              <AlertDialogDescription>
                {apiKeyLocalization.apiKeysDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Field data-invalid={!!nameError}>
              <Label htmlFor="api-key-name">{apiKeyLocalization.name}</Label>

              <Input
                id="api-key-name"
                name="name"
                autoFocus
                maxLength={64}
                placeholder={localization.settings.optional}
                disabled={isCreating}
                onChange={() => setNameError(undefined)}
                onInvalid={(e) => {
                  e.preventDefault()
                  setNameError((e.target as HTMLInputElement).validationMessage)
                }}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "api-key-name-error" : undefined}
              />

              <FieldError id="api-key-name-error">{nameError}</FieldError>
            </Field>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCreating}>
                {localization.settings.cancel}
              </AlertDialogCancel>

              <Button type="submit" disabled={isCreating}>
                {isCreating && <Spinner />}

                {apiKeyLocalization.createApiKey}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <NewApiKeyDialog
        open={isNewKeyDialogOpen}
        onOpenChange={setIsNewKeyDialogOpen}
        secretKey={secretKey}
        name={keyName}
      />
    </>
  )
}
