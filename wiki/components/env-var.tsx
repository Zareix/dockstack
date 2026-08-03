"use client"

import { PreviewCard } from "@base-ui/react/preview-card"

import { formatDescription } from "@/lib/format-description"
import { envVars } from "@/lib/shared"

export function EnvVar({ name }: { name: keyof typeof envVars }) {
  const info = envVars[name]

  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        render={<code />}
        className="cursor-help underline decoration-dotted underline-offset-4"
      >
        {name}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner sideOffset={8} align="start">
          <PreviewCard.Popup className="bg-fd-popover/60 text-fd-popover-foreground data-closed:animate-fd-popover-out data-open:animate-fd-popover-in z-50 max-w-xs origin-(--transform-origin) rounded-xl border p-3 text-sm shadow-lg backdrop-blur-lg focus-visible:outline-none">
            <div className="flex items-center gap-2">
              <p className="text-fd-foreground font-mono text-xs font-medium">{name}</p>
              {info.required && (
                <span className="bg-fd-primary/10 text-fd-primary rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                  Required
                </span>
              )}
            </div>
            <p className="text-fd-muted-foreground mt-1.5">{formatDescription(info.description)}</p>
            {(info.default || info.dockerDefault) && (
              <dl className="mt-2 space-y-0.5 border-t pt-2 text-xs">
                {info.default && (
                  <div className="flex gap-1.5">
                    <dt className="text-fd-muted-foreground">Default:</dt>
                    <dd>
                      <code>{info.default}</code>
                    </dd>
                  </div>
                )}
                {info.dockerDefault && info.dockerDefault !== info.default && (
                  <div className="flex gap-1.5">
                    <dt className="text-fd-muted-foreground">Docker default:</dt>
                    <dd>
                      <code>{info.dockerDefault}</code>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  )
}
