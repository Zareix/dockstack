import { Badge } from '#/components/ui/badge'
import type { StackStatus } from '#/lib/docker'

const statusVariant: Record<
  StackStatus,
  {
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    className: string
  }
> = {
  running: {
    variant: 'default',
    className: 'bg-green-600 text-white dark:bg-green-700',
  },
  partial: {
    variant: 'secondary',
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400',
  },
  stopped: { variant: 'destructive', className: '' },
  down: { variant: 'destructive', className: '' },
  unknown: { variant: 'outline', className: 'text-muted-foreground' },
}

export const StatusBadge = ({ status }: { status: StackStatus }) => {
  const { variant, className } = statusVariant[status]
  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  )
}
