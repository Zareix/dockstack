import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { toast } from "sonner"

import { forgotPassword } from "#/lib/api"

import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"

export function ForgotPassword() {
  const mutation = useMutation({
    mutationFn: (email: string) => forgotPassword(email),
    onSuccess: () => {
      toast.success("If that email exists, a reset token has been generated.")
    },
    onError: (e) => toast.error(e.message),
  })

  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: ({ value }) => mutation.mutate(value.email),
  })

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll generate a reset token
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="email">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            )}
          </form.Field>
          <Button type="submit" disabled={mutation.isPending}>
            Send reset token
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
