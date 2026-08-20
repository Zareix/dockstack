import { createFileRoute } from "@tanstack/react-router"
import * as v from "valibot"

import { SignIn } from "#/components/auth/sign-in"

const authSearchSchema = v.object({
  redirectTo: v.optional(v.string()),
})

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: authSearchSchema,
  component: SignIn,
})
