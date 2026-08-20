import { ForgotPassword } from "./forgot-password"
import { ResetPassword } from "./reset-password"
import { SignIn } from "./sign-in"
import { SignOut } from "./sign-out"

const views: Record<string, () => React.ReactNode> = {
  "sign-in": () => <SignIn />,
  "forgot-password": () => <ForgotPassword />,
  "reset-password": () => <ResetPassword />,
  "sign-out": () => <SignOut />,
}

export function Auth({ path }: { path: string }) {
  const View = views[path]
  if (!View) return null
  return View()
}
