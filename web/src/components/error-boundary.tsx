import type { ReactNode } from "react"
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary"
import type { FallbackProps } from "react-error-boundary"

import { Button } from "#/components/ui/button"
import { cn } from "#/lib/utils"

export function ErrorFallback({
  message,
  onReset,
  className,
}: {
  message: string
  onReset: () => void
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 text-center", className)}>
      <h1 className="text-4xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">{message}</p>
      <Button onClick={onReset}>Try again</Button>
    </div>
  )
}

function Fallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <ErrorFallback
      message={error instanceof Error ? error.message : String(error)}
      onReset={resetErrorBoundary}
      className="min-h-screen p-4"
    />
  )
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return <ReactErrorBoundary FallbackComponent={Fallback}>{children}</ReactErrorBoundary>
}
