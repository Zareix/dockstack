import { Badge } from "#/components/ui/badge"

import type { NetworkInfo, StackStatus, StaleStatus, VolumeInfo } from "../lib/docker"

type StatusVariant = {
  variant: "default" | "secondary" | "destructive" | "outline" | "warning"
  className?: string
  label: string
}

type Status = VolumeInfo["status"] | StackStatus | StaleStatus | NetworkInfo["status"]

const statusMap: Record<Status, StatusVariant> = {
  running: {
    variant: "default",
    className: "bg-green-600 text-white dark:bg-green-700",
    label: "Running",
  },
  healthy: {
    variant: "default",
    className: "bg-green-600 text-white dark:bg-green-700",
    label: "Healthy",
  },
  unhealthy: { variant: "destructive", label: "Unhealthy" },
  starting: {
    variant: "secondary",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400",
    label: "Starting",
  },
  partial: {
    variant: "secondary",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400",
    label: "Partial",
  },
  stopped: { variant: "destructive", label: "Stopped" },
  down: { variant: "destructive", label: "Down" },
  unknown: { variant: "outline", className: "text-muted-foreground", label: "Unknown" },
  missing: {
    variant: "outline",
    className: "text-muted-foreground border-dashed",
    label: "Missing",
  },
  outdated: { variant: "warning", label: "Outdated" },
  "up-to-date": {
    variant: "outline",
    className: "border-green-500 text-green-600 dark:text-green-400",
    label: "Up to date",
  },
  "in-use": {
    variant: "default",
    className: "bg-green-600 text-white dark:bg-green-700",
    label: "In use",
  },
  unused: { variant: "outline", className: "text-muted-foreground", label: "Unused" },
  system: { variant: "outline", className: "text-muted-foreground", label: "System" },
}

export function StatusBadge({ status }: { status: Status }) {
  const config = statusMap[status]
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
