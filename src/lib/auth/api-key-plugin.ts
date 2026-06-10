import { createAuthPlugin } from "@better-auth-ui/core"
import { apiKeyPlugin as coreApiKeyPlugin } from "@better-auth-ui/core/plugins"
import type { ApiKeyPluginOptions } from "@better-auth-ui/core/plugins"

import { ApiKeys } from "#/components/auth/api-key/api-keys.tsx"

export const apiKeyPlugin = createAuthPlugin(
  coreApiKeyPlugin.id,
  (options: ApiKeyPluginOptions = {}) => {
    const core = coreApiKeyPlugin(options)

    return {
      ...core,
      securityCards: [ApiKeys],
    }
  },
)
