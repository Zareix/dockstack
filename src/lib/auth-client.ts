import { apiKeyClient } from "@better-auth/api-key/client"
import { passkeyClient } from "@better-auth/passkey/client"
import {
  adminClient,
  genericOAuthClient,
  lastLoginMethodClient,
  usernameClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [
    genericOAuthClient(),
    passkeyClient(),
    usernameClient(),
    apiKeyClient(),
    lastLoginMethodClient(),
    adminClient(),
  ],
})
