import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "#/components/status-badge.tsx"
import { DataTable, SortableHeader } from "#/components/ui/data-table"
import { PruneVolumesButton } from "#/components/volumes/prune-volumes-button"
import { VolumeActions } from "#/components/volumes/volume-actions"
import type { VolumeInfo } from "#/lib/docker"
import { listVolumes } from "#/lib/functions"
import { ensureSession } from "#/lib/functions/auth"

export const Route = createFileRoute("/volumes")({
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
  component: VolumesPage,
})

const columns: ColumnDef<VolumeInfo>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} label="Name" />,
    cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("name")}</span>,
  },
  {
    accessorKey: "driver",
    header: ({ column }) => <SortableHeader column={column} label="Driver" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.getValue("driver")}</span>
    ),
  },
  {
    accessorKey: "size",
    header: ({ column }) => <SortableHeader column={column} label="Size" />,
    cell: ({ row }) => {
      const size: number = row.getValue("size")
      const label =
        size < 0
          ? "—"
          : size < 1e6
            ? `${(size / 1e3).toFixed(1)} KB`
            : `${(size / 1e6).toFixed(1)} MB`
      return <span className="text-sm text-muted-foreground">{label}</span>
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "created",
    header: ({ column }) => <SortableHeader column={column} label="Created" />,
    cell: ({ row }) => {
      const val: string = row.getValue("created")
      return (
        <span className="text-sm text-muted-foreground">
          {val ? new Date(val).toLocaleDateString() : "—"}
        </span>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="text-right">
        <VolumeActions volume={row.original} />
      </div>
    ),
  },
]

function VolumesPage() {
  const query = useQuery({
    queryKey: ["volumes"],
    queryFn: listVolumes,
  })

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Volumes</h1>
        <PruneVolumesButton />
      </div>
      <div className="mx-auto md:max-w-4xl">
        <DataTable columns={columns} data={query.data ?? []} isLoading={query.isLoading} />
      </div>
    </>
  )
}
