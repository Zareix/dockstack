import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as docker from '#/lib/docker'

export const listImages = createServerFn().handler(() => docker.listImages())

export const imageRemove = createServerFn()
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(({ data: { id } }) => docker.imageRemove(id))

export const imagePrune = createServerFn().handler(() => docker.imagePrune())
