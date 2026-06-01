import { listStacks } from '#/lib/functions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { StatusBadge } from '#/components/status-badge'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const stacksQuery = useQuery({
    queryKey: ['stacks'],
    queryFn: listStacks,
  })

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">Dockstack</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Stack</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stacksQuery.isLoading && (
            <TableRow>
              <TableCell
                colSpan={2}
                className="text-center text-muted-foreground"
              >
                Loading...
              </TableCell>
            </TableRow>
          )}
          {stacksQuery.error && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-destructive">
                {stacksQuery.error.message}
              </TableCell>
            </TableRow>
          )}
          {stacksQuery.data?.map(({ name, status }) => (
            <TableRow key={name}>
              <TableCell>
                <Link
                  to="/stacks/$name"
                  params={{ name }}
                  className="font-medium hover:underline"
                >
                  {name}
                </Link>
              </TableCell>
              <TableCell>
                <StatusBadge status={status} />
              </TableCell>
            </TableRow>
          ))}
          {stacksQuery.data?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={2}
                className="text-center text-muted-foreground"
              >
                No stacks found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  )
}
