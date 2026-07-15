import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import type { ContainerInfo } from "#/lib/docker/index.ts"

import { StatusBadge } from "../status-badge"
import { DataTable, FilterableHeader, SortableHeader } from "../ui/data-table"
import { ContainerActions } from "./container-actions"

type Props = {
  showStack?: boolean
  data: ContainerInfo[]
  isLoading: boolean
}

export const ContainersTable = ({ data, isLoading, showStack = true }: Props) => {
  const columns: (ColumnDef<ContainerInfo> | false)[] = [
    !showStack && {
      accessorKey: "serviceName",
      header: ({ column }) => <SortableHeader column={column} label="Service" />,
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("serviceName")}</span>,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} label="Name" />,
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("name")}</span>,
    },
    showStack && {
      accessorKey: "stack",
      header: ({ column }) => <SortableHeader column={column} label="Stack" />,
      cell: ({ row }) => {
        const stack: string | null = row.getValue("stack")
        return stack ? (
          <Link to="/stacks/$name" params={{ name: stack }} className="text-sm hover:underline">
            {stack}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )
      },
      sortingFn: (a, b) => a.original.stack?.localeCompare(b.original.stack ?? "") ?? 0,
    },
    {
      accessorKey: "image",
      header: ({ column }) => <SortableHeader column={column} label="Image" />,
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">{row.getValue("image")}</span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <FilterableHeader
          items={[
            { label: "Status", value: "all" },
            { label: "Running", value: "running" },
            { label: "Stopped", value: "stopped" },
          ]}
          column={column}
          disabled={isLoading}
        />
      ),
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
      accessorKey: "uptime",
      header: ({ column }) => <SortableHeader column={column} label="Uptime" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.getValue("uptime")}</span>
      ),
    },
    {
      accessorKey: "ports",
      header: "Ports",
      cell: ({ row }) => {
        const ports: ContainerInfo["ports"] = row.getValue("ports")
        return ports.length ? (
          <div className="font-mono text-sm">
            {ports.map((p) => (
              <a
                key={p.hostPort}
                href={`http://${p.hostName}:${p.hostPort}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:underline"
              >
                {p.hostPort}:{p.containerPort}/{p.protocol}
              </a>
            ))}
          </div>
        ) : (
          "-"
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: "urls",
      header: "URLs",
      cell: ({ row }) => {
        const urls: ContainerInfo["urls"] = row.getValue("urls")
        return urls.length ? (
          <div className="font-mono text-sm">
            {urls.map((u) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:underline"
              >
                {u.replace("https://", "")}
              </a>
            ))}
          </div>
        ) : (
          "-"
        )
      },
      enableSorting: false,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          <ContainerActions container={row.original} />
        </div>
      ),
    },
  ]
  return <DataTable columns={columns.filter(Boolean)} data={data} isLoading={isLoading} />
}
