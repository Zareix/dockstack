import { createAuthPlugin } from '@better-auth-ui/core'
import { usernamePlugin as coreUsernamePlugin } from '@better-auth-ui/core/plugins'
import type { UsernamePluginOptions } from '@better-auth-ui/core/plugins'

import { SignInUsername } from '#/components/auth/username/sign-in-username.tsx'
import { UsernameField } from '#/components/auth/username/username-field.tsx'

export const usernamePlugin = createAuthPlugin(
  coreUsernamePlugin.id,
  (options: UsernamePluginOptions = {}) => {
    const core = coreUsernamePlugin(options)

    return {
      ...core,
      additionalFields: core.additionalFields.map((field) =>
        field.name === 'username'
          ? {
              ...field,
              render: UsernameField,
            }
          : field,
      ),
      views: {
        auth: { signIn: SignInUsername },
      },
    }
  },
)
