import { ensureSession as ensureSessionClient } from '@better-auth-ui/react'
import { ensureSession as ensureSessionServer } from '@better-auth-ui/react/server'
import { createIsomorphicFn, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { authClient } from '#/lib/auth-client'
import type { QueryClient } from '@tanstack/react-query'
import { env } from '#/env'
import type { SocialProvider } from 'better-auth'

export const ensureSession = (queryClient: QueryClient) =>
  createIsomorphicFn()
    .server(() =>
      ensureSessionServer(queryClient, auth, { headers: getRequestHeaders() }),
    )
    .client(() => ensureSessionClient(queryClient, authClient))

export const getSocialProviders = createServerFn().handler(async () => {
  const providers: SocialProvider[] = []
  const oauthProviderId = env.OAUTH_PROVIDER_ID
  if (oauthProviderId) {
    providers.push(oauthProviderId)
  }
  return providers
})
