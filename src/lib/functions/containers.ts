import * as docker from '#/lib/docker'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const containerIdSchema = z.object({ id: z.string().min(1) })

export const containerStart = createServerFn()
  .inputValidator(containerIdSchema)
  .handler(({ data: { id } }) => docker.containerStart(id))

export const containerStop = createServerFn()
  .inputValidator(containerIdSchema)
  .handler(({ data: { id } }) => docker.containerStop(id))

export const containerRestart = createServerFn()
  .inputValidator(containerIdSchema)
  .handler(({ data: { id } }) => docker.containerRestart(id))

export const containerRemove = createServerFn()
  .inputValidator(containerIdSchema)
  .handler(({ data: { id } }) => docker.containerRemove(id))
