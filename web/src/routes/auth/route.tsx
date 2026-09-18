import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/auth")({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="flex min-h-[90vh] items-center justify-center">
      <Outlet />
    </div>
  )
}
