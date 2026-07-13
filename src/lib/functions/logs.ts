import { createServerFn } from "@tanstack/react-start"
import * as v from "valibot"

import * as docker from "#/lib/docker"
import { authMiddleware } from "#/lib/middleware"

export type { LogEntry } from "#/lib/docker"

export const streamLogs = createServerFn()
  .middleware([authMiddleware])
  .validator(v.object({ stackName: v.pipe(v.string(), v.minLength(1)) }))
  .handler(async function* ({ data: { stackName } }) {
    yield* docker.streamStackLogs(stackName)
  })
