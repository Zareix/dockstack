import { createMiddleware } from "@tanstack/react-start"

import { auth } from "#/lib/auth"

export const authMiddleware = createMiddleware().server(async ({ request, next }) => {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  return next()
})

export const apiKeyMiddleware = createMiddleware().server(async ({ request, next }) => {
  const key = request.headers.get("Authorization")?.replace("Bearer ", "")
  if (!key) {
    return Response.json(
      {
        error: "No API key provided, provide one via the Authorization header",
      },
      { status: 401 },
    )
  }
  const data = await auth.api.verifyApiKey({
    body: {
      key,
    },
    headers: request.headers,
  })
  if (!data.valid) {
    return Response.json({ error: data.error }, { status: 401 })
  }
  return next()
})

export const loggingFnMiddleware = createMiddleware({
  type: "function",
}).server(async ({ next, serverFnMeta, method }) => {
  if (serverFnMeta.name !== "getSettings") {
    console.log(`${method} ${serverFnMeta.name}`)
  }
  return next()
})

export const loggingMiddleware = createMiddleware().server(async ({ next, request }) => {
  const res = await next()
  console.log(`${request.method} ${new URL(request.url).pathname} ${res.response.status}`)
  return res
})
