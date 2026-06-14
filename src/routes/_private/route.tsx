import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { ensureSession } from "#/lib/functions/auth.ts"

export const Route = createFileRoute("/_private")({
  async beforeLoad({ context: { queryClient }, location }) {
    const session = await ensureSession(queryClient)()
    if (!session) {
      throw redirect({
        to: "/auth/$path",
        params: { path: "sign-in" },
        search: { redirectTo: location.href },
      })
    }
    return { session }
  },
  component: PrivateLayout,
})

function PrivateLayout() {
  return <Outlet />
}
