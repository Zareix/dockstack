import { DesktopIcon, MoonIcon, SignOutIcon, SunIcon, UserCircleIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"
import { useTheme } from "next-themes"

import { useSession } from "#/lib/app-context"

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
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
} from "../ui/dropdown-menu"

export function UserButton() {
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
        nativeButton={false}
        render={
          <Button variant="ghost" className="w-full justify-start gap-2 py-6">
            <Avatar>
              {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="truncate text-start text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
            </div>
          </Button>
        }
      />
      <DropdownMenuContent align="center" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/settings/account" />}>
          <UserCircleIcon className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
