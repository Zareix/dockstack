import { apiKey } from "@better-auth/api-key"
import { passkey } from "@better-auth/passkey"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { admin, genericOAuth, username } from "better-auth/plugins"
import { lastLoginMethod } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { db } from "#/db"
import { env } from "#/env"

const oauthProviderId = env.OAUTH_PROVIDER_ID
const oauthClientId = env.OAUTH_CLIENT_ID

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
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
              scopes: ["openid", "email", "profile"],
            },
          ],
        })
      : null,
    admin(),
    username(),
    passkey(),
    apiKey({
      rateLimit: {
        maxRequests: 100,
        timeWindow: 1000 * 60, // 1m
      },
    }),
    lastLoginMethod({
      customResolveMethod: (ctx) => (ctx.path === "/sign-in/username" ? "username" : null),
    }),
    tanstackStartCookies(),
  ].filter(Boolean),
})
