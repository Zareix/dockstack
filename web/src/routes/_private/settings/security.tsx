import { createFileRoute } from "@tanstack/react-router"

import { SecuritySettings } from "#/components/auth/settings/security"

export const Route = createFileRoute("/_private/settings/security")({
  component: SecuritySettings,
})
