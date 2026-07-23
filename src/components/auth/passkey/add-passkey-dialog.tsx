"use client"

import {
  type PasskeyAuthClient,
  useAddPasskey,
  useAuth,
  useAuthPlugin,
} from "@better-auth-ui/react"
import { FingerprintIcon } from "@phosphor-icons/react"
import type { SyntheticEvent } from "react"
import { useState } from "react"
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
import { passkeyPlugin } from "#/lib/auth/passkey-plugin.ts"

export type AddPasskeyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddPasskeyDialog({ open, onOpenChange }: AddPasskeyDialogProps) {
  const { authClient, localization } = useAuth()
  const { localization: passkeyLocalization } = useAuthPlugin(passkeyPlugin)

  const { mutate: addPasskey, isPending: isAdding } = useAddPasskey(authClient as PasskeyAuthClient)
  const [nameError, setNameError] = useState<string>()

  const handleOpenChange = (nextOpen: boolean) => {
    // Ignore dismiss attempts while a create request is in flight so the
    // trigger stays disabled for the whole async action, not just the
    // submit button.
    if (isAdding) return

    if (!nextOpen) setNameError(undefined)

    onOpenChange(nextOpen)
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.target as HTMLFormElement)
    const name = (formData.get("name") as string)?.trim()

    addPasskey(name ? { name } : undefined, {
      onSuccess: () => {
        handleOpenChange(false)
        toast.success(`${passkeyLocalization.passkey} added`)
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <FingerprintIcon />
            </AlertDialogMedia>

            <AlertDialogTitle>{passkeyLocalization.addPasskey}</AlertDialogTitle>

            <AlertDialogDescription>
              {passkeyLocalization.passkeysDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Field data-invalid={!!nameError}>
            <Label htmlFor="passkey-name">{passkeyLocalization.name}</Label>

            <Input
              id="passkey-name"
              name="name"
              autoFocus
              maxLength={64}
              placeholder={localization.settings.optional}
              disabled={isAdding}
              onChange={() => setNameError(undefined)}
              onInvalid={(e) => {
                e.preventDefault()
                setNameError((e.target as HTMLInputElement).validationMessage)
              }}
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "passkey-name-error" : undefined}
            />

            <FieldError id="passkey-name-error">{nameError}</FieldError>
          </Field>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAdding}>
              {localization.settings.cancel}
            </AlertDialogCancel>

            <Button type="submit" disabled={isAdding}>
              {isAdding && <Spinner />}

              {passkeyLocalization.addPasskey}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
