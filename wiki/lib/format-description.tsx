import type { ReactNode } from "react"

export function formatDescription(text: string): ReactNode {
  return text
    .split(/(`[^`]+`)/g)
    .map((part, i) =>
      part.startsWith("`") && part.endsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : part,
    )
}
