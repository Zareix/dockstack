import { ArrowRightIcon, KeyIcon } from "@phosphor-icons/react"
import { startAuthentication } from "@simplewebauthn/browser"
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"

import {
  getSocialProviders,
  passkeyAuthBegin,
  passkeyAuthFinish,
  signInEmail,
  signInUsername,
} from "#/lib/api"
import { useSession } from "#/lib/app-context"

import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Spinner } from "../ui/spinner"

export function SignIn() {
  const navigate = useNavigate()
  const { redirectTo } = useSearch({ from: "/auth/sign-in" })
  const { isAuthenticated } = useSession()

  const providersQuery = useQuery({
    queryKey: ["social-providers"],
    queryFn: getSocialProviders,
  })

  const signInMutation = useMutation({
    mutationFn: async ({ identifier, password }: { identifier: string; password: string }) => {
      if (identifier.includes("@")) {
        return signInEmail(identifier, password)
      }
      return signInUsername(identifier, password)
    },
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      toast.success("Signed in")
      navigate({ to: (redirectTo as string) || "/" })
    },
  })

  const passkeyMutation = useMutation({
    mutationFn: async () => {
      const { options } = await passkeyAuthBegin()
      const credential = await startAuthentication({
        optionsJSON: options as PublicKeyCredentialRequestOptionsJSON,
      })
      return passkeyAuthFinish(credential)
    },
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      toast.success("Signed in")
      navigate({ to: (redirectTo as string) || "/" })
    },
  })

  const form = useForm({
    defaultValues: { identifier: "", password: "" },
    onSubmit: ({ value }) => signInMutation.mutate(value),
  })

  if (isAuthenticated) {
    navigate({ to: "/" })
    return null
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to manage your stacks</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="identifier">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="identifier">Email or username</Label>
                <Input
                  id="identifier"
                  autoComplete="username"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            )}
          </form.Field>
          <div className="flex items-center justify-between text-sm">
            <Link to="/auth/forgot-password" className="text-muted-foreground hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" disabled={signInMutation.isPending}>
            {signInMutation.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <ArrowRightIcon className="size-4" />
            )}
            Sign in
          </Button>
        </form>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          onClick={() => passkeyMutation.mutate()}
          disabled={passkeyMutation.isPending}
        >
          <KeyIcon className="size-4" />
          Sign in with a passkey
        </Button>

        {providersQuery.data?.map((provider) => (
          <Button
            key={provider}
            variant="outline"
            render={<a href={`/api/auth/oauth/${provider}`} />}
          >
            Continue with {provider}
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
