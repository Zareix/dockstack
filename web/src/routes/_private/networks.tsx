import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "#/components/status-badge.tsx"
import {
  DataTable,
  type DataTableFeatures,
  FilterableHeader,
  SortableHeader,
} from "#/components/ui/data-table"
import type { NetworkInfo } from "#/lib/api"
import { listNetworks } from "#/lib/api"
export const Route = createFileRoute("/_private/networks")({
  component: NetworksPage,
})

function NetworksPage() {
  const query = useQuery({
    queryKey: ["networks"],
    queryFn: listNetworks,
  })

  const columns: ColumnDef<DataTableFeatures, NetworkInfo>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} label="Name" />,
      cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <FilterableHeader
          items={[
            { label: "Status", value: "all" },
            { label: "In use", value: "in-use" },
            { label: "Unused", value: "unused" },
          ]}
          column={column}
          disabled={query.isLoading}
        />
      ),
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
      accessorKey: "driver",
      header: ({ column }) => <SortableHeader column={column} label="Driver" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.getValue("driver")}</span>
      ),
    },
    {
      accessorKey: "scope",
      header: ({ column }) => <SortableHeader column={column} label="Scope" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.getValue("scope")}</span>
      ),
    },
  ]

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Networks</h1>
      </div>
      <DataTable columns={columns} data={query.data ?? []} isLoading={query.isLoading} />
    </>
  )
}
