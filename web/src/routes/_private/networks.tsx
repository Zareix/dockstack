import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "#/components/status-badge"
import {
  DataTable,
  type DataTableFeatures,
  FilterableHeader,
  SortableHeader,
} from "#/components/ui/data-table"
import { Spinner } from "#/components/ui/spinner"
import { useGetNetworks } from "#/lib/api/generated/default/default"
import type { NetworkInfo } from "#/lib/api/generated/model"

export const Route = createFileRoute("/_private/networks")({
  component: NetworksPage,
})

function NetworksPage() {
  const query = useGetNetworks()

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
      {query.isLoading ? (
        <Spinner />
      ) : query.isError ? (
        <div>{query.error.message}</div>
      ) : (
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isLoading} />
      )}
    </>
  )
}
