import { Editor, loader } from "@monaco-editor/react"
import { ClipboardTextIcon, CopyIcon } from "@phosphor-icons/react"
import * as monaco from "monaco-editor"
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import { configureMonacoYaml } from "monaco-yaml"
import { useRef } from "react"
import { toast } from "sonner"

import { Button } from "#/components/ui/button"
import { Spinner } from "#/components/ui/spinner"

const COMPOSE_SCHEMA_URL =
  "https://raw.githubusercontent.com/compose-spec/compose-spec/master/schema/compose-spec.json"

declare global {
  interface Window {
    IS_MONACO_YAML_CONFIGURED?: boolean
  }
}

window.MonacoEnvironment = {
  getWorker(_, label) {
    switch (label) {
      case "yaml":
        return new Worker(new URL("./yaml.worker.js", import.meta.url), {
          type: "module",
        })
      default:
        return new EditorWorker()
    }
  },
}
loader.config({ monaco })

type MonacoFileEditorProps = {
  value: string
  filename?: string
  onChange?: (value: string) => void
  readOnly?: boolean
}

export default function MonacoFileEditor({
  value,
  filename = "file.yaml",
  onChange,
  readOnly = false,
}: MonacoFileEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  async function handleCopy() {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (!editor || !model) return
    const selection = editor.getSelection()
    const text =
      selection && !selection.isEmpty() ? model.getValueInRange(selection) : model.getValue()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      toast.error("Failed to copy")
    }
  }

  async function handlePaste() {
    const editor = editorRef.current
    const selection = editor?.getSelection()
    if (!editor || !selection) return
    try {
      const text = await navigator.clipboard.readText()
      editor.executeEdits("paste", [{ range: selection, text, forceMoveMarkers: true }])
      editor.focus()
    } catch {
      toast.error("Failed to paste")
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="self-end font-mono text-xs text-muted-foreground">{filename}</p>
        <div className="flex items-center gap-2 md:hidden">
          <Button size="icon-sm" variant="outline" onClick={handleCopy}>
            <CopyIcon data-icon="inline-start" />
          </Button>
          {!readOnly && (
            <Button size="icon-sm" variant="outline" onClick={handlePaste}>
              <ClipboardTextIcon data-icon="inline-start" />
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          value={value}
          path={filename}
          language={filename.endsWith(".env") ? "ini" : "yaml"}
          theme="vs-dark"
          loading={<Spinner />}
          onMount={(editor) => {
            editorRef.current = editor
          }}
          beforeMount={(m) => {
            if (window.IS_MONACO_YAML_CONFIGURED) return
            configureMonacoYaml(m, {
              enableSchemaRequest: true,
              hover: true,
              completion: true,
              validate: true,
              format: { enable: true },
              schemas: [
                {
                  uri: COMPOSE_SCHEMA_URL,
                  fileMatch: [
                    "**/compose.yaml",
                    "**/compose.yml",
                    "**/docker-compose.yml",
                    "**/docker-compose.yaml",
                  ],
                },
              ],
            })
            window.IS_MONACO_YAML_CONFIGURED = true
          }}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            scrollBeyondLastLine: false,
            wordWrap: "off",
            tabSize: 2,
          }}
          onChange={(v) => onChange?.(v ?? "")}
        />
      </div>
    </div>
  )
}
