import {
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  ArrowsClockwiseIcon,
  SquareIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ClientOnly, createFileRoute, redirect, useRouter } from "@tanstack/react-router"
import { useCallback, useEffect } from "react"
import { toast } from "sonner"
import * as v from "valibot"

import { StackActionDialog } from "#/components/stacks/action-dialog"
import { StackFiles } from "#/components/stacks/files"
import { ContainerLogs } from "#/components/stacks/logs"
import { StackServiceLinks } from "#/components/stacks/service-links"
import { StackServices } from "#/components/stacks/services"
import { StackTerminal } from "#/components/stacks/terminal"
import { StatusBadge } from "#/components/status-badge"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "#/components/ui/alert-dialog"
import { Button } from "#/components/ui/button"
import { Spinner } from "#/components/ui/spinner.tsx"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs"
import {
  createStack,
  getSession,
  getStackStatus,
  stackDestroy,
  stackExists,
  streamStackAction,
} from "#/lib/api"
import { queryClient as rootQueryClient } from "#/lib/query-client"

const tabSchema = v.object({
  tab: v.optional(v.picklist(["services", "files", "logs", "terminal"]), "files"),
})

export const Route = createFileRoute("/_private/stacks/$name")({
  validateSearch: tabSchema,
  async beforeLoad({ location, params: { name } }) {
    const session = await rootQueryClient
      .ensureQueryData({
        queryKey: ["session"],
        queryFn: getSession,
        retry: false,
      })
      .catch(() => null)
    if (!session) {
      throw redirect({
        to: "/auth/sign-in",
        search: { redirectTo: location.href },
      })
    }
    return {
      session,
      stackExists: await stackExists(name),
    }
  },
  pendingComponent: () => <Spinner />,
  component: StackPage,
})

function StackPage() {
  const { name } = Route.useParams()
  const { stackExists: exists } = Route.useRouteContext()

  if (!exists) {
    return <StackNotFound name={name} />
  }

  return <StackDetails name={name} />
}

function StackNotFound({ name }: { name: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: () => createStack(name),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(`Stack ${name} created`)
      router.invalidate()
      queryClient.invalidateQueries({ queryKey: ["stacks"] })
    },
  })

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h2 className="text-xl font-semibold">Stack "{name}" doesn't exist</h2>
      <p className="text-muted-foreground">Want to create it?</p>
      <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
        {createMutation.isPending ? "Creating..." : `Create "${name}"`}
      </Button>
    </div>
  )
}

function StackDetails({ name }: { name: string }) {
  const { tab } = Route.useSearch()
  const queryClient = useQueryClient()
  const navigate = Route.useNavigate()

  const statusQuery = useQuery({
    queryKey: ["stacks", name, "status"],
    queryFn: () => getStackStatus(name),
    refetchInterval: 1000,
  })

  const invalidateStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stacks", name, "status"] })
    queryClient.invalidateQueries({ queryKey: ["stacks", name, "services"] })
  }, [queryClient, name])

  const destroyMutation = useMutation({
    mutationFn: () => stackDestroy(name),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(`Stack ${name} destroyed`)
      queryClient.invalidateQueries({ queryKey: ["stacks"] })
      navigate({ to: "/" })
    },
  })

  useEffect(() => {
    if (statusQuery.error) {
      toast.error(statusQuery.error.message)
    }
  }, [statusQuery.error])

  return (
    <>
      <header className="items-center gap-2 md:flex">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <span>{name}</span>
          {statusQuery.data && <StatusBadge status={statusQuery.data} />}
          <StackServiceLinks stackName={name} />
        </h2>

        <div className="mt-4 ml-auto flex flex-wrap items-center gap-2 md:mt-0">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="destructive" disabled={destroyMutation.isPending}>
                  <TrashIcon data-icon="inline-start" />
                  {destroyMutation.isPending ? "Destroying..." : "Destroy"}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Destroy "{name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will run <code>docker compose down</code> and permanently delete all stack
                  files. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogCancel variant="destructive" onClick={() => destroyMutation.mutate()}>
                  Destroy
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <StackActionDialog
            title={`Pulling ${name}`}
            action={streamStackAction(name, "pull")}
            onDone={invalidateStatus}
          >
            <Button variant="outline">
              <DownloadIcon data-icon="inline-start" />
              Pull
            </Button>
          </StackActionDialog>

          <StackActionDialog
            title={`Restarting ${name}`}
            action={streamStackAction(name, "restart")}
            onDone={invalidateStatus}
          >
            <Button variant="outline">
              <ArrowsClockwiseIcon data-icon="inline-start" />
              Restart
            </Button>
          </StackActionDialog>

          <StackActionDialog
            title={`Stopping ${name}`}
            action={streamStackAction(name, "stop")}
            onDone={invalidateStatus}
          >
            <Button variant="outline">
              <PauseIcon data-icon="inline-start" />
              Stop
            </Button>
          </StackActionDialog>

          <StackActionDialog
            title={`Taking down ${name}`}
            action={streamStackAction(name, "down")}
            onDone={invalidateStatus}
          >
            <Button variant="outline">
              <SquareIcon data-icon="inline-start" />
              Down
            </Button>
          </StackActionDialog>

          <StackActionDialog
            title={`Starting ${name}`}
            action={streamStackAction(name, "up")}
            onDone={invalidateStatus}
          >
            <Button>
              <PlayIcon data-icon="inline-start" />
              Up
            </Button>
          </StackActionDialog>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => navigate({ search: { tab: value as typeof tab } })}
        className="mt-4"
      >
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          {tab === "files" && (
            <ClientOnly>
              <StackFiles stackName={name} />
            </ClientOnly>
          )}
        </TabsContent>
        <TabsContent value="services">
          {tab === "services" && <StackServices stackName={name} />}
        </TabsContent>
        <TabsContent value="logs">
          {tab === "logs" && <ContainerLogs stackName={name} />}
        </TabsContent>
        <TabsContent value="terminal" className="flex h-200 flex-col">
          {tab === "terminal" && (
            <ClientOnly>
              <StackTerminal stackName={name} />
            </ClientOnly>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
