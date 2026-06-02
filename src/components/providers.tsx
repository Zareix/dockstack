import { Link, useNavigate } from '@tanstack/react-router'
import { ThemeProvider, useTheme } from 'next-themes'
import type { ReactNode } from 'react'
import { usernamePlugin } from '#/lib/auth/username-plugin'
import { themePlugin } from '#/lib/auth/theme-plugin'
import { authClient } from '#/lib/auth-client'
import { AuthProvider } from './auth/auth-provider'
import { Toaster } from './ui/sonner'
import { useQuery } from '@tanstack/react-query'
import { getSocialProviders } from '#/lib/functions/auth'

export function Providers({ children }: { children: ReactNode }) {
  const providersQuery = useQuery({
    queryKey: ['social-providers'],
    queryFn: () => getSocialProviders(),
  })
  const navigate = useNavigate()

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {providersQuery.isLoading ? (
        <></>
      ) : providersQuery.isError ? (
        <div>Could not load providers.</div>
      ) : (
        providersQuery.data && (
          <AuthProvider
            authClient={authClient}
            redirectTo="/"
            socialProviders={providersQuery.data}
            emailAndPassword={{
              enabled: true,
            }}
            navigate={navigate}
            plugins={[themePlugin({ useTheme }), usernamePlugin()]}
            Link={Link}
          >
            {children}
            <Toaster />
          </AuthProvider>
        )
      )}
    </ThemeProvider>
  )
}
