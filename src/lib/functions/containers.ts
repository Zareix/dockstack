import { createServerFn } from "@tanstack/react-start"
import * as v from "valibot"

import * as docker from "#/lib/docker"
import { authMiddleware } from "#/lib/middleware"

export const listAllContainers = createServerFn()
  .middleware([authMiddleware])
  .handler(() => docker.listAllContainers())

const containerIdSchema = v.object({ id: v.pipe(v.string(), v.minLength(1)) })

export const containerStart = createServerFn()
  .middleware([authMiddleware])
  .validator(containerIdSchema)
  .handler(({ data: { id } }) => docker.containerStart(id))

export const containerStop = createServerFn()
  .middleware([authMiddleware])
  .validator(containerIdSchema)
  .handler(({ data: { id } }) => docker.containerStop(id))

export const containerRestart = createServerFn()
  .middleware([authMiddleware])
  .validator(containerIdSchema)
  .handler(({ data: { id } }) => docker.containerRestart(id))

export const containerRemove = createServerFn()
  .middleware([authMiddleware])
  .validator(containerIdSchema)
  .handler(({ data: { id } }) => docker.containerRemove(id))

export const containerPrune = createServerFn()
  .middleware([authMiddleware])
  .handler(() => docker.containerPrune())
