import { viewPaths } from '@better-auth-ui/core'
import { createFileRoute, redirect } from '@tanstack/react-router'

import { Auth } from '#/components/auth/auth'

const validAuthPathSegments = new Set([...Object.values(viewPaths.auth)])

export const Route = createFileRoute('/auth/$path')({
  beforeLoad({ params: { path } }) {
    if (!validAuthPathSegments.has(path)) {
      throw redirect({ to: '/' })
    }
  },
  component: AuthPage,
})

function AuthPage() {
  const { path } = Route.useParams()

  return (
    <div className="flex items-center justify-center min-h-[90vh]">
      <Auth path={path} />
    </div>
  )
}
