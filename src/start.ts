import { createCsrfMiddleware, createStart } from '@tanstack/react-start'
import { loggingFnMiddleware } from '#/lib/middleware'

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [csrfMiddleware],
    functionMiddleware: [loggingFnMiddleware],
  }
})
