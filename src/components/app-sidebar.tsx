import { useAuth, useSession } from "@better-auth-ui/react"
import { Link, useLocation } from "@tanstack/react-router"
import type { ValidateLinkOptions } from "@tanstack/react-router"
import { ContainerIcon, DatabaseIcon, ImagesIcon, LayersIcon, NetworkIcon } from "lucide-react"

import { UserButton } from "#/components/auth/user/user-button"
import { useSettings } from "#/hooks/use-settings"
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
} from "@/components/ui/sidebar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

const LINKS: Array<{
  label: string
  linkOptions: ValidateLinkOptions
  icon: React.ReactNode
}> = [
  {
    label: "Stacks",
    linkOptions: { to: "/" },
    icon: <LayersIcon className="size-5" />,
  },
  {
    label: "Containers",
    linkOptions: { to: "/containers" },
    icon: <ContainerIcon className="size-5" />,
  },
  {
    label: "Images",
    linkOptions: { to: "/images" },
    icon: <ImagesIcon className="size-5" />,
  },
  {
    label: "Volumes",
    linkOptions: { to: "/volumes" },
    icon: <DatabaseIcon className="size-5" />,
  },
  {
    label: "Networks",
    linkOptions: { to: "/networks" },
    icon: <NetworkIcon className="size-5" />,
  },
] as const

export function AppSidebar() {
  const { appTitle, instances } = useSettings()
  const { pathname } = useLocation()
  const { authClient } = useAuth()
  const { data: session } = useSession(authClient)
  const { isMobile, toggleSidebar } = useSidebar()

  const toggleSidebarOnMobile = () => (isMobile ? toggleSidebar() : null)

  if (!session) {
    return null
  }

  return (
    <Sidebar mobileSide="right">
      <SidebarHeader className="flex-row items-center justify-between p-4">
        {instances.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <div className="flex w-full cursor-default items-center gap-2 text-xl font-semibold" />
              }
            >
              {appTitle}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Other Instances</DropdownMenuLabel>
                {instances
                  .filter((instance) => !instance.isCurrent)
                  .map((instance, index) => (
                    <DropdownMenuItem key={index} render={<a href={instance.url} />}>
                      {instance.title}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            to="/"
            onClick={toggleSidebarOnMobile}
            className="flex items-center gap-2 text-xl font-semibold"
          >
            {appTitle}
          </Link>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {LINKS.map((l, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuButton
                    render={<Link {...l.linkOptions} onClick={toggleSidebarOnMobile} />}
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
