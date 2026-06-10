import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { DownloadIcon, PauseIcon, PlayIcon, RefreshCwIcon, SquareIcon } from "lucide-react"
import { toast } from "sonner"

import { CreateStackButton } from "#/components/stacks/create-stack-dialog"
import { StatusBadge } from "#/components/stacks/status-badge"
import { Button } from "#/components/ui/button"
import { DataTable, SortableHeader } from "#/components/ui/data-table"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip"
import { listStacks, stackDown, stackPull, stackRestart, stackStop, stackUp } from "#/lib/functions"
import { ensureSession } from "#/lib/functions/auth"
import type { Stack } from "#/lib/functions/stacks"

export const Route = createFileRoute("/")({
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
  component: Home,
})

function StackActions({ name }: { name: string }) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["stacks"] })

  const upMutation = useMutation({
    mutationFn: () => stackUp({ data: { stackName: name } }),
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      toast.success(`"${name}" started`)
      invalidate()
    },
  })
  const stopMutation = useMutation({
    mutationFn: () => stackStop({ data: { stackName: name } }),
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      toast.success(`"${name}" stopped`)
      invalidate()
    },
  })
  const downMutation = useMutation({
    mutationFn: () => stackDown({ data: { stackName: name } }),
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      toast.success(`"${name}" down`)
      invalidate()
    },
  })
  const restartMutation = useMutation({
    mutationFn: () => stackRestart({ data: { stackName: name } }),
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      toast.success(`"${name}" restarted`)
      invalidate()
    },
  })
  const pullMutation = useMutation({
    mutationFn: () => stackPull({ data: { stackName: name } }),
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      toast.success(`"${name}" pulled`)
      invalidate()
    },
  })

  const anyPending =
    upMutation.isPending ||
    stopMutation.isPending ||
    downMutation.isPending ||
    restartMutation.isPending ||
    pullMutation.isPending

  const actions = [
    { label: "Pull", icon: DownloadIcon, onClick: () => pullMutation.mutate() },
    { label: "Restart", icon: RefreshCwIcon, onClick: () => restartMutation.mutate() },
    { label: "Stop", icon: PauseIcon, onClick: () => stopMutation.mutate() },
    { label: "Down", icon: SquareIcon, onClick: () => downMutation.mutate() },
    { label: "Up", icon: PlayIcon, onClick: () => upMutation.mutate() },
  ]

  return (
    <div className="flex items-center justify-end gap-1">
      {actions.map(({ label, icon: Icon, onClick }) => (
        <Tooltip key={label}>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={onClick}
                disabled={anyPending}
              >
                <Icon className="size-4" />
              </Button>
            }
          />
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

const columns: ColumnDef<Stack>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} label="Name" />,
    cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="text-right" onClick={(e) => e.stopPropagation()}>
        <StackActions name={row.original.name} />
      </div>
    ),
  },
]

function Home() {
  const navigate = useNavigate()
  const stacksQuery = useQuery({
    queryKey: ["stacks"],
    queryFn: listStacks,
  })

  return (
    <>
      <div className="mb-8 flex items-center">
        <h1 className="text-3xl font-bold">Stacks</h1>
        <div className="ml-auto flex items-center gap-2">
          <CreateStackButton />
        </div>
      </div>
      <div className="mx-auto md:max-w-4xl">
        <DataTable
          columns={columns}
          data={stacksQuery.data ?? []}
          isLoading={stacksQuery.isLoading}
          onRowClick={({ name }) => navigate({ to: "/stacks/$name", params: { name } })}
        />
      </div>
    </>
  )
}
