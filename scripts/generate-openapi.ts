#!/usr/bin/env bun
import { join } from "node:path"

import { STACK_STATUSES } from "#/lib/docker/stacks"

import pkg from "../package.json" with { type: "json" }

const spec = {
  openapi: "3.1.0",
  info: {
    title: "dockstack API",
    version: pkg.version,
    description: [
      "API for dockstack. Covers the routes under `src/routes/api/`.",
      "",
      "Not included:",
      "- `/api/auth/*` — better-auth catch-all handler (see better-auth docs for its own OpenAPI schema).",
      "- `/api/ws/logs`, `/api/ws/exec` — WebSocket endpoints, not representable in OpenAPI.",
    ].join("\n"),
  },
  servers: [{ url: "https://dockstack.example.com/" }],
  security: [{ apiKeyAuth: [] }],
  paths: {
    "/api/health": {
      get: {
        operationId: "getHealth",
        summary: "Health check",
        security: [],
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: { status: { type: "string", example: "ok" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/stacks": {
      get: {
        operationId: "listStacks",
        summary: "List stacks with their status",
        responses: {
          "200": {
            description: "List of stacks",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/StackSummary" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/stacks/redeploy": {
      post: {
        operationId: "redeployAllRunningStacks",
        summary: "Redeploy all currently running stacks",
        description:
          "Stacks listed in the server's [`REDEPLOY_SKIP`](/docs/dockstack/configuration/env-variables#optional) environment variable (comma-separated stack names) are skipped.",
        responses: {
          "200": {
            description: "Redeploy results per stack",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/RedeployResult" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
  },
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
      StackStatus: {
        type: "string",
        enum: STACK_STATUSES,
      },
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

const outPath = join(import.meta.dir, "..", "wiki", "openapi.yaml")
await Bun.write(outPath, Bun.YAML.stringify(spec, null, 2))
console.log(`Wrote ${outPath}`)
