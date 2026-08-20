import { TanStackDevtools } from "@tanstack/react-devtools"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import { Outlet, createRootRoute } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { useEffect } from "react"

import { AppSidebar } from "#/components/app-sidebar.tsx"
import { ErrorBoundary, ErrorFallback } from "#/components/error-boundary"
import { Navbar } from "#/components/navbar.tsx"
import { Providers } from "#/components/providers"
import { useSettings } from "#/lib/app-context"

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <ErrorFallback message={error.message} onReset={reset} className="min-h-[60vh]" />
  ),
})

function DocumentTitle() {
  const settings = useSettings()
  useEffect(() => {
    if (!settings) return
    const title = `${settings.appTitle}${settings.instanceName ? `・${settings.instanceName}` : ""}`
    if (document.title !== title) document.title = title
  }, [settings])
  return null
}

function RootComponent() {
  return (
    <Providers>
      <DocumentTitle />
      <AppSidebar />
      <Navbar />
      <main className="isolate min-h-[calc(100vh-3rem)] w-full p-4 md:mx-auto md:min-h-screen md:p-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "Tanstack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
          {
            name: "Tanstack Query",
            render: <ReactQueryDevtoolsPanel />,
          },
        ]}
      />
    </Providers>
  )
}
