import { useQuery } from "@tanstack/react-query"

import { ContainerActions } from "#/components/containers/container-actions"
import { StatusBadge } from "#/components/stacks/status-badge"
import { Spinner } from "#/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table"
import { getStackContainers } from "#/lib/functions"

import { ContainersTable } from "../containers/table"

export function StackServices({ stackName }: { stackName: string }) {
  const query = useQuery({
    queryKey: ["stacks", stackName, "services"],
    queryFn: () => getStackContainers({ data: { stackName } }),
    refetchInterval: 5000,
  })

  if (query.isLoading) return <Spinner />
  if (query.error) return <p className="text-sm text-destructive">{query.error.message}</p>
  if (!query.data?.length)
    return <p className="text-sm text-muted-foreground">No containers found.</p>

  return <ContainersTable data={query.data ?? []} isLoading={query.isLoading} showStack={false} />
}
