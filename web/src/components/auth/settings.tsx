import { Link } from "@tanstack/react-router"

import { AccountSettings } from "./settings/account"
import { SecuritySettings } from "./settings/security"

const views: Record<string, () => React.ReactNode> = {
  account: () => <AccountSettings />,
  security: () => <SecuritySettings />,
}

export function Settings({ path }: { path: string }) {
  const View = views[path]
  if (!View) return null
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <Link
          to="/settings/$path"
          params={{ path: "account" }}
          className={`hover:text-foreground ${path === "account" ? "font-medium text-foreground" : ""}`}
        >
          Account
        </Link>
        <Link
          to="/settings/$path"
          params={{ path: "security" }}
          className={`hover:text-foreground ${path === "security" ? "font-medium text-foreground" : ""}`}
        >
          Security
        </Link>
      </div>
      {View()}
    </div>
  )
}
