import { createFileRoute } from "@tanstack/react-router"
import * as v from "valibot"

import { PruneContainersButton } from "#/components/containers/prune-containers-button"
import { ContainersTable } from "#/components/containers/table.tsx"
import { useGetContainers } from "#/lib/api/generated"

const searchSchema = v.object({
  q: v.optional(v.string()),
})

export const Route = createFileRoute("/_private/containers")({
  validateSearch: searchSchema,
  component: ContainersPage,
})

function ContainersPage() {
  const { q } = Route.useSearch()
  const query = useGetContainers({
    query: { refetchInterval: 5000 },
  })

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Containers</h1>
        <PruneContainersButton />
      </div>
      <ContainersTable
        key={q ?? "all"}
        data={query.data ?? []}
        isLoading={query.isLoading}
        initialFilters={q ? [{ id: "name", value: q }] : undefined}
      />
    </>
  )
}
