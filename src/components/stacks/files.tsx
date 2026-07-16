import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import { lazy, Suspense, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import { Spinner } from "#/components/ui/spinner"
import { createDotEnv, getStackFiles, saveStackFiles } from "#/lib/functions"

const Editor = lazy(() => import("#/components/editor/monaco-file-editor"))

export function StackFiles({ stackName }: { stackName: string }) {
  const queryClient = useQueryClient()

  const filesQuery = useQuery({
    queryKey: ["stack-files", stackName],
    queryFn: () => getStackFiles({ data: { stackName } }),
  })

  const [compose, setCompose] = useState("")
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
      queryClient.invalidateQueries({ queryKey: ["stack-files", stackName] })
      toast.success("Saved")
    },
    onError: () => toast.error("Failed to save"),
  })

  const createDotEnvMutation = useMutation({
    mutationFn: () => createDotEnv({ data: { stackName } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stack-files", stackName] }),
  })

  const isDirty =
    filesQuery.data && (compose !== filesQuery.data.compose || envContent !== filesQuery.data.env)

  return (
    <>
      {filesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {filesQuery.error && <p className="text-sm text-destructive">{filesQuery.error.message}</p>}
      {filesQuery.data && (
        <>
          <div className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-7">
              <p className="mb-2 font-mono text-xs text-muted-foreground">
                {filesQuery.data.composeFile}
              </p>
              <div className="h-[60vh] md:h-[70vh]">
                <Suspense fallback={<Spinner />}>
                  <Editor
                    value={compose}
                    filename={filesQuery.data.composeFile}
                    onChange={setCompose}
                  />
                </Suspense>
              </div>
            </div>
            <div className="md:col-span-5 ">
              <p className="mb-2 font-mono text-xs text-muted-foreground">.env</p>
              {envContent !== null ? (
                <div className="h-[60vh] md:h-[70vh]">
                  <Suspense fallback={<Spinner />}>
                    <Editor value={envContent} filename=".env" onChange={setEnvContent} />
                  </Suspense>
                </div>
              ) : (
                <div className="flex items-center rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <Button onClick={() => createDotEnvMutation.mutate()} variant="ghost">
                    <PlusIcon />
                    Create .env
                  </Button>
                </div>
              )}
            </div>
          </div>
          {isDirty && (
            <div className="mt-2 flex items-center justify-end gap-3">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
