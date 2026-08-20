import { createFileRoute, redirect } from "@tanstack/react-router"
import * as v from "valibot"

import { Auth } from "#/components/auth/auth"

const authSearchSchema = v.object({
  redirectTo: v.optional(v.string()),
})

const validAuthPaths = new Set(["sign-in", "sign-out", "forgot-password", "reset-password"])

export const Route = createFileRoute("/auth/$path")({
  validateSearch: authSearchSchema,
  beforeLoad({ params: { path } }) {
    if (!validAuthPaths.has(path)) {
      throw redirect({ to: "/" })
    }
  },
  component: AuthPage,
})

function AuthPage() {
  const { path } = Route.useParams()

  return (
    <div className="flex min-h-[90vh] items-center justify-center">
      <Auth path={path} />
    </div>
  )
}
