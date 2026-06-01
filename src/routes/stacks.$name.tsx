import { ContainerLogs } from '#/components/container-logs'
import { getStackFiles } from '#/lib/functions'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/stacks/$name')({
  component: RouteComponent,
})

function RouteComponent() {
  const { name } = Route.useParams()

  const filesQuery = useQuery({
    queryKey: ['stack-files', name],
    queryFn: () => getStackFiles({ data: { stackName: name } }),
  })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">{name}</h2>

      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          {filesQuery.isLoading && (
            <p className="text-muted-foreground text-sm mt-4">Loading...</p>
          )}
          {filesQuery.error && (
            <p className="text-destructive text-sm mt-4">{filesQuery.error.message}</p>
          )}
          {filesQuery.data && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-1">compose.yaml</p>
                <pre className="rounded-lg bg-muted p-4 text-sm overflow-auto max-h-[60vh] font-mono">
                  {filesQuery.data.compose}
                </pre>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-1">.env</p>
                {filesQuery.data.env ? (
                  <pre className="rounded-lg bg-muted p-4 text-sm overflow-auto max-h-[60vh] font-mono">
                    {filesQuery.data.env}
                  </pre>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No .env file
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <div className="mt-4">
            <ContainerLogs stackName={name} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
