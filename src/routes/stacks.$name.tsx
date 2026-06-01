import { ContainerLogs } from '#/components/container-logs'
import { FileEditor } from '#/components/file-editor'
import { getStackFiles, saveStackFiles } from '#/lib/functions'
import { Button } from '#/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/stacks/$name')({
  component: RouteComponent,
})

function RouteComponent() {
  const { name } = Route.useParams()
  const queryClient = useQueryClient()

  const filesQuery = useQuery({
    queryKey: ['stack-files', name],
    queryFn: () => getStackFiles({ data: { stackName: name } }),
  })

  const [compose, setCompose] = useState('')
  const [envContent, setEnvContent] = useState<string | null>(null)

  useEffect(() => {
    if (!filesQuery.data) return
    setCompose(filesQuery.data.compose)
    setEnvContent(filesQuery.data.env)
  }, [filesQuery.data])

  const saveMutation = useMutation({
    mutationFn: () =>
      saveStackFiles({
        data: {
          stackName: name,
          composeFile: filesQuery.data!.composeFile,
          compose,
          env: envContent,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stack-files', name] }),
  })

  const isDirty =
    compose !== filesQuery.data?.compose ||
    envContent !== filesQuery.data?.env

  return (
    <>
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
            <>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground font-mono mb-2">
                    {filesQuery.data.composeFile}
                  </p>
                  <FileEditor value={compose} language="yaml" compose onChange={setCompose} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-mono mb-2">.env</p>
                  {envContent !== null ? (
                    <FileEditor value={envContent} language="env" onChange={setEnvContent} />
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No .env file
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={!isDirty || saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                {saveMutation.isSuccess && !isDirty && (
                  <span className="text-sm text-muted-foreground">Saved</span>
                )}
                {saveMutation.isError && (
                  <span className="text-sm text-destructive">{saveMutation.error.message}</span>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <div className="mt-4">
            <ContainerLogs stackName={name} />
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}
