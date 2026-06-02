import { Button } from '#/components/ui/button'
import { Spinner } from '#/components/ui/spinner'
import { createDotEnv, getStackFiles, saveStackFiles } from '#/lib/functions'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import Editor from '#/components/editor/monaco-file-editor'

export function StackFiles({ stackName }: { stackName: string }) {
  const queryClient = useQueryClient()

  const filesQuery = useQuery({
    queryKey: ['stack-files', stackName],
    queryFn: () => getStackFiles({ data: { stackName } }),
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
          stackName,
          composeFile: filesQuery.data!.composeFile,
          compose,
          env: envContent,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stack-files', stackName] })
      toast.success('Saved')
    },
    onError: () => toast.error('Failed to save'),
  })

  const createDotEnvMutation = useMutation({
    mutationFn: () => createDotEnv({ data: { stackName } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['stack-files', stackName] }),
  })

  const isDirty =
    filesQuery.data &&
    (compose !== filesQuery.data.compose || envContent !== filesQuery.data.env)

  return (
    <>
      {filesQuery.isLoading && (
        <p className="text-muted-foreground text-sm">Loading...</p>
      )}
      {filesQuery.error && (
        <p className="text-destructive text-sm">{filesQuery.error.message}</p>
      )}
      {filesQuery.data && (
        <>
          <div className="grid md:grid-cols-12 gap-4">
            <div className="md:col-span-7">
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
            <div className="md:col-span-5">
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
          {isDirty && (
            <div className="flex items-center justify-end gap-3 mt-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
