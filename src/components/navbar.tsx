import { Link } from '@tanstack/react-router'
import { SidebarTrigger } from '#/components/ui/sidebar'
import { useSettings } from '#/hooks/use-settings'

export const Navbar = () => {
  const { appTitle } = useSettings()
  return (
    <nav className="md:hidden sticky z-50 top-0 bg-background/50 backdrop-blur-lg flex justify-between items-center px-4 py-2">
      <Link to="/" className="text-lg font-bold">
        {appTitle}
      </Link>
      <SidebarTrigger />
    </nav>
  )
}
