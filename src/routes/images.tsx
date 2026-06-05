import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import type { ImageInfo } from '#/lib/docker'
import type { ColumnDef } from '@tanstack/react-table'
import { ImageActions } from '#/components/images/image-actions'
import { PruneImagesButton } from '#/components/images/prune-images-button'
import { DataTable, SortableHeader } from '#/components/ui/data-table'
import { listImages } from '#/lib/functions'
import { ensureSession } from '#/lib/functions/auth'

export const Route = createFileRoute('/images')({
  async beforeLoad({ context: { queryClient }, location }) {
    const session = await ensureSession(queryClient)()
    if (!session) {
      throw redirect({
        to: '/auth/$path',
        params: { path: 'sign-in' },
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

const columns: ColumnDef<ImageInfo>[] = [
  {
    accessorKey: 'tags',
    header: ({ column }) => <SortableHeader column={column} label="Tag" />,
    cell: ({ row }) => {
      const tags: string[] = row.getValue('tags')
      return (
        <span className="font-mono text-sm">
          {tags.length > 0 ? tags.join(', ') : '<none>'}
        </span>
      )
    },
    sortingFn: (a, b) => {
      const tagA = a.original.tags[0] ?? ''
      const tagB = b.original.tags[0] ?? ''
      return tagA.localeCompare(tagB)
    },
  },
  {
    accessorKey: 'id',
    header: ({ column }) => <SortableHeader column={column} label="ID" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">
        {row.getValue('id')}
      </span>
    ),
  },
  {
    accessorKey: 'size',
    header: ({ column }) => <SortableHeader column={column} label="Size" />,
    cell: ({ row }) => (
      <span className="text-sm">{formatSize(row.getValue('size'))}</span>
    ),
  },
  {
    accessorKey: 'created',
    header: ({ column }) => <SortableHeader column={column} label="Created" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {new Date(row.getValue('created') * 1000).toLocaleDateString()}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <div className="text-right">
        <ImageActions image={row.original} />
      </div>
    ),
  },
]

function ImagesPage() {
  const query = useQuery({
    queryKey: ['images'],
    queryFn: listImages,
  })

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Images</h1>
        <PruneImagesButton />
      </div>
      <div className="container mx-auto">
        <DataTable
          columns={columns}
          data={query.data ?? []}
          isLoading={query.isLoading}
        />
      </div>
    </>
  )
}
