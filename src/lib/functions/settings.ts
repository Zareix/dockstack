import { createServerFn } from "@tanstack/react-start"

import { env } from "#/env"

export const getSettings = createServerFn().handler(async () => {
  const instances = env.OTHER_INSTANCE_URLS
  instances.push({
    title: env.APP_TITLE,
    url: env.BETTER_AUTH_URL ?? "/",
    isCurrent: true,
  })
  return {
    appTitle: env.APP_TITLE,
    instances,
  }
})
