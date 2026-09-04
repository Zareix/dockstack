import {
  ShippingContainerIcon,
  DatabaseIcon,
  DesktopIcon,
  ImagesIcon,
  MoonIcon,
  NetworkIcon,
  SignOutIcon,
  StackIcon,
  SunIcon,
  UserCircleIcon,
} from "@phosphor-icons/react"
import { Link, useLocation } from "@tanstack/react-router"
import type { ValidateLinkOptions } from "@tanstack/react-router"
import { useTheme } from "next-themes"

import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar"
import { Button } from "#/components/ui/button"
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
import { useGetStacks } from "#/lib/api/generated/default/default.ts"
import { useSession } from "#/lib/app-context/session"
import { useSettings } from "#/lib/app-context/settings"
import { cn } from "#/lib/utils"

import type { AuthUserResponse } from "../lib/api/generated/model"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

const RESOURCES_LINKS: Array<{
  label: string
  linkOptions: ValidateLinkOptions
  icon: React.ReactNode
}> = [
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
  const settings = useSettings()
  const { pathname, search } = useLocation()
  const { isAuthenticated } = useSession()
  const { isMobile, toggleSidebar } = useSidebar()
  const stacksQuery = useGetStacks()

  const toggleSidebarOnMobile = () => (isMobile ? toggleSidebar() : null)
  const otherInstancePathname = pathname.includes("/stacks") ? "/" : pathname

  if (!isAuthenticated || !settings) {
    return null
  }

  const { appTitle, instanceName, instances } = settings
  const otherInstances = instances ?? []

  return (
    <Sidebar mobileSide="right">
      <SidebarHeader className="p-4">
        {otherInstances.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton={false}
              render={<div className="flex w-full cursor-default flex-col gap-0" />}
            >
              <p className="text-xl font-semibold">{appTitle}</p>
              {instanceName && <p className="text-sm text-muted-foreground">{instanceName}</p>}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Other Instances</DropdownMenuLabel>
                {otherInstances
                  .filter((instance) => !instance.isCurrent)
                  .map((instance, index) => (
                    <DropdownMenuItem
                      key={index}
                      render={
                        <a
                          href={instance.url + otherInstancePathname}
                          aria-label={instance.title}
                        />
                      }
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
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
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

function UserIdentity({
  user,
  initials,
  size = "default",
  truncate = false,
}: {
  user: Pick<AuthUserResponse, "name" | "email" | "avatar">
  initials: string
  size?: "default" | "lg"
  truncate?: boolean
}) {
  return (
    <>
      <Avatar size={size}>
        {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div>
        <div
          className={cn("text-sm font-medium text-foreground", truncate && "truncate text-start")}
        >
          {user.name}
        </div>
        <div className={cn("text-xs font-normal text-muted-foreground", truncate && "truncate")}>
          {user.email}
        </div>
      </div>
    </>
  )
}

function UserButton() {
  const { session } = useSession()
  const { theme = "system", setTheme } = useTheme()
  const user = session?.user

  if (!user) return null

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="w-full justify-start gap-2 py-6">
            <UserIdentity user={user} initials={initials} truncate />
          </Button>
        }
      />
      <DropdownMenuContent align="center" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2">
            <UserIdentity user={user} initials={initials} size="lg" />
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/settings/account" />}>
          <UserCircleIcon className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SunIcon className="size-4" />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value)}>
              <DropdownMenuRadioItem value="system">
                <DesktopIcon className="size-4" />
                System
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="light">
                <SunIcon className="size-4" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <MoonIcon className="size-4" />
                Dark
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/auth/sign-out" />}>
          <SignOutIcon className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
