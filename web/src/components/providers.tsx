import { IconContext } from "@phosphor-icons/react"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"

import { useThemeHotkey } from "#/hooks/use-theme-hotkey"
import { SessionProvider, SettingsProvider } from "#/lib/app-context"
import { queryClient } from "#/lib/query-client"

import { SidebarProvider } from "./ui/sidebar"
import { Toaster } from "./ui/sonner"

function ThemeHotkey() {
  useThemeHotkey()
  return null
}

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
            </IconContext>
            <ThemeHotkey />
            <Toaster />
          </SessionProvider>
        </SettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
