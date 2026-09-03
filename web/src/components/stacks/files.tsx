import { PlusIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { lazy, Suspense, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import { Spinner } from "#/components/ui/spinner"
import {
  getGetStacksNameFilesQueryKey,
  getGetStacksNameQueryKey,
  useGetStacksNameFiles,
  usePostStacksNameEnv,
  usePutStacksNameFiles,
} from "#/lib/api/generated/default/default.ts"

const Editor = lazy(() => import("#/components/editor/monaco-file-editor"))

export function StackFiles({ stackName }: { stackName: string }) {
  const queryClient = useQueryClient()

  const [compose, setCompose] = useState("")
  const [envContent, setEnvContent] = useState<string | undefined>(undefined)

  const filesQuery = useGetStacksNameFiles(stackName)
  const saveMutation = usePutStacksNameFiles({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStacksNameFilesQueryKey(stackName) })
        queryClient.invalidateQueries({ queryKey: getGetStacksNameQueryKey(stackName) })
        toast.success("Saved")
      },
      onError: () => toast.error("Failed to save"),
    },
  })

  const createDotEnvMutation = usePostStacksNameEnv({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getGetStacksNameFilesQueryKey(stackName) }),
    },
  })

  useEffect(() => {
    if (!filesQuery.data) return
    setCompose(filesQuery.data.compose)
    if (filesQuery.data.env) setEnvContent(filesQuery.data.env)
  }, [filesQuery.data])

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
              {envContent !== undefined ? (
                <div className="h-[60vh] md:h-[70vh]">
                  <Suspense fallback={<Spinner />}>
                    <Editor value={envContent} filename=".env" onChange={setEnvContent} />
                  </Suspense>
                </div>
              ) : (
                <div className="flex items-center rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <Button
                    onClick={() =>
                      createDotEnvMutation.mutate({
                        name: stackName,
                      })
                    }
                    variant="ghost"
                  >
                    <PlusIcon data-icon="inline-start" />
                    Create .env
                  </Button>
                </div>
              )}
            </div>
          </div>
          {isDirty && (
            <div className="mt-2 flex items-center justify-end gap-3">
              <Button
                onClick={() =>
                  saveMutation.mutate({
                    name: stackName,
                    data: {
                      compose: compose,
                      composeFile: filesQuery.data!.composeFile,
                      env: envContent,
                    },
                  })
                }
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  )
}
