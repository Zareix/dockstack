import { yaml } from '@codemirror/lang-yaml'
import { lintGutter, linter, type Diagnostic } from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'
import CodeMirror from '@uiw/react-codemirror'
import Ajv from 'ajv'
import * as jsYaml from 'js-yaml'
import { parseDocument, isMap, isSeq, isPair, isScalar } from 'yaml'

const COMPOSE_SCHEMA_URL =
  'https://raw.githubusercontent.com/compose-spec/compose-spec/master/schema/compose-spec.json'

let schemaCache: object | null = null
async function getComposeSchema() {
  if (schemaCache) return schemaCache
  const res = await fetch(COMPOSE_SCHEMA_URL)
  schemaCache = await res.json()
  return schemaCache!
}

const ajv = new Ajv({ allErrors: true, strict: false })

// Walk yaml AST by instancePath segments to get source range
function findRange(
  doc: ReturnType<typeof parseDocument>,
  instancePath: string,
): [number, number] | null {
  const segments = instancePath.split('/').filter(Boolean)
  let node: unknown = doc.contents
  for (const seg of segments) {
    if (isMap(node)) {
      const pair = node.items.find(
        (p) => isPair(p) && isScalar(p.key) && String(p.key.value) === seg,
      )
      if (!pair || !isPair(pair)) return null
      node = pair.value
    } else if (isSeq(node)) {
      node = (node.items as unknown[])[Number(seg)]
    } else {
      return null
    }
  }
  if (
    node &&
    typeof node === 'object' &&
    'range' in node &&
    Array.isArray((node as { range: unknown }).range)
  ) {
    const [start, , end] = (node as { range: [number, number, number] }).range
    return [start, end]
  }
  return null
}

const yamlLinter = linter((view): Diagnostic[] => {
  const source = view.state.doc.toString()
  // YAML syntax errors first
  try {
    jsYaml.load(source)
  } catch (e) {
    if (e instanceof jsYaml.YAMLException) {
      const from = e.mark.position
      return [{ from, to: from + 1, severity: 'error', message: e.reason }]
    }
  }
  return []
})

const composeLinter = linter(async (view): Promise<Diagnostic[]> => {
  const source = view.state.doc.toString()
  let parsed: unknown
  try {
    parsed = jsYaml.load(source)
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object') return []

  const schema = await getComposeSchema()
  const validate = ajv.compile(schema)
  if (validate(parsed)) return []

  const doc = parseDocument(source)
  return (validate.errors ?? []).map((err): Diagnostic => {
    const range = findRange(doc, err.instancePath)
    const from = range?.[0] ?? 0
    const to = range?.[1] ?? from + 1
    return {
      from,
      to,
      severity: 'warning',
      message: `${err.instancePath || '/'} ${err.message}`,
    }
  })
})

interface FileEditorProps {
  value: string
  language?: 'yaml' | 'env'
  compose?: boolean
  onChange?: (value: string) => void
  readOnly?: boolean
}

export function FileEditor({
  value,
  language = 'yaml',
  compose = false,
  onChange,
  readOnly = false,
}: FileEditorProps) {
  const extensions = [
    ...(language === 'yaml' ? [yaml(), yamlLinter, lintGutter()] : []),
    ...(compose ? [composeLinter] : []),
  ]

  return (
    <CodeMirror
      value={value}
      theme={oneDark}
      extensions={extensions}
      readOnly={readOnly}
      onChange={onChange}
      minHeight="60vh"
      maxHeight="80vh"
      className="overflow-hidden rounded-lg text-sm"
    />
  )
}
