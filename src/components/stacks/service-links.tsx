import { useQuery } from "@tanstack/react-query"
import { ExternalLinkIcon, LinkIcon } from "lucide-react"

import { getStackContainers } from "#/lib/functions"

import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

export function StackServiceLinks({ stackName }: { stackName: string }) {
  const query = useQuery({
    queryKey: ["stacks", stackName, "services"],
    queryFn: () => getStackContainers({ data: { stackName } }),
    refetchInterval: 1000,
  })

  const links = (query.data ?? []).flatMap((container) =>
    container.urls.map((url) => ({
      key: `${container.id}-${url}`,
      service: container.serviceName ?? container.name,
      label: url.replace(/^https?:\/\//, ""),
      href: url,
    })),
  )

  if (!links.length) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <LinkIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-64">
        {links.map((link) => (
          <DropdownMenuItem
            key={link.key}
            render={<a href={link.href} target="_blank" rel="noopener noreferrer" />}
          >
            <span className="mr-2 flex flex-col">
              <span className="text-xs text-muted-foreground">{link.service}</span>
              <span>{link.label}</span>
            </span>
            <ExternalLinkIcon className="ml-auto text-muted-foreground" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
