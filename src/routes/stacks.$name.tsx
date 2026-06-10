import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ClientOnly, createFileRoute, redirect } from "@tanstack/react-router"
import {
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react"
import { useCallback } from "react"
import { toast } from "sonner"
import { z } from "zod"

import { StackActionDialog } from "#/components/stacks/action-dialog"
import { StackFiles } from "#/components/stacks/files"
import { ContainerLogs } from "#/components/stacks/logs"
import { StackServices } from "#/components/stacks/services"
import { StatusBadge } from "#/components/stacks/status-badge"
import { StackTerminal } from "#/components/stacks/terminal"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs"
import {
  getStackStatus,
  stackDestroy,
  streamStackDown,
  streamStackPull,
  streamStackRestart,
  streamStackStop,
  streamStackUp,
} from "#/lib/functions"
import { ensureSession } from "#/lib/functions/auth"

const tabSchema = z.object({
  tab: z.enum(["services", "files", "logs", "terminal"]).default("services"),
})

export const Route = createFileRoute("/stacks/$name")({
  validateSearch: tabSchema,
  async beforeLoad({ context: { queryClient }, location }) {
    const session = await ensureSession(queryClient)()
    if (!session) {
      throw redirect({
        to: "/auth/$path",
        params: { path: "sign-in" },
        search: { redirectTo: location.href },
      })
    }
    return { session }
  },
  component: StackPage,
})

function StackPage() {
  const { name } = Route.useParams()
  const { tab } = Route.useSearch()
  const queryClient = useQueryClient()
  const navigate = Route.useNavigate()

  const statusQuery = useQuery({
    queryKey: ["stacks", name, "status"],
    queryFn: () => getStackStatus({ data: { stackName: name } }),
    refetchInterval: 5000,
  })

  const invalidateStatus = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["stacks", name, "status"] })
    queryClient.invalidateQueries({ queryKey: ["stacks", name, "services"] })
  }, [queryClient, name])

  const destroyMutation = useMutation({
    mutationFn: () => stackDestroy({ data: { stackName: name } }),
    onError: (error) => toast.error(error.message),
    onSuccess: () => {
      toast.success(`Stack ${name} destroyed`)
      queryClient.invalidateQueries({ queryKey: ["stacks"] })
      navigate({ to: "/" })
    },
  })

  return (
    <>
      <header className="items-center gap-3 md:flex">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <span>{name}</span>
          {statusQuery.data && <StatusBadge status={statusQuery.data} />}
        </h2>

        <div className="mt-4 ml-auto flex flex-wrap items-center gap-2 md:mt-0">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="destructive" disabled={destroyMutation.isPending}>
                  <Trash2Icon />
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
            action={() => streamStackPull({ data: { stackName: name } })}
            onDone={invalidateStatus}
          >
            <Button variant="outline">
              <DownloadIcon />
              Pull
            </Button>
          </StackActionDialog>

          <StackActionDialog
            title={`Restarting ${name}`}
            action={() => streamStackRestart({ data: { stackName: name } })}
            onDone={invalidateStatus}
          >
            <Button variant="outline">
              <RefreshCwIcon />
              Restart
            </Button>
          </StackActionDialog>

          <StackActionDialog
            title={`Stopping ${name}`}
            action={() => streamStackStop({ data: { stackName: name } })}
            onDone={invalidateStatus}
          >
            <Button variant="outline">
              <PauseIcon />
              Stop
            </Button>
          </StackActionDialog>

          <StackActionDialog
            title={`Taking down ${name}`}
            action={() => streamStackDown({ data: { stackName: name } })}
            onDone={invalidateStatus}
          >
            <Button variant="outline">
              <SquareIcon />
              Down
            </Button>
          </StackActionDialog>

          <StackActionDialog
            title={`Starting ${name}`}
            action={() => streamStackUp({ data: { stackName: name } })}
            onDone={invalidateStatus}
          >
            <Button>
              <PlayIcon />
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
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <StackServices stackName={name} />
        </TabsContent>
        <TabsContent value="files">
          <ClientOnly>
            <StackFiles stackName={name} />
          </ClientOnly>
        </TabsContent>
        <TabsContent value="logs">
          <ContainerLogs stackName={name} />
        </TabsContent>
        <TabsContent value="terminal" className="flex h-[800px] flex-col">
          <ClientOnly>
            <StackTerminal stackName={name} />
          </ClientOnly>
        </TabsContent>
      </Tabs>
    </>
  )
}
