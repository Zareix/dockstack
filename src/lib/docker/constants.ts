export const STACK_STATUSES = [
  "running",
  "healthy",
  "unhealthy",
  "starting",
  "restarting",
  "partial",
  "stopped",
  "down",
  "unknown",
  "missing",
] as const

export type StackStatus = (typeof STACK_STATUSES)[number]

export type RedeployResult = {
  name: string
} & (
  | {
      action: "skipped"
    }
  | {
      action: "redeployed"
      services: string[]
    }
  | {
      action: "error"
      error: string
    }
)
