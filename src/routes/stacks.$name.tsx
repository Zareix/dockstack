import { ContainerLogs } from '#/components/container-logs'
import { createDotEnv, getStackFiles, saveStackFiles } from '#/lib/functions'
import { Button } from '#/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Spinner } from '#/components/ui/spinner'
import { ChevronLeftIcon } from 'lucide-react'

export const Route = createFileRoute('/stacks/$name')({
  component: RouteComponent,
})

const Editor = lazy(() => import('#/components/editor/monaco-file-editor'))

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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['stack-files', name] }),
  })
  const createDotEnvMutation = useMutation({
    mutationFn: () => createDotEnv({ data: { stackName: name } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['stack-files', name] }),
  })

  const isDirty =
    compose !== filesQuery.data?.compose || envContent !== filesQuery.data.env

  return (
    <>
      <Link to="/">
        <Button variant="link" size="xs" className="-ml-3">
          <ChevronLeftIcon />
          Back
        </Button>
      </Link>
      <header className="flex items-center">
        <h2 className="text-2xl font-bold">{name}</h2>

        <div className="ml-auto flex items-center gap-3">
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
            <span className="text-sm text-destructive">
              {saveMutation.error.message}
            </span>
          )}
        </div>
      </header>

      <Tabs defaultValue="files" className="mt-4">
        <TabsList>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          {filesQuery.isLoading && (
            <p className="text-muted-foreground text-sm ">Loading...</p>
          )}
          {filesQuery.error && (
            <p className="text-destructive text-sm ">
              {filesQuery.error.message}
            </p>
          )}
          {filesQuery.data && (
            <>
              <div className=" grid grid-cols-12 gap-4">
                <div className="col-span-7">
                  <p className="text-xs text-muted-foreground font-mono mb-2">
                    {filesQuery.data.composeFile}
                  </p>
                  <Suspense fallback={<Spinner />}>
                    <Editor
                      value={compose}
                      filename={filesQuery.data.composeFile}
                      onChange={setCompose}
                    />
                  </Suspense>
                </div>
                <div className="col-span-5">
                  <p className="text-xs text-muted-foreground font-mono mb-2">
                    .env
                  </p>
                  {envContent !== null ? (
                    <Suspense fallback={<Spinner />}>
                      <Editor
                        value={envContent}
                        filename=".env"
                        onChange={setEnvContent}
                      />
                    </Suspense>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground flex items-center">
                      <Button
                        onClick={() => createDotEnvMutation.mutate()}
                        variant="ghost"
                      >
                        Create .env
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <div className="">
            <ContainerLogs stackName={name} />
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}
