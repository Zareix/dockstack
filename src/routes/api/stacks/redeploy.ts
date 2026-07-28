import { createFileRoute } from "@tanstack/react-router"

import { redeployAllRunningStacks } from "#/lib/docker"
import { apiKeyMiddleware, loggingMiddleware } from "#/lib/middleware"

export const Route = createFileRoute("/api/stacks/redeploy")({
  server: {
    middleware: [loggingMiddleware, apiKeyMiddleware],
    handlers: {
      /**
       * Redeploy all currently running stacks.
       * @operationId redeployAllRunningStacks
       * @response 200
       * {
       *   "description": "Redeploy results per stack",
       *   "content": {
       *     "application/json": {
       *       "schema": { "type": "array", "items": { "$ref": "#/components/schemas/RedeployResult" } }
       *     }
       *   }
       * }
       * @response 401
       * { "$ref": "#/components/responses/Unauthorized" }
       */
      POST: async () => {
        return Response.json(await redeployAllRunningStacks())
      },
    },
  },
})
