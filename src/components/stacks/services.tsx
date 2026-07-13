import { useQuery } from "@tanstack/react-query"

import { getStackContainers } from "#/lib/functions"

import { ContainersTable } from "../containers/table"

export function StackServices({ stackName }: { stackName: string }) {
  const query = useQuery({
    queryKey: ["stacks", stackName, "services"],
    queryFn: () => getStackContainers({ data: { stackName } }),
    refetchInterval: 1000,
  })

  if (query.error) return <p className="text-sm text-destructive">{query.error.message}</p>

  return <ContainersTable data={query.data ?? []} isLoading={query.isLoading} showStack={false} />
}
