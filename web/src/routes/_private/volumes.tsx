import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { StatusBadge } from "#/components/status-badge.tsx"
import {
  DataTable,
  type DataTableFeatures,
  FilterableHeader,
  SortableHeader,
} from "#/components/ui/data-table"
import { Spinner } from "#/components/ui/spinner.tsx"
import { PruneVolumesButton } from "#/components/volumes/prune-volumes-button"
import { VolumeActions } from "#/components/volumes/volume-actions"
import { useGetVolumes } from "#/lib/api/generated/default/default"
import type { VolumeInfo } from "#/lib/api/generated/model"
export const Route = createFileRoute("/_private/volumes")({
  component: VolumesPage,
})

function VolumesPage() {
  const volumesQuery = useGetVolumes()

  const columns: ColumnDef<DataTableFeatures, VolumeInfo>[] = [
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
          disabled={volumesQuery.isLoading}
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
      accessorKey: "size",
      header: ({ column }) => <SortableHeader column={column} label="Size" />,
      cell: ({ row }) => {
        const size: number = row.getValue("size")
        const label =
          size < 0
            ? "-"
            : size < 1e6
              ? `${(size / 1e3).toFixed(1)} KB`
              : `${(size / 1e6).toFixed(1)} MB`
        return <span className="text-sm text-muted-foreground">{label}</span>
      },
    },
    {
      accessorKey: "created",
      header: ({ column }) => <SortableHeader column={column} label="Created" />,
      cell: ({ row }) => {
        const val: string = row.getValue("created")
        return (
          <span className="text-sm text-muted-foreground">
            {val ? new Date(val).toLocaleDateString() : "-"}
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

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Volumes</h1>
        <PruneVolumesButton />
      </div>
      {volumesQuery.isLoading ? (
        <Spinner />
      ) : volumesQuery.isError ? (
        <div>Error: {volumesQuery.error.message}</div>
      ) : (
        <DataTable
          columns={columns}
          data={volumesQuery.data ?? []}
          isLoading={volumesQuery.isLoading}
        />
      )}
    </>
  )
}
