import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, genericOAuth, username } from 'better-auth/plugins'
import { apiKey } from '@better-auth/api-key'
import { env } from '#/env'
import { db } from '#/db'

const oauthProviderId = env.OAUTH_PROVIDER_ID
const oauthClientId = env.OAUTH_CLIENT_ID

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  plugins: [
    oauthProviderId && oauthClientId
      ? genericOAuth({
          config: [
            {
              providerId: oauthProviderId,
              clientId: oauthClientId,
              clientSecret: env.OAUTH_CLIENT_SECRET,
              discoveryUrl: env.OAUTH_DISCOVERY_URL,
              scopes: ['openid', 'email', 'profile'],
            },
          ],
        })
      : null,
    admin(),
    username(),
    apiKey(),
    tanstackStartCookies(),
  ].filter(Boolean),
})
