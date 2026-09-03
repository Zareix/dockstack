import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { getAuthSession, getGetAuthSessionQueryKey } from "#/lib/api/generated/default/default.ts"
import { queryClient } from "#/lib/query-client"

export const Route = createFileRoute("/_private")({
  async beforeLoad({ location }) {
    const session = await queryClient
      .ensureQueryData({
        queryKey: getGetAuthSessionQueryKey(),
        queryFn: getAuthSession,
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
