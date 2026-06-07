import { createMiddleware } from '@tanstack/react-start'
import { auth } from '#/lib/auth'

export const authMiddleware = createMiddleware().server(
  async ({ request, next }) => {
    const session = await auth.api.getSession(request)
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return next()
  },
)

export const apiKeyMiddleware = createMiddleware().server(
  async ({ request, next }) => {
    const key = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!key) {
      return Response.json(
        {
          error:
            'No API key provided, provide one via the Authorization header',
        },
        { status: 401 },
      )
    }
    const data = await auth.api.verifyApiKey({
      body: {
        key,
      },
    })
    if (!data.valid) {
      return Response.json({ error: data.error }, { status: 401 })
    }
    return next()
  },
)
