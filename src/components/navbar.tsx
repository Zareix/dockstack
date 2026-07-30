import { useAuth, useSession } from "@better-auth-ui/react"
import { Link } from "@tanstack/react-router"

import { SidebarTrigger } from "#/components/ui/sidebar"
import { useSettings } from "#/hooks/use-settings"

export const Navbar = () => {
  const { appTitle } = useSettings()
  const { authClient } = useAuth()
  const { data: session } = useSession(authClient)

  if (!session) return null

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between bg-background/50 px-4 py-2 backdrop-blur-lg md:hidden">
      <Link to="/" className="text-lg font-bold">
        {appTitle}
      </Link>
      <SidebarTrigger />
    </nav>
  )
}
