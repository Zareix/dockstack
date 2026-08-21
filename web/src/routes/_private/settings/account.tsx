import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"
import { changeEmail, updateUser } from "#/lib/api"
import { useSession } from "#/lib/app-context/session"

export const Route = createFileRoute("/_private/settings/account")({
  component: AccountSettings,
})

function AccountSettings() {
  const { session } = useSession()
  const queryClient = useQueryClient()

  const user = session?.user

  const updateProfile = useMutation({
    mutationFn: (values: { name: string; avatar: string }) => updateUser(values),
    onSuccess: () => {
      toast.success("Profile updated")
      queryClient.invalidateQueries({ queryKey: ["session"] })
    },
    onError: (e) => toast.error(e.message),
  })

  const profileForm = useForm({
    defaultValues: {
      name: user?.name ?? "",
      avatar: user?.avatar ?? "",
    },
    onSubmit: ({ value }) => updateProfile.mutate(value),
  })

  const emailMutation = useMutation({
    mutationFn: (email: string) => changeEmail(email),
    onSuccess: () => {
      toast.success("Email updated")
      queryClient.invalidateQueries({ queryKey: ["session"] })
    },
    onError: (e) => toast.error(e.message),
  })

  const emailForm = useForm({
    defaultValues: { email: user?.email ?? "" },
    onSubmit: ({ value }) => emailMutation.mutate(value.email),
  })

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name and avatar URL</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              profileForm.handleSubmit()
            }}
            className="flex flex-col gap-4"
          >
            <profileForm.Field name="name">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </profileForm.Field>
            <profileForm.Field name="avatar">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="avatar">Avatar URL</Label>
                  <Input
                    id="avatar"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}
            </profileForm.Field>
            <Button type="submit" disabled={updateProfile.isPending} className="self-start">
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>Change the email associated with your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              emailForm.handleSubmit()
            }}
            className="flex flex-col gap-4"
          >
            <emailForm.Field name="email">
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </emailForm.Field>
            <Button type="submit" disabled={emailMutation.isPending} className="self-start">
              Update email
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
