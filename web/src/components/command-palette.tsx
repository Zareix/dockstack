import {
  DatabaseIcon,
  ImagesIcon,
  NetworkIcon,
  ShieldCheckIcon,
  ShippingContainerIcon,
  StackIcon,
  UserCircleIcon,
} from "@phosphor-icons/react"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "#/components/ui/command"
import {
  useGetContainers,
  useGetImages,
  useGetNetworks,
  useGetStacks,
  useGetVolumes,
} from "#/lib/api/generated"

type PaletteItem = {
  id: string
  label: string
  value: string
  hint?: string
  icon: ReactNode
  onSelect: () => void
}

type PaletteGroup = {
  heading: string
  items: PaletteItem[]
}

function Group({ group }: { group: PaletteGroup }) {
  if (group.items.length === 0) return null

  return (
    <CommandGroup heading={group.heading}>
      {group.items.map((item) => (
        <CommandItem key={item.id} value={item.value} onSelect={item.onSelect}>
          {item.icon}
          <span className="truncate font-mono">{item.label}</span>
          {item.hint && <span className="truncate text-xs text-muted-foreground">{item.hint}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const stacks = useGetStacks({ query: { enabled: open } })
  const containers = useGetContainers({ query: { enabled: open } })
  const images = useGetImages({ query: { enabled: open } })
  const volumes = useGetVolumes({ query: { enabled: open } })
  const networks = useGetNetworks({ query: { enabled: open } })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return
      event.preventDefault()
      setOpen((current) => !current)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const run = (action: () => void) => {
    setOpen(false)
    action()
  }

  const pages: PaletteGroup = {
    heading: "Pages",
    items: [
      {
        id: "page-stacks",
        label: "Stacks",
        value: "stacks home",
        icon: <StackIcon />,
        onSelect: () => run(() => navigate({ to: "/" })),
      },
      {
        id: "page-containers",
        label: "Containers",
        value: "containers",
        icon: <ShippingContainerIcon />,
        onSelect: () => run(() => navigate({ to: "/containers", search: {} })),
      },
      {
        id: "page-images",
        label: "Images",
        value: "images",
        icon: <ImagesIcon />,
        onSelect: () => run(() => navigate({ to: "/images", search: {} })),
      },
      {
        id: "page-volumes",
        label: "Volumes",
        value: "volumes",
        icon: <DatabaseIcon />,
        onSelect: () => run(() => navigate({ to: "/volumes", search: {} })),
      },
      {
        id: "page-networks",
        label: "Networks",
        value: "networks",
        icon: <NetworkIcon />,
        onSelect: () => run(() => navigate({ to: "/networks", search: {} })),
      },
      {
        id: "page-settings-account",
        label: "Settings — Account",
        value: "settings account",
        icon: <UserCircleIcon />,
        onSelect: () => run(() => navigate({ to: "/settings/account" })),
      },
      {
        id: "page-settings-security",
        label: "Settings — Security",
        value: "settings security",
        icon: <ShieldCheckIcon />,
        onSelect: () => run(() => navigate({ to: "/settings/security" })),
      },
    ],
  }

  const stackGroup: PaletteGroup = {
    heading: "Stacks",
    items: (stacks.data ?? []).map((stack) => ({
      id: `stack-${stack.name}`,
      label: stack.name,
      value: `stack ${stack.name} ${stack.status}`,
      icon: <StackIcon />,
      onSelect: () => run(() => navigate({ to: "/stacks/$name", params: { name: stack.name } })),
    })),
  }

  const containerGroup: PaletteGroup = {
    heading: "Containers",
    items: (containers.data ?? []).map((container) => ({
      id: `container-${container.id}`,
      label: container.name,
      value: ["container", container.name, container.stack, container.serviceName, container.image]
        .filter(Boolean)
        .join(" "),
      hint: container.stack
        ? `${container.stack}${container.serviceName ? ` / ${container.serviceName}` : ""}`
        : container.image,
      icon: <ShippingContainerIcon />,
      onSelect: () => run(() => navigate({ to: "/containers", search: { q: container.name } })),
    })),
  }

  const imageGroup: PaletteGroup = {
    heading: "Images",
    items: (images.data ?? []).map((image) => ({
      id: `image-${image.id}`,
      label: image.tags?.join(", ") || image.id.slice(0, 12),
      value: `image ${image.tags?.join(" ") ?? ""} ${image.id}`,
      hint: image.tags && image.tags.length > 0 ? image.id.slice(0, 12) : undefined,
      icon: <ImagesIcon />,
      onSelect: () =>
        run(() =>
          navigate({
            to: "/images",
            search: image.tags?.[0] ? { q: image.tags[0] } : {},
          }),
        ),
    })),
  }

  const volumeGroup: PaletteGroup = {
    heading: "Volumes",
    items: (volumes.data ?? []).map((volume) => ({
      id: `volume-${volume.name}`,
      label: volume.name,
      value: `volume ${volume.name} ${volume.driver}`,
      hint: volume.driver,
      icon: <DatabaseIcon />,
      onSelect: () => run(() => navigate({ to: "/volumes", search: { q: volume.name } })),
    })),
  }

  const networkGroup: PaletteGroup = {
    heading: "Networks",
    items: (networks.data ?? []).map((network) => ({
      id: `network-${network.id}`,
      label: network.name,
      value: `network ${network.name} ${network.driver} ${network.scope}`,
      hint: `${network.driver} · ${network.scope}`,
      icon: <NetworkIcon />,
      onSelect: () => run(() => navigate({ to: "/networks", search: { q: network.name } })),
    })),
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search stacks, containers, images, volumes, networks and pages"
    >
      <Command loop>
        <CommandInput placeholder="Search stacks, resources and pages..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <Group group={pages} />
          <Group group={stackGroup} />
          <Group group={containerGroup} />
          <Group group={imageGroup} />
          <Group group={volumeGroup} />
          <Group group={networkGroup} />
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
