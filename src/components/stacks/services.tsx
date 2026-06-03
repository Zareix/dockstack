import { ContainerActions } from '#/components/containers/container-actions'
import { StatusBadge } from '#/components/stacks/status-badge'
import { Spinner } from '#/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { getStackContainers } from '#/lib/functions'
import { useQuery } from '@tanstack/react-query'

export function StackServices({ stackName }: { stackName: string }) {
  const query = useQuery({
    queryKey: ['stack-services', stackName],
    queryFn: () => getStackContainers({ data: { stackName } }),
    refetchInterval: 5000,
  })

  if (query.isLoading) return <Spinner />
  if (query.error)
    return <p className="text-destructive text-sm">{query.error.message}</p>
  if (!query.data?.length)
    return <p className="text-muted-foreground text-sm">No containers found.</p>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Ports</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {query.data.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-mono text-xs">{c.name}</TableCell>
            <TableCell>
              <StatusBadge status={c.state} />
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {c.status}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {c.ports.length
                ? c.ports.map((p) => (
                    <a
                      key={p.hostPort}
                      href={`http://${p.hostName}:${p.hostPort}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {`${p.hostPort}:${p.containerPort}/${p.protocol}`}
                    </a>
                  ))
                : '—'}
            </TableCell>
            <TableCell className="text-right">
              <ContainerActions container={c} stackName={stackName} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
