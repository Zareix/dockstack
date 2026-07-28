#!/usr/bin/env bun
import { readdir } from "node:fs/promises"
import { join, relative } from "node:path"

import pkg from "../package.json" with { type: "json" }

const ROUTES_DIR = join(import.meta.dir, "..", "src", "routes", "api")
const OUT_PATH = join(import.meta.dir, "..", "wiki", "openapi.yaml")

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
type Method = (typeof HTTP_METHODS)[number]

type MethodDoc = {
  summary: string
  operationId?: string
  responses: Record<string, unknown>
}

type DiscoveredRoute = {
  file: string
  routePath: string
  methods: Method[]
  docs: Partial<Record<Method, MethodDoc>>
  middleware: string[]
  isWebsocket: boolean
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.name.endsWith(".ts")) files.push(full)
  }
  return files
}

/** Returns the substring strictly between the bracket at `openIndex` and its match. */
function extractBalanced(text: string, openIndex: number, open: string, close: string): string {
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close) {
      depth--
      if (depth === 0) return text.slice(openIndex + 1, i)
    }
  }
  throw new Error(`Unbalanced ${open}${close} starting at index ${openIndex}`)
}

/** Object/array keys at nesting depth 0 of `body`, with the index they start at. */
function topLevelEntries(body: string): { key: string; index: number }[] {
  const entries: { key: string; index: number }[] = []
  let depth = 0
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === "{" || ch === "(" || ch === "[") depth++
    else if (ch === "}" || ch === ")" || ch === "]") depth--
    else if (depth === 0) {
      const match = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*:/.exec(body.slice(i))
      if (match) {
        entries.push({ key: match[1], index: i })
        i += match[0].length - 1
      }
    }
  }
  return entries
}

/** The `/** ... *\/` JSDoc block immediately preceding `keyIndex` (only whitespace between), if any. */
function precedingJsDoc(body: string, keyIndex: number): string | null {
  let end = keyIndex - 1
  while (end >= 0 && /\s/.test(body[end])) end--
  if (end < 1 || body[end - 1] !== "*" || body[end] !== "/") return null
  const openIdx = body.lastIndexOf("/**", end)
  if (openIdx === -1) return null
  return body.slice(openIdx, end + 1)
}

/**
 * Parses tags out of a JSDoc block above a handler:
 *   summary text
 *   @operationId customId
 *   @response 200
 *   { ...raw OpenAPI response object, JSON... }
 */
function parseJsDoc(comment: string): MethodDoc {
  const lines = comment
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))

  const summary: string[] = []
  const responses: Record<string, unknown> = {}
  let operationId: string | undefined
  let currentStatus: string | null = null
  let currentLines: string[] = []

  const flushResponse = () => {
    if (currentStatus) {
      const text = currentLines.join("\n").trim()
      if (text) responses[currentStatus] = JSON.parse(text)
      currentStatus = null
      currentLines = []
    }
  }

  for (const line of lines) {
    const responseTag = /^@response\s+(\d{3})\s*(.*)$/.exec(line)
    const operationIdTag = /^@operationId\s+(\S+)$/.exec(line)
    if (responseTag) {
      flushResponse()
      currentStatus = responseTag[1]
      currentLines = responseTag[2] ? [responseTag[2]] : []
    } else if (operationIdTag) {
      flushResponse()
      operationId = operationIdTag[1]
    } else if (currentStatus) {
      currentLines.push(line)
    } else if (line.trim()) {
      summary.push(line.trim())
    }
  }
  flushResponse()

  return { summary: summary.join(" "), operationId, responses }
}

function parseRoute(file: string, sourceText: string): DiscoveredRoute | null {
  const isWebsocket = /from ["']crossws["']/.test(sourceText)

  const routeMatch = /createFileRoute\(\s*["']([^"']+)["']\s*\)/.exec(sourceText)
  if (!routeMatch) return null
  const routePath = routeMatch[1]

  let middleware: string[] = []
  const middlewareKeyIdx = sourceText.indexOf("middleware:")
  if (middlewareKeyIdx !== -1) {
    const bracketIdx = sourceText.indexOf("[", middlewareKeyIdx)
    if (bracketIdx !== -1) {
      middleware = extractBalanced(sourceText, bracketIdx, "[", "]")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }

  const methods: Method[] = []
  const docs: Partial<Record<Method, MethodDoc>> = {}
  const handlersKeyIdx = sourceText.indexOf("handlers:")
  if (handlersKeyIdx !== -1) {
    const braceIdx = sourceText.indexOf("{", handlersKeyIdx)
    if (braceIdx !== -1) {
      const body = extractBalanced(sourceText, braceIdx, "{", "}")
      for (const { key, index } of topLevelEntries(body)) {
        if (!HTTP_METHODS.includes(key as Method)) continue
        const method = key as Method
        methods.push(method)
        const comment = precedingJsDoc(body, index)
        if (comment) docs[method] = parseJsDoc(comment)
      }
    }
  }

  return { file, routePath, methods, docs, middleware, isWebsocket }
}

function normalizePath(routePath: string): { path: string; isCatchAll: boolean } {
  const isCatchAll = routePath.endsWith("/$")
  let path = routePath.replace(/\$([A-Za-z0-9_]*)/g, (_, name: string) => `{${name || "splat"}}`)
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1)
  return { path, isCatchAll }
}

/** Fallback operationId when a handler has no `@operationId` doc tag. */
function toOperationId(method: string, path: string): string {
  const parts = path
    .split("/")
    .filter((segment) => segment && segment !== "api")
    .map((segment) => segment.replace(/[{}]/g, ""))
  const camel = parts.map((part, i) => (i === 0 ? part : part[0].toUpperCase() + part.slice(1))).join("")
  return method.toLowerCase() + (camel ? camel[0].toUpperCase() + camel.slice(1) : "Root")
}

const files = await walk(ROUTES_DIR)
const discovered = (
  await Promise.all(files.map(async (file) => parseRoute(file, await Bun.file(file).text())))
).filter((route): route is DiscoveredRoute => route !== null)

const excludedNotes: string[] = []
const includedRoutes: (DiscoveredRoute & { path: string })[] = []

for (const route of discovered) {
  const { path, isCatchAll } = normalizePath(route.routePath)
  const rel = relative(ROUTES_DIR, route.file)
  if (route.isWebsocket) {
    excludedNotes.push(`- \`${path}\` (${rel}) — WebSocket endpoint, not representable in OpenAPI.`)
    continue
  }
  if (isCatchAll) {
    excludedNotes.push(`- \`${path}\` (${rel}) — catch-all handler, not representable in OpenAPI.`)
    continue
  }
  includedRoutes.push({ ...route, path })
}

const paths: Record<string, Record<string, unknown>> = {}
const undocumented: string[] = []

for (const route of includedRoutes) {
  const isPublic = !route.middleware.includes("apiKeyMiddleware")
  const operations: Record<string, unknown> = paths[route.path] ?? {}

  for (const method of route.methods) {
    const doc = route.docs[method]
    if (!doc) undocumented.push(`${method} ${route.path} (${relative(ROUTES_DIR, route.file)})`)

    operations[method.toLowerCase()] = {
      operationId: doc?.operationId ?? toOperationId(method, route.path),
      summary: doc?.summary || `${method} ${route.path}`,
      ...(isPublic ? { security: [] } : {}),
      responses:
        doc && Object.keys(doc.responses).length > 0 ? doc.responses : { "200": { description: "OK" } },
    }
  }

  paths[route.path] = operations
}

if (undocumented.length > 0) {
  console.warn(
    `[openapi] No JSDoc comment above handler for: ${undocumented.join(", ")}. Emitting a generic 200 — add a /** ... @response 200 {...} */ comment above the handler.`,
  )
}

const stackStatus = {
  type: "string",
  enum: [
    "running",
    "healthy",
    "unhealthy",
    "starting",
    "restarting",
    "partial",
    "stopped",
    "down",
    "unknown",
    "missing",
  ],
}

const spec = {
  openapi: "3.1.0",
  info: {
    title: "dockstack API",
    version: pkg.version,
    description: [
      "API for dockstack. Generated from routes under `src/routes/api/` — see the JSDoc comment above each handler.",
      ...(excludedNotes.length > 0 ? ["", "Not included:", ...excludedNotes] : []),
    ].join("\n"),
  },
  servers: [{ url: "https://dockstack.example.com/" }],
  security: [{ apiKeyAuth: [] }],
  paths,
  components: {
    securitySchemes: {
      apiKeyAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key sent as `Authorization: Bearer <key>`, verified via better-auth.",
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid API key",
        content: {
          "application/json": {
            schema: { type: "object", properties: { error: { type: "string" } } },
          },
        },
      },
    },
    schemas: {
      StackStatus: stackStatus,
      StackSummary: {
        type: "object",
        required: ["name", "status"],
        properties: {
          name: { type: "string" },
          status: { $ref: "#/components/schemas/StackStatus" },
        },
      },
      RedeployResult: {
        type: "object",
        required: ["name", "action"],
        properties: {
          name: { type: "string" },
          action: { type: "string", enum: ["skipped", "redeployed", "error"] },
          services: {
            type: "array",
            items: { type: "string" },
            description: "Present when action = redeployed",
          },
          error: { type: "string", description: "Present when action = error" },
        },
      },
    },
  },
}

await Bun.write(OUT_PATH, Bun.YAML.stringify(spec, null, 2))
console.log(`Wrote ${OUT_PATH} (${includedRoutes.length} routes, ${excludedNotes.length} excluded)`)
