import {
  CopyIcon,
  InfoIcon,
  PlusIcon,
  SquareSplitVerticalIcon,
  TabsIcon,
  WarningIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react"
import { FloppyDiskIcon } from "@phosphor-icons/react/dist/ssr/FloppyDisk"
import { useQueryClient } from "@tanstack/react-query"
import { lazy, Suspense, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#/components/ui/collapsible"
import { Spinner } from "#/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip"
import {
  getGetStacksDriftQueryKey,
  getGetStacksNameFilesQueryKey,
  getGetStacksNameQueryKey,
  useGetStacksNameFiles,
  usePostStacksNameEnv,
  usePostStacksNameValidate,
  usePutStacksNameFiles,
} from "#/lib/api/generated"
import type { ComposeDiagnostics } from "#/lib/api/generated/model"
import { cn } from "#/lib/utils"

const Editor = lazy(() => import("#/components/editor/monaco-file-editor"))

type ViewMode = "tabs" | "split"

const VIEW_MODE_KEY = "dockstack:stack-files-view"

function readViewMode(): ViewMode {
  if (typeof window === "undefined") return "tabs"
  try {
    return window.localStorage.getItem(VIEW_MODE_KEY) === "split" ? "split" : "tabs"
  } catch {
    return "tabs"
  }
}

function useViewMode() {
  const [mode, setMode] = useState<ViewMode>(readViewMode)
  const update = (next: ViewMode) => {
    setMode(next)
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, next)
    } catch {
      // localStorage can be unavailable in private or restricted contexts.
    }
  }
  return [mode, update] as const
}

function EditorPane({
  filename,
  value,
  onChange,
  showLabel = true,
  className,
}: {
  filename: string
  value: string
  onChange: (value: string) => void
  showLabel?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {showLabel && <p className="font-mono text-xs text-muted-foreground">{filename}</p>}
      <div className="h-[60vh] md:h-[70vh]">
        <Suspense fallback={<Spinner />}>
          <Editor value={value} filename={filename} onChange={onChange} />
        </Suspense>
      </div>
    </div>
  )
}

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}) {
  const next: ViewMode = mode === "split" ? "tabs" : "split"
  const label = mode === "split" ? "Switch to tab view" : "Switch to split view"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onChange(next)}
            aria-label={label}
          >
            {mode === "split" ? <TabsIcon /> : <SquareSplitVerticalIcon className="md:rotate-90" />}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function FilesToolbar({
  leading,
  viewMode,
  onViewModeChange,
  showCreate,
  onCreateEnv,
  createPending,
  onSave,
  savePending,
  dirty,
}: {
  leading?: ReactNode
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  showCreate: boolean
  onCreateEnv: () => void
  createPending: boolean
  onSave: () => void
  savePending: boolean
  dirty: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {leading}
      {showCreate && (
        <Button variant="outline" size="sm" onClick={onCreateEnv} disabled={createPending}>
          <PlusIcon data-icon="inline-start" />
          Create .env
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <ViewModeToggle mode={viewMode} onChange={onViewModeChange} />
        <Button size="sm" onClick={onSave} disabled={savePending || !dirty}>
          {savePending ? (
            "Saving..."
          ) : (
            <>
              <FloppyDiskIcon /> Save
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function CreateEnvPlaceholder({ onCreate, pending }: { onCreate: () => void; pending: boolean }) {
  return (
    <div className="flex items-center rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      <Button variant="ghost" onClick={onCreate} disabled={pending}>
        <PlusIcon data-icon="inline-start" />
        Create .env
      </Button>
    </div>
  )
}

function SplitEditors({
  composeFile,
  compose,
  envContent,
  onComposeChange,
  onEnvChange,
  onCreateEnv,
  createPending,
}: {
  composeFile: string
  compose: string
  envContent: string | undefined
  onComposeChange: (value: string) => void
  onEnvChange: (value: string) => void
  onCreateEnv: () => void
  createPending: boolean
}) {
  return (
    <div data-split-view className="grid gap-4 md:grid-cols-12">
      <EditorPane
        className="md:col-span-7"
        filename={composeFile}
        value={compose}
        onChange={onComposeChange}
      />
      <div className="md:col-span-5">
        {envContent !== undefined ? (
          <EditorPane filename=".env" value={envContent} onChange={onEnvChange} />
        ) : (
          <CreateEnvPlaceholder onCreate={onCreateEnv} pending={createPending} />
        )}
      </div>
    </div>
  )
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Copied")
  } catch {
    toast.error("Failed to copy")
  }
}

function DiagnosticsPanel({
  diagnostics,
  onAddMissingEnv,
  onClearUnusedEnv,
}: {
  diagnostics: ComposeDiagnostics | null
  onAddMissingEnv: (keys: string[]) => void
  onClearUnusedEnv: () => void
}) {
  const validation = diagnostics?.validation
  const errors = validation?.errors ?? []
  const warnings = validation?.warnings ?? []
  const unused = diagnostics?.env.unused ?? []
  const missing = diagnostics?.env.missing ?? []
  const resolved = diagnostics?.resolved ?? ""

  return (
    <div className="space-y-2">
      {validation && !validation.composeAvailable && (
        <Alert>
          <InfoIcon />
          <AlertTitle>Validation unavailable</AlertTitle>
          <AlertDescription>
            docker compose CLI not found; the files were saved without validation.
          </AlertDescription>
        </Alert>
      )}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <WarningIcon />
          <AlertTitle>Compose validation failed</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
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
            <ul className="list-disc space-y-1 pl-4">
              {warnings.map((warning, index) => (
                <li key={`${index}-${warning}`}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {(missing.length > 0 || unused.length > 0) && (
        <Alert variant="warning">
          <WarningOctagonIcon />
          <AlertTitle>Env variables</AlertTitle>
          <AlertDescription>
            <div className="mt-1 space-y-1 text-xs">
              {missing.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Missing:</span>
                  <span className="font-mono">{missing.join(", ")}</span>
                </div>
              )}
              {unused.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Unused:</span>
                  <span className="font-mono">{unused.join(", ")}</span>
                </div>
              )}
            </div>
          </AlertDescription>
          <AlertAction className="flex gap-2">
            {missing.length > 0 && (
              <Button
                size="xs"
                variant="outline"
                className="border-current text-current"
                onClick={() => onAddMissingEnv(missing)}
              >
                Add missing to .env
              </Button>
            )}
            {unused.length > 0 && (
              <Button
                size="xs"
                variant="outline"
                className="border-current text-current"
                onClick={onClearUnusedEnv}
              >
                Clear unused
              </Button>
            )}
          </AlertAction>
        </Alert>
      )}
      {resolved && (
        <Collapsible>
          <CollapsibleTrigger
            render={
              <Button variant="outline" size="sm">
                Resolved config
              </Button>
            }
          />
          <CollapsibleContent>
            <div className="mt-2 overflow-hidden rounded-lg border">
              <div className="flex items-center justify-end border-b p-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => copyText(resolved)}
                  aria-label="Copy resolved config"
                >
                  <CopyIcon />
                </Button>
              </div>
              <pre className="max-h-64 overflow-auto p-3 font-mono text-xs">{resolved}</pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function envKeys(content: string) {
  const keys = new Set<string>()
  for (const line of content.split("\n")) {
    const trimmed = line.trim().replace(/^export /, "")
    if (!trimmed || trimmed.startsWith("#")) continue
    const key = trimmed.split("=")[0]?.trim()
    if (key) keys.add(key)
  }
  return keys
}

export function StackFiles({ stackName }: { stackName: string }) {
  const queryClient = useQueryClient()

  const [compose, setCompose] = useState("")
  const [envContent, setEnvContent] = useState<string | undefined>(undefined)
  const [diagnostics, setDiagnostics] = useState<ComposeDiagnostics | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [viewMode, setViewMode] = useViewMode()
  const composeDirty = useRef(false)
  const envDirty = useRef(false)
  const validationSeq = useRef(0)

  const filesQuery = useGetStacksNameFiles(stackName)
  const savedCompose = filesQuery.data?.compose
  const saveMutation = usePutStacksNameFiles({
    mutation: {
      onSuccess: (data) => {
        composeDirty.current = false
        envDirty.current = false
        queryClient.invalidateQueries({ queryKey: getGetStacksNameFilesQueryKey(stackName) })
        queryClient.invalidateQueries({ queryKey: getGetStacksNameQueryKey(stackName) })
        queryClient.invalidateQueries({ queryKey: getGetStacksDriftQueryKey() })
        setDiagnostics(data.diagnostics)
        toast.success("Saved")
      },
      onError: () => toast.error("Failed to save"),
    },
  })

  const validateMutation = usePostStacksNameValidate()

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
    validationSeq.current++
    composeDirty.current = false
    envDirty.current = false
    setActiveTab(null)
    setEnvContent(undefined)
    setDiagnostics(null)
  }, [stackName])

  useEffect(() => {
    if (!filesQuery.data) return
    if (!composeDirty.current) setCompose(filesQuery.data.compose)
    if (!envDirty.current) setEnvContent(filesQuery.data.env ?? undefined)
  }, [filesQuery.data])

  useEffect(() => {
    const seq = ++validationSeq.current
    if (savedCompose === undefined || compose.trim() === "") return
    const timer = setTimeout(() => {
      validateMutation.mutate(
        { name: stackName, data: { compose, env: envContent } },
        {
          onSuccess: (data) => {
            if (seq === validationSeq.current) setDiagnostics(data)
          },
        },
      )
    }, 800)
    return () => clearTimeout(timer)
  }, [compose, envContent, savedCompose, stackName])

  const isDirty =
    filesQuery.data &&
    (compose !== filesQuery.data.compose || envContent !== (filesQuery.data.env ?? undefined))

  const tab = activeTab ?? filesQuery.data?.composeFile
  const showEnvTab = envContent !== undefined || activeTab === ".env"

  const changeCompose = (value: string) => {
    setCompose(value)
    composeDirty.current = true
  }

  const changeEnv = (value: string) => {
    setEnvContent(value)
    envDirty.current = true
  }

  const addMissingEnvKeys = (keys: string[]) => {
    const existing = envKeys(envContent ?? "")
    const additions = keys.filter((key) => !existing.has(key))
    if (additions.length === 0) return
    const current = envContent ?? ""
    const prefix = current === "" || current.endsWith("\n") ? current : `${current}\n`
    setEnvContent(`${prefix}${additions.map((key) => `${key}=`).join("\n")}\n`)
    envDirty.current = true
    if (viewMode === "tabs") setActiveTab(".env")
  }

  const clearUnusedEnvKeys = () => {
    const unused = diagnostics?.env.unused ?? []
    if (envContent === undefined || unused.length === 0) return
    const unusedSet = new Set(unused)
    let removed = 0
    const lines = envContent.split("\n").filter((line) => {
      const trimmed = line.trim().replace(/^export /, "")
      if (!trimmed || trimmed.startsWith("#")) return true
      const key = trimmed.split("=")[0]?.trim()
      if (key && unusedSet.has(key)) {
        removed++
        return false
      }
      return true
    })
    if (removed === 0) return
    setEnvContent(lines.join("\n"))
    envDirty.current = true
  }

  const save = () => {
    if (!filesQuery.data) return
    saveMutation.mutate({
      name: stackName,
      data: {
        compose: compose,
        composeFile: filesQuery.data.composeFile,
        env: envContent,
      },
    })
  }

  const createEnv = () => createDotEnvMutation.mutate({ name: stackName })

  return (
    <>
      {filesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {filesQuery.error && <p className="text-sm text-destructive">{filesQuery.error.message}</p>}
      {filesQuery.data && tab && (
        <>
          {viewMode === "tabs" ? (
            <Tabs
              value={tab}
              onValueChange={(value) => setActiveTab(String(value))}
              className="gap-0"
            >
              <FilesToolbar
                leading={
                  <TabsList className="dark rounded-b-none bg-[#1e1e1e]">
                    <TabsTrigger value={filesQuery.data.composeFile} className="font-mono text-xs">
                      {filesQuery.data.composeFile}
                    </TabsTrigger>
                    {showEnvTab && (
                      <TabsTrigger value=".env" className="font-mono text-xs">
                        .env
                      </TabsTrigger>
                    )}
                  </TabsList>
                }
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                showCreate={envContent === undefined}
                onCreateEnv={createEnv}
                createPending={createDotEnvMutation.isPending}
                onSave={save}
                savePending={saveMutation.isPending}
                dirty={!!isDirty}
              />
              <TabsContent value={tab}>
                <EditorPane
                  showLabel={false}
                  filename={tab}
                  value={tab === filesQuery.data.composeFile ? compose : (envContent ?? "")}
                  onChange={tab === filesQuery.data.composeFile ? changeCompose : changeEnv}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col">
              <FilesToolbar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                showCreate={false}
                onCreateEnv={createEnv}
                createPending={createDotEnvMutation.isPending}
                onSave={save}
                savePending={saveMutation.isPending}
                dirty={!!isDirty}
              />
              <SplitEditors
                composeFile={filesQuery.data.composeFile}
                compose={compose}
                envContent={envContent}
                onComposeChange={changeCompose}
                onEnvChange={changeEnv}
                onCreateEnv={createEnv}
                createPending={createDotEnvMutation.isPending}
              />
            </div>
          )}
          {(diagnostics || validateMutation.isPending) && (
            <div className="mt-4">
              <DiagnosticsPanel
                diagnostics={diagnostics}
                onAddMissingEnv={addMissingEnvKeys}
                onClearUnusedEnv={clearUnusedEnvKeys}
              />
            </div>
          )}
        </>
      )}
    </>
  )
}
