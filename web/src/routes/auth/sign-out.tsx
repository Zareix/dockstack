import { createFileRoute } from "@tanstack/react-router"

import { SignOut } from "#/components/auth/sign-out"

export const Route = createFileRoute("/auth/sign-out")({
  component: SignOut,
})
