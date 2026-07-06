import { useQuery } from "@tanstack/react-query"
import { TerminalIcon } from "lucide-react"
import { useState } from "react"

import { ContainerTerminal } from "#/components/terminal/container-terminal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import { Spinner } from "#/components/ui/spinner"
import { getStackContainers } from "#/lib/functions"

const SHELLS = ["/bin/sh", "/bin/bash", "/bin/zsh", "/bin/ash"]

export function StackTerminal({ stackName }: { stackName: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [shell, setShell] = useState("/bin/sh")

  const query = useQuery({
    queryKey: ["stacks", stackName, "services"],
    queryFn: () => getStackContainers({ data: { stackName } }),
  })

  if (query.isLoading) return <Spinner />
  if (query.error) return <p className="text-sm text-destructive">{query.error.message}</p>

  const running = query.data?.filter((c) => c.status === "running" || c.status === "healthy") ?? []

  if (!running.length)
    return <p className="text-sm text-muted-foreground">No running containers.</p>

  const activeId = selectedId ?? running[0]?.id

  return (
    <div className="flex h-full flex-col gap-3">
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
          onValueChange={(v) => setShell(v ?? "/bin/sh")}
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
        <div className="min-h-0 flex-1">
          <ContainerTerminal key={`${activeId}-${shell}`} containerId={activeId} shell={shell} />
        </div>
      )}
    </div>
  )
}
