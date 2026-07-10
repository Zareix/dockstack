import { Editor, loader } from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker"
import { configureMonacoYaml } from "monaco-yaml"

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
  return (
    <Editor
      value={value}
      path={filename}
      language={filename.endsWith(".env") ? "ini" : "yaml"}
      theme="vs-dark"
      className="h-[60vh] md:h-[70vh]"
      loading={<Spinner />}
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
        scrollBeyondLastLine: false,
        wordWrap: "off",
        tabSize: 2,
      }}
      onChange={(v) => onChange?.(v ?? "")}
    />
  )
}
