"use client"

import { authMutationKeys } from "@better-auth-ui/core"
import {
  useAuth,
  useAuthPlugin,
  useFetchOptions,
  useSendVerificationEmail,
  useSignInEmail,
  useSignInUsername,
} from "@better-auth-ui/react"
import type { UsernameAuthClient } from "@better-auth-ui/react"
import { useIsMutating } from "@tanstack/react-query"
import { useState } from "react"
import type { SyntheticEvent } from "react"
import { toast } from "sonner"

import { ProviderButtons } from "#/components/auth/provider-buttons.tsx"
import type { SocialLayout } from "#/components/auth/provider-buttons.tsx"
import { Badge } from "#/components/ui/badge.tsx"
import { Button } from "#/components/ui/button.tsx"
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card.tsx"
import { Checkbox } from "#/components/ui/checkbox.tsx"
import { Field, FieldError, FieldGroup, FieldSeparator } from "#/components/ui/field.tsx"
import { Input } from "#/components/ui/input.tsx"
import { Label } from "#/components/ui/label.tsx"
import { Spinner } from "#/components/ui/spinner.tsx"
import { authClient as projectAuthClient } from "#/lib/auth-client.ts"
import { usernamePlugin } from "#/lib/auth/username-plugin.ts"
import { cn } from "#/lib/utils.ts"

export type SignInUsernameProps = {
  className?: string
  socialLayout?: SocialLayout
  socialPosition?: "top" | "bottom"
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Render the username-based sign-in form. Identical to the built-in `<SignIn>`
 * design but routes non-email inputs through `signInUsername` instead of
 * `signInEmail`.
 */
export function SignInUsername({
  className,
  socialLayout,
  socialPosition = "bottom",
}: SignInUsernameProps) {
  const {
    authClient,
    basePaths,
    baseURL,
    emailAndPassword,
    localization,
    plugins,
    redirectTo,
    socialProviders,
    viewPaths,
    navigate,
    Link,
  } = useAuth()

  const { fetchOptions, resetFetchOptions } = useFetchOptions()

  const { localization: usernameLocalization } = useAuthPlugin(usernamePlugin)

  const [password, setPassword] = useState("")

  const lastUsedMethod = projectAuthClient.getLastUsedLoginMethod()
  const isLastUsedField = lastUsedMethod === "email" || lastUsedMethod === "username"

  const { mutate: sendVerificationEmail } = useSendVerificationEmail(authClient, {
    onSuccess: () => toast.success(localization.auth.verificationEmailSent),
  })

  const { mutate: signInEmail, isPending: isSignInEmailPending } = useSignInEmail(authClient, {
    onError: (error, { email }) => {
      setPassword("")

      if (error.error?.code === "EMAIL_NOT_VERIFIED") {
        toast.error(error.error?.message || error.message, {
          action: {
            label: localization.auth.resend,
            onClick: () =>
              sendVerificationEmail({
                email,
                callbackURL: `${baseURL}${redirectTo}`,
              }),
          },
        })
      }

      resetFetchOptions()
    },
    onSuccess: () => navigate({ to: redirectTo }),
  })

  const { mutate: signInUsername, isPending: isSignInUsernamePending } = useSignInUsername(
    authClient as UsernameAuthClient,
    {
      onError: () => {
        setPassword("")
        resetFetchOptions()
      },
      onSuccess: () => navigate({ to: redirectTo }),
    },
  )

  const signInMutating = useIsMutating({
    mutationKey: authMutationKeys.signIn.all,
  })
  const signUpMutating = useIsMutating({
    mutationKey: authMutationKeys.signUp.all,
  })
  const isPending = signInMutating + signUpMutating > 0
  const isSignInPending = isSignInEmailPending || isSignInUsernamePending

  const Captcha = plugins.find((plugin) => plugin.captchaComponent)?.captchaComponent

  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string
    password?: string
  }>({})

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const identifier = formData.get("identifier") as string
    const rememberMe = formData.get("rememberMe") === "on"

    if (isEmail(identifier)) {
      signInEmail({
        email: identifier,
        password,
        ...(emailAndPassword?.rememberMe ? { rememberMe } : {}),
        fetchOptions,
      })
    } else {
      signInUsername({
        username: identifier,
        password,
        ...(emailAndPassword?.rememberMe ? { rememberMe } : {}),
        fetchOptions,
      })
    }
  }

  const showSeparator = emailAndPassword?.enabled && socialProviders && socialProviders.length > 0

  return (
    <Card className={cn("w-full max-w-sm", className)}>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{localization.auth.signIn}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-6">
          {socialPosition === "top" && (
            <>
              {socialProviders && socialProviders.length > 0 && (
                <ProviderButtons socialLayout={socialLayout} />
              )}

              {showSeparator && (
                <FieldSeparator className="m-0 flex items-center text-xs *:data-[slot=field-separator-content]:bg-card">
                  {localization.auth.or}
                </FieldSeparator>
              )}
            </>
          )}

          {emailAndPassword?.enabled && (
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field data-invalid={!!fieldErrors.identifier}>
                  <Label htmlFor="identifier" className="flex items-center gap-2">
                    {usernameLocalization.username}
                    {isLastUsedField && (
                      <Badge variant="secondary" className="border-border text-xs font-normal">
                        Last used
                      </Badge>
                    )}
                  </Label>

                  <Input
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    placeholder={usernameLocalization.usernameOrEmailPlaceholder}
                    required
                    disabled={isPending}
                    onChange={() => {
                      setFieldErrors((prev) => ({
                        ...prev,
                        identifier: undefined,
                      }))
                    }}
                    onInvalid={(e) => {
                      e.preventDefault()

                      setFieldErrors((prev) => ({
                        ...prev,
                        identifier: (e.target as HTMLInputElement).validationMessage,
                      }))
                    }}
                    aria-invalid={!!fieldErrors.identifier}
                    aria-describedby={fieldErrors.identifier ? "identifier-error" : undefined}
                  />

                  <FieldError id="identifier-error">{fieldErrors.identifier}</FieldError>
                </Field>

                <Field data-invalid={!!fieldErrors.password}>
                  <Label htmlFor="password">{localization.auth.password}</Label>

                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)

                      setFieldErrors((prev) => ({
                        ...prev,
                        password: undefined,
                      }))
                    }}
                    placeholder={localization.auth.passwordPlaceholder}
                    required
                    minLength={emailAndPassword?.minPasswordLength}
                    maxLength={emailAndPassword?.maxPasswordLength}
                    disabled={isPending}
                    onInvalid={(e) => {
                      e.preventDefault()

                      setFieldErrors((prev) => ({
                        ...prev,
                        password: (e.target as HTMLInputElement).validationMessage,
                      }))
                    }}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  />

                  <FieldError id="password-error">{fieldErrors.password}</FieldError>
                </Field>

                {emailAndPassword.rememberMe && (
                  <Field className="my-1">
                    <div className="flex items-center gap-3">
                      <Checkbox id="rememberMe" name="rememberMe" disabled={isPending} />

                      <Label htmlFor="rememberMe" className="cursor-pointer text-sm font-normal">
                        {localization.auth.rememberMe}
                      </Label>
                    </div>
                  </Field>
                )}

                {Captcha && <div className="flex justify-center">{Captcha}</div>}

                <div className="flex flex-col gap-3">
                  <Button type="submit" disabled={isPending}>
                    {isSignInPending && <Spinner />}

                    {localization.auth.signIn}
                  </Button>

                  {plugins.flatMap((plugin) =>
                    (plugin.authButtons ?? []).map((AuthButton, index) => (
                      <AuthButton key={`${plugin.id}-${index.toString()}`} view="signIn" />
                    )),
                  )}
                </div>
              </FieldGroup>
            </form>
          )}

          {socialPosition === "bottom" && (
            <>
              {showSeparator && (
                <FieldSeparator className="flex items-center text-xs *:data-[slot=field-separator-content]:bg-card">
                  {localization.auth.or}
                </FieldSeparator>
              )}

              {socialProviders && socialProviders.length > 0 && (
                <ProviderButtons socialLayout={socialLayout} />
              )}
            </>
          )}
        </div>

        <div className="mt-4 flex w-full flex-col items-center gap-3">
          {emailAndPassword?.forgotPassword && (
            <Link
              href={`${basePaths.auth}/${viewPaths.auth.forgotPassword}`}
              className="self-center text-sm underline-offset-4 hover:underline"
            >
              {localization.auth.forgotPasswordLink}
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
