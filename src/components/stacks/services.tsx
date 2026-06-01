import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import type { ContainerInfo } from '#/lib/functions'
import {
  containerRemove,
  containerRestart,
  containerStart,
  containerStop,
  getStackContainers,
} from '#/lib/functions'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PlayIcon, RefreshCwIcon, SquareIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

const stateVariant: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  running: 'default',
  exited: 'destructive',
  paused: 'secondary',
  restarting: 'secondary',
}

function ContainerActions({
  container,
  stackName,
}: {
  container: ContainerInfo
  stackName: string
}) {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['stack-status', stackName] })
    queryClient.invalidateQueries({ queryKey: ['stack-services', stackName] })
  }

  const startM = useMutation({
    mutationFn: () => containerStart({ data: { id: container.id } }),
    onSuccess: () => {
      toast.success(`${container.name} started`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const stopM = useMutation({
    mutationFn: () => containerStop({ data: { id: container.id } }),
    onSuccess: () => {
      toast.success(`${container.name} stopped`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const restartM = useMutation({
    mutationFn: () => containerRestart({ data: { id: container.id } }),
    onSuccess: () => {
      toast.success(`${container.name} restarted`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })
  const removeM = useMutation({
    mutationFn: () => containerRemove({ data: { id: container.id } }),
    onSuccess: () => {
      toast.success(`${container.name} removed`)
      invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const busy =
    startM.isPending ||
    stopM.isPending ||
    restartM.isPending ||
    removeM.isPending
  const running = container.state === 'running'

  return (
    <div className="flex items-center gap-1">
      {running ? (
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={busy}
          onClick={() => stopM.mutate()}
          title="Stop"
        >
          <SquareIcon size={14} />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={busy}
          onClick={() => startM.mutate()}
          title="Start"
        >
          <PlayIcon size={14} />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        disabled={busy || !running}
        onClick={() => restartM.mutate()}
        title="Restart"
      >
        <RefreshCwIcon size={14} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7 text-destructive hover:text-destructive"
        disabled={busy}
        onClick={() => removeM.mutate()}
        title="Remove"
      >
        <Trash2Icon size={14} />
      </Button>
    </div>
  )
}

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
              <Badge variant={stateVariant[c.state] ?? 'outline'}>
                {c.state}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {c.status}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {c.ports.length
                ? c.ports.map((p) => (
                    <a
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
