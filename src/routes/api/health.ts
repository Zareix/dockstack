import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      /**
       * Health check.
       * @operationId getHealth
       * @response 200
       * {
       *   "description": "Service is healthy",
       *   "content": {
       *     "application/json": {
       *       "schema": {
       *         "type": "object",
       *         "required": ["status"],
       *         "properties": { "status": { "type": "string", "example": "ok" } }
       *       }
       *     }
       *   }
       * }
       */
      GET: () => Response.json({ status: "ok" }),
    },
  },
})
