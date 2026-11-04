import {
  ArrowCircleUpIcon,
  DownloadIcon,
  DotsThreeIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  ArrowsClockwiseIcon,
  SquareIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { ClientOnly, createFileRoute, useRouter } from "@tanstack/react-router"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import * as v from "valibot"

import { StackActionDialog } from "#/components/stacks/action-dialog"
import { StackFiles } from "#/components/stacks/files"
import { ContainerLogs } from "#/components/stacks/logs"
import { RenameStackDialog } from "#/components/stacks/rename-stack-dialog"
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
} from "#/components/ui/alert-dialog"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu"
import { Spinner } from "#/components/ui/spinner.tsx"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs"
import {
  getGetImagesStaleQueryKey,
  getGetStacksNameContainersQueryKey,
  getGetStacksNameQueryKey,
  getGetStacksQueryKey,
  getGetStacksUpdatesQueryKey,
  getStacksName,
  useDeleteStacksName,
  useGetStacksName,
  useGetStacksUpdates,
  usePostStacks,
} from "#/lib/api/generated"
import { streamStackAction } from "#/lib/api/sse"

const tabSchema = v.object({
  tab: v.optional(v.picklist(["services", "files", "logs", "terminal"]), "files"),
})

export const Route = createFileRoute("/_private/stacks/$name")({
  validateSearch: tabSchema,
  async beforeLoad({ params: { name } }) {
    return {
      stackExists: await getStacksName(name).then(
        () => true,
        () => false,
      ),
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

  const createMutation = usePostStacks({
    mutation: {
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success(`Stack ${name} created`)
        router.invalidate()
        queryClient.invalidateQueries({ queryKey: getGetStacksQueryKey() })
      },
    },
  })

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <h2 className="text-xl font-semibold">Stack "{name}" doesn't exist</h2>
      <p className="text-muted-foreground">Want to create it?</p>
      <Button
        onClick={() =>
          createMutation.mutate({
            data: { name },
          })
        }
        disabled={createMutation.isPending}
      >
        {createMutation.isPending ? "Creating..." : `Create "${name}"`}
      </Button>
    </div>
  )
}

function StackDetails({ name }: { name: string }) {
  const { tab } = Route.useSearch()
  const queryClient = useQueryClient()
  const navigate = Route.useNavigate()

  const statusQuery = useGetStacksName(name, {
    query: { refetchInterval: 1000, select: (data) => data.status },
  })
  const updatesQuery = useGetStacksUpdates({
    query: { refetchInterval: 60_000, staleTime: 60_000, retry: 1 },
  })
  const updateAvailable = updatesQuery.data?.[name] === "outdated"
  const [pendingAction, setPendingAction] = useState<"pull" | "restart" | "down" | null>(null)
  const [destroyOpen, setDestroyOpen] = useState(false)
  const isRunning = statusQuery.data
    ? !["stopped", "down", "missing", "unknown"].includes(statusQuery.data)
    : false

  const invalidateStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetStacksNameQueryKey(name) })
    queryClient.invalidateQueries({ queryKey: getGetStacksNameContainersQueryKey(name) })
    queryClient.invalidateQueries({ queryKey: getGetStacksQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetStacksUpdatesQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetImagesStaleQueryKey() })
  }, [queryClient, name])

  const destroyMutation = useDeleteStacksName({
    mutation: {
      onError: (error) => toast.error(error.message),
      onSuccess: () => {
        toast.success(`Stack ${name} destroyed`)
        queryClient.invalidateQueries({ queryKey: getGetStacksQueryKey() })
        navigate({ to: "/" })
      },
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
          <RenameStackDialog
            stackName={name}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                aria-label="Rename stack"
                title="Rename stack"
              >
                <PencilSimpleIcon className="size-4" />
              </Button>
            }
          />
          {statusQuery.data && <StatusBadge status={statusQuery.data} />}
          {updateAvailable && <Badge variant="warning">Update available</Badge>}
          <StackServiceLinks stackName={name} />
        </h2>

        <div className="mt-4 ml-auto flex flex-wrap items-center gap-2 md:mt-0">
          <StackActionDialog
            title={isRunning ? `Deploying ${name}` : `Starting ${name}`}
            action={streamStackAction(name, "up")}
            onDone={invalidateStatus}
          >
            <Button variant={updateAvailable ? "outline" : "default"}>
              <PlayIcon data-icon="inline-start" />
              {isRunning ? "Deploy" : "Start"}
            </Button>
          </StackActionDialog>

          {isRunning && (
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
          )}

          {updateAvailable && (
            <StackActionDialog
              title={`Updating ${name}`}
              action={streamStackAction(name, "update")}
              onDone={invalidateStatus}
            >
              <Button>
                <ArrowCircleUpIcon data-icon="inline-start" />
                Update
              </Button>
            </StackActionDialog>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="More actions"
                  title="More actions"
                >
                  <DotsThreeIcon className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onClick={() => setPendingAction("pull")}>
                <DownloadIcon />
                Pull
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPendingAction("restart")}>
                <ArrowsClockwiseIcon />
                Restart
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPendingAction("down")}>
                <SquareIcon />
                Down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDestroyOpen(true)}>
                <TrashIcon />
                Destroy
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {(["pull", "restart", "down"] as const).map((action) => (
            <StackActionDialog
              key={action}
              title={
                action === "pull"
                  ? `Pulling ${name}`
                  : action === "restart"
                    ? `Restarting ${name}`
                    : `Taking down ${name}`
              }
              action={streamStackAction(name, action)}
              onDone={invalidateStatus}
              open={pendingAction === action}
              onOpenChange={(open) => {
                if (!open) setPendingAction(null)
              }}
            />
          ))}

          <AlertDialog open={destroyOpen} onOpenChange={setDestroyOpen}>
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
                <AlertDialogCancel
                  variant="destructive"
                  onClick={() =>
                    destroyMutation.mutate({
                      name,
                    })
                  }
                >
                  Destroy
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
