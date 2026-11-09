import { InfoIcon, PlusIcon, WarningIcon } from "@phosphor-icons/react"
import { FloppyDiskIcon } from "@phosphor-icons/react/dist/ssr/FloppyDisk"
import { useQueryClient } from "@tanstack/react-query"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import { Spinner } from "#/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs"
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
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const composeDirty = useRef(false)
  const envDirty = useRef(false)

  const filesQuery = useGetStacksNameFiles(stackName)
  const saveMutation = usePutStacksNameFiles({
    mutation: {
      onSuccess: (data) => {
        composeDirty.current = false
        envDirty.current = false
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
        setActiveTab(".env")
        toast.success("Created .env")
      },
      onError: (error) => toast.error(error.message),
    },
  })

  useEffect(() => {
    composeDirty.current = false
    envDirty.current = false
    setActiveTab(null)
    setEnvContent(undefined)
    setValidation(null)
  }, [stackName])

  useEffect(() => {
    if (!filesQuery.data) return
    if (!composeDirty.current) setCompose(filesQuery.data.compose)
    if (!envDirty.current) setEnvContent(filesQuery.data.env ?? undefined)
  }, [filesQuery.data])

  const isDirty =
    filesQuery.data &&
    (compose !== filesQuery.data.compose || envContent !== (filesQuery.data.env ?? undefined))

  const tab = activeTab ?? filesQuery.data?.composeFile
  const showEnvTab = envContent !== undefined || activeTab === ".env"

  return (
    <>
      {filesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {filesQuery.error && <p className="text-sm text-destructive">{filesQuery.error.message}</p>}
      {filesQuery.data && tab && (
        <>
          <Tabs
            value={tab}
            onValueChange={(value) => setActiveTab(String(value))}
            className="gap-0"
          >
            <div className="flex items-center gap-2">
              <TabsList className="rounded-b-none bg-[#1e1e1e]">
                <TabsTrigger value={filesQuery.data.composeFile} className="font-mono">
                  {filesQuery.data.composeFile}
                </TabsTrigger>
                {showEnvTab && (
                  <TabsTrigger value=".env" className="font-mono">
                    .env
                  </TabsTrigger>
                )}
              </TabsList>
              {envContent === undefined && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createDotEnvMutation.mutate({ name: stackName })}
                  disabled={createDotEnvMutation.isPending}
                >
                  <PlusIcon data-icon="inline-start" />
                  Create .env
                </Button>
              )}
              <Button
                className="ml-auto"
                size="sm"
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
                disabled={saveMutation.isPending || !isDirty}
              >
                {saveMutation.isPending ? (
                  "Saving..."
                ) : (
                  <>
                    <FloppyDiskIcon /> Save
                  </>
                )}
              </Button>
            </div>
            <TabsContent value={tab}>
              <div className="h-[60vh] md:h-[75vh]">
                <Suspense fallback={<Spinner />}>
                  <Editor
                    value={tab === filesQuery.data.composeFile ? compose : (envContent ?? "")}
                    filename={tab}
                    onChange={(value) => {
                      if (tab === filesQuery.data.composeFile) {
                        setCompose(value)
                        composeDirty.current = true
                      } else {
                        setEnvContent(value)
                        envDirty.current = true
                      }
                      setValidation(null)
                    }}
                  />
                </Suspense>
              </div>
            </TabsContent>
          </Tabs>
          {validation && (
            <div className="mt-4">
              <ValidationAlerts validation={validation} />
            </div>
          )}
        </>
      )}
    </>
  )
}
