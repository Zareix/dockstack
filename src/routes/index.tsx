import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import {
  DownloadIcon,
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  SquareIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CreateStackButton } from "#/components/stacks/create-stack-dialog"
import { StatusBadge } from "#/components/stacks/status-badge"
import { Button } from "#/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table"
import { listStacks, stackDown, stackPull, stackRestart, stackStop, stackUp } from "#/lib/functions"
import { ensureSession } from "#/lib/functions/auth"

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => upMutation.mutate()} disabled={anyPending}>
          <PlayIcon /> Up
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => stopMutation.mutate()} disabled={anyPending}>
          <PauseIcon /> Stop
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downMutation.mutate()} disabled={anyPending}>
          <SquareIcon /> Down
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => restartMutation.mutate()} disabled={anyPending}>
          <RefreshCwIcon /> Restart
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => pullMutation.mutate()} disabled={anyPending}>
          <DownloadIcon /> Pull
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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

      <Table className="text-base">
        <TableHeader>
          <TableRow>
            <TableHead className="w-3/4">Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {stacksQuery.isLoading && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
          )}
          {stacksQuery.error && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-destructive">
                {stacksQuery.error.message}
              </TableCell>
            </TableRow>
          )}
          {stacksQuery.data?.map(({ name, status }) => (
            <TableRow
              key={name}
              className="cursor-pointer"
              onClick={() =>
                navigate({
                  to: "/stacks/$name",
                  params: { name },
                })
              }
            >
              <TableCell className="font-medium">{name}</TableCell>
              <TableCell>
                <StatusBadge status={status} />
              </TableCell>
              <TableCell className="w-px" onClick={(e) => e.stopPropagation()}>
                <StackActions name={name} />
              </TableCell>
            </TableRow>
          ))}
          {stacksQuery.data?.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                No stacks found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  )
}
