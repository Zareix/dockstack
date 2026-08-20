import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { getSession } from "#/lib/api"
import { queryClient } from "#/lib/query-client"

export const Route = createFileRoute("/_private")({
  async beforeLoad({ location }) {
    const session = await queryClient
      .ensureQueryData({
        queryKey: ["session"],
        queryFn: getSession,
        retry: false,
      })
      .catch(() => null)
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
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
