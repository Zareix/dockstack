import { useAuthPlugin } from "@better-auth-ui/react"
import { KeyIcon } from "@phosphor-icons/react"

import { Button } from "#/components/ui/button.tsx"
import { Card, CardContent } from "#/components/ui/card.tsx"
import { apiKeyPlugin } from "#/lib/auth/api-key-plugin.ts"

export type ApiKeysEmptyProps = {
  onCreatePress: () => void
  hideCreate?: boolean
}

export function ApiKeysEmpty({ onCreatePress, hideCreate }: ApiKeysEmptyProps) {
  const { localization: apiKeyLocalization } = useAuthPlugin(apiKeyPlugin)

  return (
    <Card className="border-0 bg-transparent shadow-none ring-0">
      <CardContent className="flex flex-col items-center justify-center gap-4">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted">
          <KeyIcon className="size-4.5" />
        </div>

        <div className="flex flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-semibold">{apiKeyLocalization.noApiKeys}</p>

          <p className="text-xs text-muted-foreground">{apiKeyLocalization.apiKeysDescription}</p>
        </div>

        {!hideCreate && (
          <Button size="sm" onClick={onCreatePress}>
            {apiKeyLocalization.createApiKey}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
