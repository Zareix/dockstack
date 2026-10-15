import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router"

import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs"

export const Route = createFileRoute("/_private/settings")({
  component: SettingsLayout,
})

function SettingsLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tab = pathname.replace("/settings/", "")

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <div className="flex flex-col gap-6">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            if (value !== "account" && value !== "security") return
            navigate({ to: `/settings/${value}` })
          }}
        >
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
        </Tabs>
        <Outlet />
      </div>
    </div>
  )
}
