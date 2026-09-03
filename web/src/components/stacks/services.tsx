import { useGetStacksNameContainers } from "#/lib/api/generated/default/default.ts"

import { ContainersTable } from "../containers/table"

export function StackServices({ stackName }: { stackName: string }) {
  const query = useGetStacksNameContainers(stackName, {
    query: {
      refetchInterval: 1000,
    },
  })

  if (query.error) return <p className="text-sm text-destructive">{query.error.message}</p>

  return <ContainersTable data={query.data ?? []} isLoading={query.isLoading} showStack={false} />
}
