import { createServerFn } from "@tanstack/react-start"
import * as v from "valibot"

import * as docker from "#/lib/docker"
import { authMiddleware } from "#/lib/middleware"

export const listImages = createServerFn()
  .middleware([authMiddleware])
  .handler(() => docker.listImages())

export const imageRemove = createServerFn()
  .middleware([authMiddleware])
  .validator(v.object({ id: v.pipe(v.string(), v.minLength(1)) }))
  .handler(({ data: { id } }) => docker.imageRemove(id))

export const imagePrune = createServerFn()
  .middleware([authMiddleware])
  .handler(() => docker.imagePrune())

export const checkImagesStale = createServerFn()
  .middleware([authMiddleware])
  .handler(() => docker.checkImagesStale())
