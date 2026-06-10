import { useQuery } from "@tanstack/react-query"
import { Link, createFileRoute, redirect } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"

import { ContainerActions } from "#/components/containers/container-actions"
import { PruneContainersButton } from "#/components/containers/prune-containers-button"
import { ContainersTable } from "#/components/containers/table.tsx"
import { StatusBadge } from "#/components/stacks/status-badge"
import { DataTable, FilterableHeader, SortableHeader } from "#/components/ui/data-table"
import type { ContainerInfo } from "#/lib/docker"
import { listAllContainers } from "#/lib/functions"
import { ensureSession } from "#/lib/functions/auth"

export const Route = createFileRoute("/containers")({
  async beforeLoad({ context: { queryClient }, location }) {
    const session = await ensureSession(queryClient)()
    if (!session) {
      throw redirect({
        to: "/auth/$path",
        params: { path: "sign-in" },
        search: { redirectTo: location.href },
      })
    }
  },
  component: ContainersPage,
})

function ContainersPage() {
  const query = useQuery({
    queryKey: ["containers"],
    queryFn: listAllContainers,
    refetchInterval: 5000,
  })

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Containers</h1>
        <PruneContainersButton />
      </div>
      <ContainersTable data={query.data ?? []} isLoading={query.isLoading} />
    </>
  )
}
