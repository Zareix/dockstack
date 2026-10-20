import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_private/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/account" })
  },
})
