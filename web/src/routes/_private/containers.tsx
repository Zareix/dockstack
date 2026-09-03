import { createFileRoute } from "@tanstack/react-router"

import { PruneContainersButton } from "#/components/containers/prune-containers-button"
import { ContainersTable } from "#/components/containers/table.tsx"
import { useGetContainers } from "#/lib/api/generated/default/default.ts"

export const Route = createFileRoute("/_private/containers")({
  component: ContainersPage,
})

function ContainersPage() {
  const query = useGetContainers({
    query: { refetchInterval: 5000 },
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
