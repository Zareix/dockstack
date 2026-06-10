import { apiKeyClient } from "@better-auth/api-key/client"
import { adminClient, genericOAuthClient, usernameClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [genericOAuthClient(), adminClient(), usernameClient(), apiKeyClient()],
})
