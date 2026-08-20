import { createFileRoute } from "@tanstack/react-router"

import { AccountSettings } from "#/components/auth/settings/account"

export const Route = createFileRoute("/_private/settings/account")({
  component: AccountSettings,
})
