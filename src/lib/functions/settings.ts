import { createServerFn } from "@tanstack/react-start"

import { env } from "#/env"

export const getSettings = createServerFn().handler(async () => {
  const instances = (
    await Promise.allSettled(
      env.OTHER_INSTANCE_URLS.map(async (url) =>
        fetch(`${url}/api/info`)
          .then((res) => res.json() as Promise<{ title: string; url?: string }>)
          .then((data) => ({
            title: data.title,
            url: data.url ?? url,
            isCurrent: false,
          })),
      ),
    )
  )
    .filter((i) => i.status === "fulfilled")
    .map((i) => i.value)
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
