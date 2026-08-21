import { IconContext } from "@phosphor-icons/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"

import { ThemeHotkey } from "#/hooks/use-theme-hotkey"
import { SessionProvider } from "#/lib/app-context/session"
import { SettingsProvider } from "#/lib/app-context/settings"
import { queryClient } from "#/lib/query-client"

import { SidebarProvider } from "./ui/sidebar"
import { Toaster } from "./ui/sonner"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <SettingsProvider>
          <SessionProvider>
            <IconContext
              value={{
                weight: "duotone",
              }}
            >
              <SidebarProvider>{children}</SidebarProvider>
              <ThemeHotkey />
              <Toaster />
            </IconContext>
          </SessionProvider>
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
