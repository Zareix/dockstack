import { startRegistration } from "@simplewebauthn/browser"
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser"
import { CopyIcon } from "@phosphor-icons/react"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "#/components/ui/alert-dialog"
import { Button } from "#/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"
import {
  changePassword,
  createApiKey,
  deleteApiKey,
  deletePasskey,
  listApiKeys,
  listPasskeys,
  listSessions,
  passkeyRegisterBegin,
  passkeyRegisterFinish,
  revokeOtherSessions,
  revokeSession,
} from "#/lib/api"

export const Route = createFileRoute("/_private/settings/security")({
  component: SecuritySettings,
})

function SecuritySettings() {
  return (
    <div className="flex flex-col gap-6">
      <ChangePassword />
      <SessionsSection />
      <ApiKeysSection />
      <PasskeysSection />
    </div>
  )
}

function ChangePassword() {
  const mutation = useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string
      newPassword: string
    }) => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Password changed")
      form.reset()
    },
    onError: (e) => toast.error(e.message),
  })
  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "" },
    onSubmit: ({ value }) => mutation.mutate(value),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Update the password used to sign in</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="currentPassword">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="newPassword">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <Button type="submit" disabled={mutation.isPending} className="self-start">
            Change password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function SessionsSection() {
  const queryClient = useQueryClient()
  const sessionsQuery = useQuery({ queryKey: ["sessions"], queryFn: listSessions })

  const revoke = useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
    onError: (e) => toast.error(e.message),
  })

  const revokeOthers = useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
    onError: (e) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>Devices that are currently signed in</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {sessionsQuery.data?.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{s.userAgent || "Unknown device"}</span>
              {s.isCurrent && <span className="ml-2 text-xs text-muted-foreground">(current)</span>}
              <div className="text-xs text-muted-foreground">{s.ipAddress}</div>
            </div>
            {!s.isCurrent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => revoke.mutate(s.id)}
                disabled={revoke.isPending}
              >
                Revoke
              </Button>
            )}
          </div>
        ))}
        {sessionsQuery.data && sessionsQuery.data.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            className="self-end"
            onClick={() => revokeOthers.mutate()}
            disabled={revokeOthers.isPending}
          >
            Sign out other devices
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function ApiKeysSection() {
  const queryClient = useQueryClient()
  const keysQuery = useQuery({ queryKey: ["api-keys"], queryFn: listApiKeys })
  const [createdKey, setCreatedKey] = useState<{ name: string; key: string } | null>(null)

  const create = useMutation({
    mutationFn: (name: string) => createApiKey(name),
    onSuccess: (result, name) => {
      setCreatedKey({ name, key: result.key })
      queryClient.invalidateQueries({ queryKey: ["api-keys"] })
      form.reset()
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (id: string) => deleteApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
    onError: (e) => toast.error(e.message),
  })

  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value }) => create.mutate(value.name),
  })

  const copyKey = async () => {
    if (!createdKey) return
    try {
      await navigator.clipboard.writeText(createdKey.key)
      toast.success("API key copied")
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>
          Keys for programmatic access to the API. The key is shown only once.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex items-end gap-2"
        >
          <form.Field name="name">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="apiKeyName">Name</Label>
                <Input
                  id="apiKeyName"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="CI deploy"
                />
              </div>
            )}
          </form.Field>
          <Button type="submit" disabled={create.isPending}>
            Create
          </Button>
        </form>
        {keysQuery.data?.map((key) => (
          <div
            key={key.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span className="font-mono">{key.name}</span>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="destructive" size="sm" disabled={remove.isPending}>
                    Delete
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete API key?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The "{key.name}" key will be revoked immediately. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogCancel variant="destructive" onClick={() => remove.mutate(key.id)}>
                    Delete
                  </AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </CardContent>

      <Dialog open={createdKey !== null} onOpenChange={(open) => !open && setCreatedKey(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy your new API key now. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
            <code className="min-w-0 flex-1 text-xs break-all">{createdKey?.key}</code>
            <Button variant="outline" size="sm" onClick={copyKey} aria-label="Copy API key">
              <CopyIcon className="size-4" />
              Copy
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function PasskeysSection() {
  const queryClient = useQueryClient()
  const passkeysQuery = useQuery({ queryKey: ["passkeys"], queryFn: listPasskeys })

  const addPasskey = useMutation({
    mutationFn: async () => {
      const { options } = await passkeyRegisterBegin()
      const credential = await startRegistration({
        optionsJSON: options as PublicKeyCredentialCreationOptionsJSON,
      })
      return passkeyRegisterFinish(credential)
    },
    onSuccess: () => {
      toast.success("Passkey added")
      queryClient.invalidateQueries({ queryKey: ["passkeys"] })
    },
    onError: (e) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deletePasskey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["passkeys"] }),
    onError: (e) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
        <CardDescription>Sign in quickly with a passkey on this device</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          variant="outline"
          className="self-start"
          onClick={() => addPasskey.mutate()}
          disabled={addPasskey.isPending}
        >
          Add passkey
        </Button>
        {passkeysQuery.data?.map((passkey) => (
          <div
            key={passkey.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span className="font-mono">{passkey.name}</span>
            <Button variant="ghost" size="sm" onClick={() => remove.mutate(passkey.id)}>
              Delete
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
