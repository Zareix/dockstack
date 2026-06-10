import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import * as docker from "#/lib/docker"
import { authMiddleware } from "#/lib/middleware"

export type { LogEntry } from "#/lib/docker"

export const streamLogs = createServerFn()
  .middleware([authMiddleware])
  .validator(z.object({ stackName: z.string().min(1) }))
  .handler(async function* ({ data: { stackName } }) {
    yield* docker.streamStackLogs(stackName)
  })
