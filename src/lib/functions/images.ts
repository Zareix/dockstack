import * as docker from '#/lib/docker'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const listImages = createServerFn().handler(() => docker.listImages())

export const imageRemove = createServerFn()
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(({ data: { id } }) => docker.imageRemove(id))
