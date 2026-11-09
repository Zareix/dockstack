import { DownloadSimpleIcon, WarningIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import { Checkbox } from "#/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog"
import { Label } from "#/components/ui/label"
import { exportStack } from "#/lib/api/stacks-archive"

export function ExportStackDialog({
  stackName,
  open,
  onOpenChange,
}: {
  stackName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [includeEnv, setIncludeEnv] = useState(true)
  const [pending, setPending] = useState(false)

  const download = async () => {
    setPending(true)
    try {
      await exportStack(stackName, includeEnv)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export {stackName}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">
          Downloads the stack directory as a zip archive. Import it from the New stack dialog on
          another instance.
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-env"
            checked={includeEnv}
            onCheckedChange={(checked) => setIncludeEnv(checked === true)}
          />
          <Label htmlFor="include-env">Include .env file</Label>
        </div>
        {includeEnv && (
          <Alert variant="destructive">
            <WarningIcon />
            <AlertTitle>Secrets warning</AlertTitle>
            <AlertDescription>
              The .env file may contain secrets such as passwords and API keys.
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={download} disabled={pending}>
            <DownloadSimpleIcon data-icon="inline-start" />
            {pending ? "Exporting..." : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
