import { createServerFn } from "@tanstack/react-start"

import * as docker from "#/lib/docker"
import { authMiddleware } from "#/lib/middleware"

export const listNetworks = createServerFn()
  .middleware([authMiddleware])
  .handler(() => docker.listNetworks())
