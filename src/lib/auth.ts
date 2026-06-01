import { env } from '#/env'
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { genericOAuth } from 'better-auth/plugins'
import { db } from '#/db'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: env.OAUTH_PROVIDER_ID,
          clientId: env.OAUTH_CLIENT_ID,
          clientSecret: env.OAUTH_CLIENT_SECRET,
          discoveryUrl: env.OAUTH_DISCOVERY_URL,
          scopes: ['openid', 'email', 'profile'],
        },
      ],
    }),
    tanstackStartCookies(),
  ],
})
