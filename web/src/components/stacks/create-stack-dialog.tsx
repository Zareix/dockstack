import { PlusIcon, WarningIcon } from "@phosphor-icons/react"
import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import * as v from "valibot"

import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert"
import { Button } from "#/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog"
import { FieldError } from "#/components/ui/field"
import { Input } from "#/components/ui/input"
import { Label } from "#/components/ui/label"
import {
  getGetStacksDriftQueryKey,
  getGetStacksQueryKey,
  getStacksName,
  usePostStacks,
} from "#/lib/api/generated"
import { importStack } from "#/lib/api/stacks-archive"

const schema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Name is required"),
    v.regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, underscores"),
  ),
})

function nameFromArchive(filename: string) {
  return filename.replace(/\.zip$/i, "")
}

export function CreateStackButton() {
  const [open, setOpen] = useState(false)
  const [archive, setArchive] = useState<File | null>(null)
  const [archiveInputKey, setArchiveInputKey] = useState(0)
  const [nameTouched, setNameTouched] = useState(false)
  const [importing, setImporting] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const onDone = (name: string) => {
    toast.success(`Stack "${name}" ${archive ? "imported" : "created"}`)
    queryClient.invalidateQueries({ queryKey: getGetStacksQueryKey() })
    queryClient.invalidateQueries({ queryKey: getGetStacksDriftQueryKey() })
    setOpen(false)
    setArchive(null)
    setArchiveInputKey((key) => key + 1)
    setNameTouched(false)
    form.reset()
    navigate({
      to: `/stacks/${name}`,
      search: {
        tab: "files",
      },
    })
  }

  const mutation = usePostStacks({
    mutation: {
      onSuccess: (_, stack) => onDone(stack.data.name),
      onError: (e) => toast.error(e.message),
    },
  })

  const form = useForm({
    defaultValues: { name: "" },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => {
      if (!archive) {
        mutation.mutate({ data: { name: value.name } })
        return
      }
      setImporting(true)
      importStack(value.name, archive)
        .then(onDone)
        .catch((e: Error) => toast.error(e.message))
        .finally(() => setImporting(false))
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setArchive(null)
          setArchiveInputKey((key) => key + 1)
          setNameTouched(false)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon data-icon="inline-start" weight="regular" />
            New stack
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create stack</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="archive">Archive (optional)</Label>
              <Input
                key={archiveInputKey}
                id="archive"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setArchive(file)
                  if (file && !nameTouched) {
                    form.setFieldValue("name", nameFromArchive(file.name))
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Import an existing stack from a zip archive exported by Dockstack.
              </p>
              {archive && (
                <Alert variant="destructive">
                  <WarningIcon />
                  <AlertTitle>Secrets warning</AlertTitle>
                  <AlertDescription>
                    The archive may contain a .env file with secrets. Make sure you trust its
                    origin.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <form.Field
              name="name"
              validators={{
                onChangeAsync: async ({ value }) => {
                  if (!v.safeParse(schema.entries.name, value).success) return undefined
                  const exists = await getStacksName(value).then(
                    () => true,
                    () => false,
                  )
                  return exists ? `A stack named "${value}" already exists` : undefined
                },
                onChangeAsyncDebounceMs: 300,
              }}
            >
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <div data-invalid={isInvalid || undefined} className="grid gap-2">
                    <Label htmlFor={field.name}>Name</Label>
                    <Input
                      id={field.name}
                      placeholder="my-app"
                      value={field.state.value}
                      onChange={(e) => {
                        setNameTouched(true)
                        field.handleChange(e.target.value)
                      }}
                      onBlur={field.handleBlur}
                      aria-invalid={isInvalid}
                      aria-describedby={isInvalid ? `${field.name}-error` : undefined}
                      autoFocus
                    />
                    {isInvalid && (
                      <FieldError
                        id={`${field.name}-error`}
                        errors={field.state.meta.errors.map((error) =>
                          typeof error === "string" ? { message: error } : error,
                        )}
                      />
                    )}
                  </div>
                )
              }}
            </form.Field>
          </div>
          <DialogFooter className="mt-4">
            <form.Subscribe selector={(state) => !state.canSubmit || state.isValidating}>
              {(disabled) => (
                <Button type="submit" disabled={mutation.isPending || importing || disabled}>
                  {importing
                    ? "Importing..."
                    : mutation.isPending
                      ? "Creating..."
                      : archive
                        ? "Import"
                        : "Create"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
