import { useAuth, useSession } from "@better-auth-ui/react"
import {
  ShippingContainerIcon,
  DatabaseIcon,
  ImagesIcon,
  StackIcon,
  NetworkIcon,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { Link, useLocation } from "@tanstack/react-router"
import type { ValidateLinkOptions } from "@tanstack/react-router"

import { UserButton } from "#/components/auth/user/user-button"
import { ScrollArea } from "#/components/ui/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "#/components/ui/sidebar"
import { useSettings } from "#/hooks/use-settings"

import { listStacks } from "../lib/functions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

const RESOURCES_LINKS: Array<{
  label: string
  linkOptions: ValidateLinkOptions
  icon: React.ReactNode
}> = [
  // {
  //   label: "Stacks",
  //   linkOptions: { to: "/" },
  //   icon: <StackIcon className="size-5" />,
  // },
  {
    label: "Containers",
    linkOptions: { to: "/containers" },
    icon: <ShippingContainerIcon className="size-5" />,
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
  const { pathname, search } = useLocation()
  const { authClient } = useAuth()
  const { data: session } = useSession(authClient)
  const { isMobile, toggleSidebar } = useSidebar()
  const stacksQuery = useQuery({
    queryKey: ["stacks"],
    queryFn: listStacks,
  })

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
              nativeButton={false}
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
                    <DropdownMenuItem
                      key={index}
                      render={<a href={instance.url} aria-label={instance.title} />}
                    >
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
      <SidebarContent className="gap-0">
        <SidebarGroup>
          <SidebarGroupLabel>Stacks</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/"}
                  render={
                    <Link to="/" onClick={toggleSidebarOnMobile}>
                      <StackIcon className="size-5" />
                      Stacks
                    </Link>
                  }
                />
              </SidebarMenuItem>
              <ScrollArea>
                <div className="max-h-52">
                  {stacksQuery.data && stacksQuery.data.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">No stacks yet</p>
                  ) : (
                    <SidebarMenuSub className="gap-0.5">
                      {stacksQuery.data?.map((item) => (
                        <SidebarMenuSubItem key={item.name}>
                          <SidebarMenuSubButton
                            isActive={pathname.split("?")[0] === `/stacks/${item.name}`}
                            size="sm"
                            className="font-mono"
                            render={
                              <Link
                                to="/stacks/$name"
                                params={{ name: item.name }}
                                search={{
                                  tab: search.tab,
                                }}
                                onClick={toggleSidebarOnMobile}
                              >
                                {item.name}
                              </Link>
                            }
                          />
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </div>
              </ScrollArea>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Ressources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {RESOURCES_LINKS.map((l, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuButton
                    render={
                      <Link
                        {...l.linkOptions}
                        aria-label={l.label}
                        onClick={toggleSidebarOnMobile}
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
