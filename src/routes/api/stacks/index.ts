import { createFileRoute } from "@tanstack/react-router"

import { getStackStatus, listStacks } from "#/lib/docker"
import { apiKeyMiddleware, loggingMiddleware } from "#/lib/middleware"

export const Route = createFileRoute("/api/stacks/")({
  server: {
    middleware: [loggingMiddleware, apiKeyMiddleware],
    handlers: {
      /**
       * List stacks with their status.
       * @operationId listStacks
       * @response 200
       * {
       *   "description": "List of stacks",
       *   "content": {
       *     "application/json": {
       *       "schema": { "type": "array", "items": { "$ref": "#/components/schemas/StackSummary" } }
       *     }
       *   }
       * }
       * @response 401
       * { "$ref": "#/components/responses/Unauthorized" }
       */
      GET: async () => {
        const names = await listStacks()
        return Response.json(
          await Promise.all(
            names.map(async (name) => ({
              name,
              status: await getStackStatus(name),
            })),
          ),
        )
      },
    },
  },
})
