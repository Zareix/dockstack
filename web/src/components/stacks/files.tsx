import { InfoIcon, PlusIcon, WarningIcon } from "@phosphor-icons/react"
import { useQueryClient } from "@tanstack/react-query"
import { lazy, Suspense, useEffect, useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import { Spinner } from "#/components/ui/spinner"
import {
  getGetStacksDriftQueryKey,
  getGetStacksNameFilesQueryKey,
  getGetStacksNameQueryKey,
  useGetStacksNameFiles,
  usePostStacksNameEnv,
  usePutStacksNameFiles,
} from "#/lib/api/generated"
import type { ComposeValidation } from "#/lib/api/generated/model"

const Editor = lazy(() => import("#/components/editor/monaco-file-editor"))

function ValidationAlerts({ validation }: { validation: ComposeValidation }) {
  if (!validation.composeAvailable) {
    return (
      <Alert>
        <InfoIcon />
        <AlertTitle>Validation unavailable</AlertTitle>
        <AlertDescription>
          docker compose CLI not found; the files were saved without validation.
        </AlertDescription>
      </Alert>
    )
  }
  const errors = validation.errors ?? []
  const warnings = validation.warnings ?? []
  if (errors.length === 0 && warnings.length === 0) return null
  return (
    <div className="space-y-2">
      {errors.length > 0 && (
        <Alert variant="destructive">
          <WarningIcon />
          <AlertTitle>Compose validation failed</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errors.map((error, index) => (
                <li key={`${index}-${error}`}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert>
          <WarningIcon />
          <AlertTitle>Compose warnings</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((warning, index) => (
                <li key={`${index}-${warning}`}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export function StackFiles({ stackName }: { stackName: string }) {
  const queryClient = useQueryClient()

  const [compose, setCompose] = useState("")
  const [envContent, setEnvContent] = useState<string | undefined>(undefined)
  const [validation, setValidation] = useState<ComposeValidation | null>(null)

  const filesQuery = useGetStacksNameFiles(stackName)
  const saveMutation = usePutStacksNameFiles({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetStacksNameFilesQueryKey(stackName) })
        queryClient.invalidateQueries({ queryKey: getGetStacksNameQueryKey(stackName) })
        queryClient.invalidateQueries({ queryKey: getGetStacksDriftQueryKey() })
        setValidation(data.validation)
        toast.success("Saved")
      },
      onError: () => toast.error("Failed to save"),
    },
  })

  const createDotEnvMutation = usePostStacksNameEnv({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStacksNameFilesQueryKey(stackName) })
        queryClient.invalidateQueries({ queryKey: getGetStacksDriftQueryKey() })
      },
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
                    onChange={(value) => {
                      setCompose(value)
                      setValidation(null)
                    }}
                  />
                </Suspense>
              </div>
            </div>
            <div className="md:col-span-5 ">
              {envContent !== undefined ? (
                <div className="h-[60vh] md:h-[70vh]">
                  <Suspense fallback={<Spinner />}>
                    <Editor
                      value={envContent}
                      filename=".env"
                      onChange={(value) => {
                        setEnvContent(value)
                        setValidation(null)
                      }}
                    />
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
          {validation && (
            <div className="mt-4">
              <ValidationAlerts validation={validation} />
            </div>
          )}
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
