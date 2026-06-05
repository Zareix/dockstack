import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as docker from '#/lib/docker'

export type { LogEntry } from '#/lib/docker'

export const streamLogs = createServerFn()
  .inputValidator(z.object({ stackName: z.string().min(1) }))
  .handler(async function* ({ data: { stackName } }) {
    yield* docker.streamStackLogs(stackName)
  })
