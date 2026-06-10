import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "#/components/status-badge.tsx"
import { DataTable, FilterableHeader, SortableHeader } from "#/components/ui/data-table"
import type { NetworkInfo } from "#/lib/docker"
import { listNetworks } from "#/lib/functions"
import { ensureSession } from "#/lib/functions/auth"

export const Route = createFileRoute("/networks")({
  async beforeLoad({ context: { queryClient }, location }) {
    const session = await ensureSession(queryClient)()
    if (!session) {
      throw redirect({
        to: "/auth/$path",
        params: { path: "sign-in" },
        search: { redirectTo: location.href },
      })
    }
  },
  component: NetworksPage,
})

function NetworksPage() {
  const query = useQuery({
    queryKey: ["networks"],
    queryFn: listNetworks,
  })

  const columns: ColumnDef<NetworkInfo>[] = [
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
      <div className="mx-auto md:max-w-4xl">
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isLoading} />
      </div>
    </>
  )
}
