import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { ImageActions } from "#/components/images/image-actions"
import { PruneImagesButton } from "#/components/images/prune-images-button"
import { StatusBadge } from "#/components/status-badge"
import {
  DataTable,
  type DataTableFeatures,
  FilterableHeader,
  SortableHeader,
} from "#/components/ui/data-table"
import { Spinner } from "#/components/ui/spinner"
import { useGetImages, useGetImagesStale } from "#/lib/api/generated/default/default.ts"
import type { GetImagesStale200, ImageInfo } from "#/lib/api/generated/model"
export const Route = createFileRoute("/_private/images")({
  component: ImagesPage,
})

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  return `${(bytes / 1e6).toFixed(0)} MB`
}

function StaleCell({
  imageId,
  staleData,
  isLoading,
}: {
  imageId: string
  staleData: GetImagesStale200 | undefined
  isLoading: boolean
}) {
  if (isLoading) return <Spinner className="size-3" />
  if (!staleData) return null
  const status = staleData[imageId]
  if (status === "outdated" || status === "up-to-date") return <StatusBadge status={status} />
  return <span className="text-sm text-muted-foreground">-</span>
}

function ImagesPage() {
  const imagesQuery = useGetImages()

  const staleQuery = useGetImagesStale({
    query: { enabled: !!imagesQuery.data, staleTime: 60_000 },
  })

  const columns: ColumnDef<DataTableFeatures, ImageInfo>[] = [
    {
      accessorKey: "tags",
      header: ({ column }) => <SortableHeader column={column} label="Tag" />,
      cell: ({ row }) => {
        const tags: string[] = row.getValue("tags")
        return (
          <span className="font-mono text-sm">{tags.length > 0 ? tags.join(", ") : "<none>"}</span>
        )
      },
      sortFn: (a, b) => {
        const tagA = a.original.tags?.[0] ?? ""
        const tagB = b.original.tags?.[0] ?? ""
        return tagA.localeCompare(tagB)
      },
    },
    {
      accessorKey: "id",
      header: ({ column }) => <SortableHeader column={column} label="ID" />,
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">{row.getValue("id")}</span>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => staleQuery.data?.[row.id] ?? null,
      header: ({ column }) => (
        <FilterableHeader
          items={[
            { label: "Status", value: "all" },
            { label: "Outdated", value: "outdated" },
            { label: "Up to date", value: "up-to-date" },
            { label: "Unknown", value: "unknown" },
          ]}
          column={column}
          disabled={staleQuery.isLoading}
        />
      ),
      cell: ({ row }) => (
        <StaleCell
          imageId={row.original.id}
          staleData={staleQuery.data ?? {}}
          isLoading={staleQuery.isLoading}
        />
      ),
    },
    {
      accessorKey: "size",
      header: ({ column }) => <SortableHeader column={column} label="Size" />,
      cell: ({ row }) => <span className="text-sm">{formatSize(row.getValue("size"))}</span>,
    },
    {
      accessorKey: "created",
      header: ({ column }) => <SortableHeader column={column} label="Created" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date((row.getValue("created") as number) * 1000).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          <ImageActions image={row.original} />
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Images</h1>
        <PruneImagesButton />
      </div>
      <DataTable
        columns={columns}
        data={imagesQuery.data ?? []}
        isLoading={imagesQuery.isLoading}
      />
    </>
  )
}
