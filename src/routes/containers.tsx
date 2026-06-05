import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import type { ContainerInfo } from '#/lib/docker'
import type { ColumnDef } from '@tanstack/react-table'
import { ContainerActions } from '#/components/containers/container-actions'
import { PruneContainersButton } from '#/components/containers/prune-containers-button'
import { StatusBadge } from '#/components/stacks/status-badge'
import { DataTable, SortableHeader } from '#/components/ui/data-table'
import { listAllContainers } from '#/lib/functions'
import { ensureSession } from '#/lib/functions/auth'

export const Route = createFileRoute('/containers')({
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
  component: ContainersPage,
})

const columns: ColumnDef<ContainerInfo>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <SortableHeader column={column} label="Name" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue('name')}</span>
    ),
  },
  {
    accessorKey: 'stack',
    header: ({ column }) => <SortableHeader column={column} label="Stack" />,
    cell: ({ row }) => {
      const stack: string | null = row.getValue('stack')
      return stack ? (
        <Link
          to="/stacks/$name"
          params={{ name: stack }}
          className="text-sm hover:underline"
        >
          {stack}
        </Link>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )
    },
    sortingFn: (a, b) => {
      const sa = a.original.stack ?? ''
      const sb = b.original.stack ?? ''
      return sa.localeCompare(sb)
    },
  },
  {
    accessorKey: 'image',
    header: ({ column }) => <SortableHeader column={column} label="Image" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm text-muted-foreground">
        {row.getValue('image')}
      </span>
    ),
  },
  {
    accessorKey: 'state',
    header: ({ column }) => <SortableHeader column={column} label="State" />,
    cell: ({ row }) => <StatusBadge status={row.getValue('state')} />,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.getValue('status')}
      </span>
    ),
  },
  {
    accessorKey: 'ports',
    header: 'Ports',
    cell: ({ row }) => {
      const ports: ContainerInfo['ports'] = row.getValue('ports')
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
        '—'
      )
    },
    enableSorting: false,
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <div className="text-right">
        <ContainerActions container={row.original} />
      </div>
    ),
  },
]

function ContainersPage() {
  const query = useQuery({
    queryKey: ['containers'],
    queryFn: listAllContainers,
    refetchInterval: 5000,
  })

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Containers</h1>
        <PruneContainersButton />
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
