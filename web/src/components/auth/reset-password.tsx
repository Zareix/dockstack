import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"

import { resetPassword } from "#/lib/api"

import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"

export function ResetPassword() {
  const navigate = useNavigate()

  const mutation = useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      resetPassword(token, newPassword),
    onSuccess: () => {
      toast.success("Password reset. You can now sign in.")
      navigate({ to: "/auth/sign-in" })
    },
    onError: (e) => toast.error(e.message),
  })

  const form = useForm({
    defaultValues: { token: "", newPassword: "", confirmPassword: "" },
    onSubmit: ({ value }) => {
      if (value.newPassword !== value.confirmPassword) {
        toast.error("Passwords do not match")
        return
      }
      mutation.mutate({ token: value.token, newPassword: value.newPassword })
    },
  })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>Enter the reset token and a new password</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="token">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="token">Reset token</Label>
                <Input
                  id="token"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Token from server logs"
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
          <form.Field name="confirmPassword">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <Button type="submit" disabled={mutation.isPending}>
            Reset password
          </Button>
          <div className="text-center text-sm">
            <Link to="/auth/sign-in" className="text-muted-foreground hover:underline">
              Back to sign in
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
