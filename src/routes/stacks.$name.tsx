import { BackButton } from '#/components/back'
import { ContainerLogs } from '#/components/container-logs'
import { StackFiles } from '#/components/stacks/files'
import { StackServices } from '#/components/stacks/services'
import { StatusBadge } from '#/components/stacks/status-badge'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  getStackStatus,
  stackDestroy,
  stackDown,
  stackPull,
  stackRestart,
  stackStop,
  stackUp,
} from '#/lib/functions'
import { ensureSession } from '#/lib/functions/auth'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import {
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  SquareIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/stacks/$name')({
  async beforeLoad({ context: { queryClient }, location }) {
    const session = await ensureSession(queryClient)()
    if (!session) {
      throw redirect({
        to: '/auth/$path',
        params: { path: 'sign-in' },
        search: { redirectTo: location.href },
      })
    }
    return { session }
  },
  component: StackPage,
})

function StackPage() {
  const { name } = Route.useParams()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const statusQuery = useQuery({
    queryKey: ['stack-status', name],
    queryFn: () => getStackStatus({ data: { stackName: name } }),
    refetchInterval: 5000,
  })

  const invalidateStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['stack-status', name] })
    queryClient.invalidateQueries({ queryKey: ['stack-services', name] })
  }

  const upMutation = useMutation({
    mutationFn: () => stackUp({ data: { stackName: name } }),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(`"${name}" started`)
      invalidateStatus()
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => stackStop({ data: { stackName: name } }),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(`"${name}" stopped`)
      invalidateStatus()
    },
  })

  const downMutation = useMutation({
    mutationFn: () => stackDown({ data: { stackName: name } }),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(`"${name}" down`)
      invalidateStatus()
    },
  })

  const restartMutation = useMutation({
    mutationFn: () => stackRestart({ data: { stackName: name } }),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(`"${name}" restarted`)
      invalidateStatus()
    },
  })

  const pullMutation = useMutation({
    mutationFn: () => stackPull({ data: { stackName: name } }),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(`"${name}" pulled`)
      invalidateStatus()
    },
  })

  const destroyMutation = useMutation({
    mutationFn: () => stackDestroy({ data: { stackName: name } }),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(`Stack "${name}" destroyed`)
      queryClient.invalidateQueries({ queryKey: ['stacks'] })
      navigate({ to: '/' })
    },
  })

  const anyPending =
    upMutation.isPending ||
    stopMutation.isPending ||
    downMutation.isPending ||
    restartMutation.isPending ||
    pullMutation.isPending ||
    destroyMutation.isPending

  return (
    <>
      <BackButton />
      <header className="md:flex items-center gap-3">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span>{name}</span>
          {statusQuery.data && <StatusBadge status={statusQuery.data} />}
        </h2>

        <div className="ml-auto mt-4 md:mt-0 flex flex-wrap items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="destructive" disabled={anyPending}>
                  <Trash2Icon />
                  {destroyMutation.isPending ? 'Destroying...' : 'Destroy'}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Destroy "{name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will run <code>docker compose down</code> and permanently
                  delete all stack files. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogCancel
                  variant="destructive"
                  onClick={() => destroyMutation.mutate()}
                >
                  Destroy
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            onClick={() => pullMutation.mutate()}
            disabled={anyPending}
          >
            <DownloadIcon />
            {pullMutation.isPending ? 'Pulling...' : 'Pull'}
          </Button>
          <Button
            variant="outline"
            onClick={() => restartMutation.mutate()}
            disabled={anyPending}
          >
            <RefreshCwIcon />
            {restartMutation.isPending ? 'Restarting...' : 'Restart'}
          </Button>
          <Button
            variant="outline"
            onClick={() => stopMutation.mutate()}
            disabled={anyPending}
          >
            <PauseIcon />
            {stopMutation.isPending ? 'Stopping...' : 'Stop'}
          </Button>
          <Button
            variant="outline"
            onClick={() => downMutation.mutate()}
            disabled={anyPending}
          >
            <SquareIcon />
            {downMutation.isPending ? 'Downing...' : 'Down'}
          </Button>
          <Button onClick={() => upMutation.mutate()} disabled={anyPending}>
            <PlayIcon />
            {upMutation.isPending ? 'Starting...' : 'Up'}
          </Button>
        </div>
      </header>

      <Tabs defaultValue="services" className="mt-4">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <StackServices stackName={name} />
        </TabsContent>
        <TabsContent value="files">
          <StackFiles stackName={name} />
        </TabsContent>
        <TabsContent value="logs">
          <ContainerLogs stackName={name} />
        </TabsContent>
      </Tabs>
    </>
  )
}
