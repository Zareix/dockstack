import { createServerFn } from "@tanstack/react-start"

import { env } from "#/env"

export const getSettings = createServerFn().handler(async () => {
  return {
    appTitle: env.APP_TITLE,
  }
})
