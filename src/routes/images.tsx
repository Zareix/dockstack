import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import type { ColumnDef, Table } from "@tanstack/react-table"

import { ImageActions } from "#/components/images/image-actions"
import { PruneImagesButton } from "#/components/images/prune-images-button"
import { StatusBadge } from "#/components/status-badge.tsx"
import { DataTable, SortableHeader } from "#/components/ui/data-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import { Spinner } from "#/components/ui/spinner"
import type { ImageInfo, StaleStatus } from "#/lib/docker"
import { checkImagesStale, listImages } from "#/lib/functions"
import { ensureSession } from "#/lib/functions/auth"

export const Route = createFileRoute("/images")({
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
  staleData: Record<string, StaleStatus> | undefined
  isLoading: boolean
}) {
  if (isLoading) return <Spinner className="size-3" />
  if (!staleData) return null
  const status = staleData[imageId]
  if (status === "outdated" || status === "up-to-date") return <StatusBadge status={status} />
  return <span className="text-sm text-muted-foreground">—</span>
}

function StatusFilter({ table, disabled }: { table: Table<ImageInfo>; disabled: boolean }) {
  const column = table.getColumn("status")
  const current = (column?.getFilterValue() as StaleStatus | undefined) ?? "all"

  const items = [
    { label: "All", value: "all" },
    { label: "Outdated", value: "outdated" },
    { label: "Up to date", value: "up-to-date" },
    { label: "Unknown", value: "unknown" },
  ]

  return (
    <div className="mb-4">
      <label className="text-sm text-muted-foreground">Status</label>
      <Select
        value={current}
        onValueChange={(v) => column?.setFilterValue(v === "all" ? undefined : v)}
        disabled={disabled}
        items={items}
      >
        <SelectTrigger size="sm" className="w-30">
          <SelectValue placeholder="Filter status" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ImagesPage() {
  const imagesQuery = useQuery({
    queryKey: ["images"],
    queryFn: listImages,
  })

  const staleQuery = useQuery({
    queryKey: ["images-stale"],
    queryFn: checkImagesStale,
    enabled: !!imagesQuery.data,
    staleTime: 60_000,
  })

  const columns: ColumnDef<ImageInfo>[] = [
    {
      accessorKey: "tags",
      header: ({ column }) => <SortableHeader column={column} label="Tag" />,
      cell: ({ row }) => {
        const tags: string[] = row.getValue("tags")
        return (
          <span className="font-mono text-sm">{tags.length > 0 ? tags.join(", ") : "<none>"}</span>
        )
      },
      sortingFn: (a, b) => {
        const tagA = a.original.tags[0] ?? ""
        const tagB = b.original.tags[0] ?? ""
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
      accessorKey: "size",
      header: ({ column }) => <SortableHeader column={column} label="Size" />,
      cell: ({ row }) => <span className="text-sm">{formatSize(row.getValue("size"))}</span>,
    },
    {
      accessorKey: "created",
      header: ({ column }) => <SortableHeader column={column} label="Created" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(
            // @ts-ignore It's typed as a number, but the ts can't infer the actual value
            row.getValue("created") * 1000,
          ).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => staleQuery.data?.[row.id] ?? null,
      header: ({ column }) => <SortableHeader column={column} label="Status" />,
      cell: ({ row }) => (
        <StaleCell
          imageId={row.original.id}
          staleData={staleQuery.data}
          isLoading={staleQuery.isLoading}
        />
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
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Images</h1>
        <PruneImagesButton />
      </div>
      <div className="mx-auto md:max-w-4xl">
        <DataTable
          columns={columns}
          data={imagesQuery.data ?? []}
          isLoading={imagesQuery.isLoading}
          toolbar={(table: Table<ImageInfo>) => (
            <StatusFilter table={table} disabled={staleQuery.isLoading} />
          )}
        />
      </div>
    </>
  )
}
