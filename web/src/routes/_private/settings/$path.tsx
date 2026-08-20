import { createFileRoute, notFound, redirect } from "@tanstack/react-router"

import { Settings } from "#/components/auth/settings"
import { getSession } from "#/lib/api"
import { queryClient } from "#/lib/query-client"

const validSettingsPaths = new Set(["account", "security"])

export const Route = createFileRoute("/_private/settings/$path")({
  async beforeLoad({ params: { path }, location }) {
    if (!validSettingsPaths.has(path)) {
      throw notFound()
    }
    const session = await queryClient
      .ensureQueryData({
        queryKey: ["session"],
        queryFn: getSession,
        retry: false,
      })
      .catch(() => null)
    if (!session) {
      throw redirect({
        to: "/auth/$path",
        params: { path: "sign-in" },
        search: { redirectTo: location.href },
      })
    }
    return { session }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { path } = Route.useParams()

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <Settings path={path} />
    </div>
  )
}
