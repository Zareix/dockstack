import {
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  ArrowsClockwiseIcon,
  SquareIcon,
} from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { CreateStackButton } from "#/components/stacks/create-stack-dialog"
import { StatusBadge } from "#/components/status-badge"
import { Button } from "#/components/ui/button"
import {
  DataTable,
  type DataTableFeatures,
  FilterableHeader,
  SortableHeader,
} from "#/components/ui/data-table"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip"
import {
  getGetStacksQueryKey,
  useGetStacks,
  usePostStackActionDown,
  usePostStackActionPull,
  usePostStackActionRestart,
  usePostStackActionStop,
  usePostStackActionUp,
} from "#/lib/api/generated/default/default"
import type { Stack } from "#/lib/api/generated/model"

export const Route = createFileRoute("/_private/")({
  component: Home,
})

function StackActions({ name }: { name: string }) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetStacksQueryKey() })

  const upMutation = usePostStackActionUp({
    mutation: {
      onError: (e) => toast.error(e.message),
      onSuccess: () => {
        toast.success(`"${name}" started`)
        invalidate()
      },
    },
  })
  const stopMutation = usePostStackActionStop({
    mutation: {
      onError: (e) => toast.error(e.message),
      onSuccess: () => {
        toast.success(`"${name}" stopped`)
        invalidate()
      },
    },
  })
  const downMutation = usePostStackActionDown({
    mutation: {
      onError: (e) => toast.error(e.message),
      onSuccess: () => {
        toast.success(`"${name}" down`)
        invalidate()
      },
    },
  })
  const restartMutation = usePostStackActionRestart({
    mutation: {
      onError: (e) => toast.error(e.message),
      onSuccess: () => {
        toast.success(`"${name}" restarted`)
        invalidate()
      },
    },
  })
  const pullMutation = usePostStackActionPull({
    mutation: {
      onError: (e) => toast.error(e.message),
      onSuccess: () => {
        toast.success(`"${name}" pulled`)
        invalidate()
      },
    },
  })

  const anyPending =
    upMutation.isPending ||
    stopMutation.isPending ||
    downMutation.isPending ||
    restartMutation.isPending ||
    pullMutation.isPending

  const actions = [
    { label: "Pull", icon: DownloadIcon, onClick: () => pullMutation.mutate({ name }) },
    { label: "Restart", icon: ArrowsClockwiseIcon, onClick: () => restartMutation.mutate({ name }) },
    { label: "Stop", icon: PauseIcon, onClick: () => stopMutation.mutate({ name }) },
    { label: "Down", icon: SquareIcon, onClick: () => downMutation.mutate({ name }) },
    { label: "Up", icon: PlayIcon, onClick: () => upMutation.mutate({ name }) },
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
                aria-label={label}
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

function Home() {
  const navigate = useNavigate()
  const stacksQuery = useGetStacks({
    query: { refetchInterval: 5000 },
  })

  const columns: ColumnDef<DataTableFeatures, Stack>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} label="Name" />,
      cell: ({ row }) => <span className="font-mono">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <FilterableHeader
          items={[
            { label: "Status", value: "all" },
            { label: "Healthy", value: "healthy" },
            { label: "Running", value: "running" },
            { label: "Down", value: "down" },
            { label: "Stopped", value: "stopped" },
          ]}
          column={column}
          disabled={stacksQuery.isLoading}
        />
      ),
      cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right" data-row-action>
          <StackActions name={row.original.name} />
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="mb-6 flex items-center">
        <h1 className="text-3xl font-bold">Stacks</h1>
        <div className="ml-auto flex items-center gap-2">
          <CreateStackButton />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={stacksQuery.data ?? []}
        isLoading={stacksQuery.isLoading}
        onRowClick={({ name }) => navigate({ to: "/stacks/$name", params: { name } })}
        getRowAriaLabel={({ name }) => `Open stack ${name}`}
      />
    </>
  )
}
