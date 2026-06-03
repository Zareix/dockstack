import { ContainerActions } from '#/components/containers/container-actions'
import { StatusBadge } from '#/components/stacks/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { listAllContainers } from '#/lib/functions'
import { ensureSession } from '#/lib/functions/auth'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, redirect } from '@tanstack/react-router'

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

function ContainersPage() {
  const query = useQuery({
    queryKey: ['all-containers'],
    queryFn: listAllContainers,
    refetchInterval: 5000,
  })

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">Containers</h1>
      <Table className="text-base">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Stack</TableHead>
            <TableHead>Image</TableHead>
            <TableHead>State</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ports</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isLoading && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                Loading...
              </TableCell>
            </TableRow>
          )}
          {query.error && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-destructive">
                {query.error.message}
              </TableCell>
            </TableRow>
          )}
          {query.data?.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-sm">{c.name}</TableCell>
              <TableCell className="text-sm">
                {c.stack ? (
                  <Link
                    to="/stacks/$name"
                    params={{ name: c.stack }}
                    className="hover:underline"
                  >
                    {c.stack}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="font-mono text-sm text-muted-foreground">
                {c.image}
              </TableCell>
              <TableCell>
                <StatusBadge status={c.state} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {c.status}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {c.ports.length
                  ? c.ports.map((p) => (
                      <a
                        key={p.hostPort}
                        href={`http://${p.hostName}:${p.hostPort}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:underline"
                      >
                        {p.hostPort}:{p.containerPort}/{p.protocol}
                      </a>
                    ))
                  : '—'}
              </TableCell>
              <TableCell className="text-right">
                <ContainerActions container={c} />
              </TableCell>
            </TableRow>
          ))}
          {query.data?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No containers found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  )
}
