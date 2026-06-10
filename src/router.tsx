import { QueryClient } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"

import { getSettings } from "#/lib/functions/settings"

import { routeTree } from "./routeTree.gen"

export async function getRouter() {
  const queryClient = new QueryClient()
  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
      appSettings: await getSettings(),
    },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
