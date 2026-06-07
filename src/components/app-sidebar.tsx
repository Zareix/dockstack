import { Link, useLocation } from '@tanstack/react-router'
import { ContainerIcon, ImagesIcon, LayersIcon } from 'lucide-react'
import { useAuth, useSession } from '@better-auth-ui/react'
import type { ValidateLinkOptions } from '@tanstack/react-router'
import { UserButton } from '#/components/auth/user/user-button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { useSettings } from '#/hooks/use-settings'

const LINKS: Array<{
  label: string
  linkOptions: ValidateLinkOptions
  icon: React.ReactNode
}> = [
  {
    label: 'Stacks',
    linkOptions: { to: '/' },
    icon: <LayersIcon className="size-5" />,
  },
  {
    label: 'Containers',
    linkOptions: { to: '/containers' },
    icon: <ContainerIcon className="size-5" />,
  },
  {
    label: 'Images',
    linkOptions: { to: '/images' },
    icon: <ImagesIcon className="size-5" />,
  },
] as const

export function AppSidebar() {
  const { appTitle } = useSettings()
  const { pathname } = useLocation()
  const { authClient } = useAuth()
  const { data: session } = useSession(authClient)
  const { toggleSidebar } = useSidebar()

  if (!session) {
    return null
  }

  return (
    <Sidebar mobileSide="right">
      <SidebarHeader className="flex-row items-center justify-between p-4">
        <Link
          to="/"
          onClick={() => toggleSidebar()}
          className="flex items-center gap-2 font-semibold text-xl"
        >
          {appTitle}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {LINKS.map((l, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuButton
                    render={
                      <Link
                        {...l.linkOptions}
                        onClick={() => toggleSidebar()}
                      />
                    }
                    isActive={l.linkOptions.to === pathname}
                  >
                    {l.icon}
                    {l.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserButton />
      </SidebarFooter>
    </Sidebar>
  )
}
