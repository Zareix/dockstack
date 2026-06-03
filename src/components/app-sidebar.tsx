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
} from '@/components/ui/sidebar'
import { Link, useLocation } from '@tanstack/react-router'
import { ContainerIcon, ImagesIcon, LayersIcon } from 'lucide-react'

const LINKS = [
  {
    label: 'Stacks',
    path: '/',
    icon: <LayersIcon className="size-5" />,
  },
  {
    label: 'Containers',
    path: '/containers',
    icon: <ContainerIcon className="size-5" />,
  },
  {
    label: 'Images',
    path: '/images',
    icon: <ImagesIcon className="size-5" />,
  },
]

export function AppSidebar() {
  const { pathname } = useLocation()
  return (
    <Sidebar>
      <SidebarHeader className="flex-row items-center justify-between p-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-xl">
          Dockstack
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {LINKS.map((l) => (
                <SidebarMenuItem key={l.path}>
                  <SidebarMenuButton
                    render={<Link to={l.path} />}
                    isActive={l.path === pathname}
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
