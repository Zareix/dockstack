import { createServerFn } from "@tanstack/react-start"
import * as v from "valibot"

import * as docker from "#/lib/docker"
import { authMiddleware } from "#/lib/middleware"

export const listVolumes = createServerFn()
  .middleware([authMiddleware])
  .handler(() => docker.listVolumes())

export const volumeRemove = createServerFn()
  .middleware([authMiddleware])
  .validator(v.object({ name: v.pipe(v.string(), v.minLength(1)) }))
  .handler(({ data: { name } }) => docker.volumeRemove(name))

export const volumePrune = createServerFn()
  .middleware([authMiddleware])
  .handler(() => docker.volumePrune())
