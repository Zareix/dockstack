import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import * as docker from "#/lib/docker"
import { authMiddleware } from "#/lib/middleware"

export const listVolumes = createServerFn()
  .middleware([authMiddleware])
  .handler(() => docker.listVolumes())

export const volumeRemove = createServerFn()
  .middleware([authMiddleware])
  .validator(z.object({ name: z.string().min(1) }))
  .handler(({ data: { name } }) => docker.volumeRemove(name))

export const volumePrune = createServerFn()
  .middleware([authMiddleware])
  .handler(() => docker.volumePrune())
