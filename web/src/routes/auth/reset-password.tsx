import { createFileRoute } from "@tanstack/react-router"

import { ResetPassword } from "#/components/auth/reset-password"

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPassword,
})
