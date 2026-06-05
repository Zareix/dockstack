import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TerminalIcon } from 'lucide-react'
import { ContainerTerminal } from '#/components/terminal/container-terminal'
import { Spinner } from '#/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { getStackContainers } from '#/lib/functions'

const SHELLS = ['/bin/sh', '/bin/bash', '/bin/zsh', '/bin/ash']

export function StackTerminal({ stackName }: { stackName: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [shell, setShell] = useState('/bin/sh')

  const query = useQuery({
    queryKey: ['stacks', stackName, 'services'],
    queryFn: () => getStackContainers({ data: { stackName } }),
  })

  if (query.isLoading) return <Spinner />
  if (query.error)
    return <p className="text-destructive text-sm">{query.error.message}</p>

  const running = query.data?.filter((c) => c.state === 'running') ?? []

  if (!running.length)
    return (
      <p className="text-muted-foreground text-sm">No running containers.</p>
    )

  const activeId = selectedId ?? running[0]?.id

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <TerminalIcon className="size-4 text-muted-foreground" />
        <Select
          value={activeId}
          onValueChange={setSelectedId}
          items={running.map((r) => ({
            label: r.name,
            value: r.id,
          }))}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select container" />
          </SelectTrigger>
          <SelectContent>
            {running.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={shell}
          onValueChange={(v) => setShell(v ?? '/bin/sh')}
          items={SHELLS.map((s) => ({ label: s, value: s }))}
        >
          <SelectTrigger className="w-36 font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHELLS.map((s) => (
              <SelectItem key={s} value={s} className="font-mono text-xs">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeId && (
        <div className="flex-1 min-h-0">
          <ContainerTerminal
            key={`${activeId}-${shell}`}
            containerId={activeId}
            shell={shell}
          />
        </div>
      )}
    </div>
  )
}
