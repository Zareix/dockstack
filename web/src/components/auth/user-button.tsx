import { SignOutIcon, UserCircleIcon } from "@phosphor-icons/react"
import { Link } from "@tanstack/react-router"

import { useSession } from "#/lib/app-context"

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

export function UserButton() {
  const { session } = useSession()
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
          <Button variant="ghost" className="w-full justify-start gap-2">
            <Avatar className="size-6">
              {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium">{user.name}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{user.name}</span>
            <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/settings/$path" params={{ path: "account" }} />}>
          <UserCircleIcon className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/auth/$path" params={{ path: "sign-out" }} />}>
          <SignOutIcon className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
