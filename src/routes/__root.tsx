import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import type { getSettings } from '#/lib/functions/settings'
import { Providers } from '#/components/providers'
import { AppSidebar } from '#/components/app-sidebar'
import { Navbar } from '#/components/navbar'

interface MyRouterContext {
  queryClient: QueryClient
  appSettings: Awaited<ReturnType<typeof getSettings>>
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  loader: ({ context }) => {
    return context.appSettings
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: loaderData?.appTitle,
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
    </div>
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <Providers>
          <AppSidebar />
          <Navbar />
          <main className="p-4 md:p-8 min-h-screen w-full isolate">
            {children}
          </main>
        </Providers>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            {
              name: 'Tanstack Query',
              render: <ReactQueryDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
