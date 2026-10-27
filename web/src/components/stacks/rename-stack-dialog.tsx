import { PencilSimpleIcon, InfoIcon } from "@phosphor-icons/react"
import { useForm } from "@tanstack/react-form"
import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import * as v from "valibot"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "#/components/ui/alert"
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
  getGetStacksQueryKey,
  getStacksName,
  usePostStacksNameRename,
} from "#/lib/api/generated"

const schema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Name is required"),
    v.regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, underscores"),
  ),
})

export function RenameStackDialog({ stackName }: { stackName: string }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = usePostStacksNameRename({
    mutation: {
      onSuccess: (_, { name, data }) => {
        toast.success(`Stack "${name}" renamed to "${data.name}"`)
        queryClient.invalidateQueries({ queryKey: getGetStacksQueryKey() })
        setOpen(false)
        form.reset()
        navigate({
          to: `/stacks/${data.name}`,
          search: {
            tab: "services",
          },
        })
      },
      onError: (e) => toast.error(e.message),
    },
  })

  const form = useForm({
    defaultValues: { name: stackName },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => mutation.mutate({ name: stackName, data: { name: value.name } }),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <PencilSimpleIcon data-icon="inline-start" />
            Rename
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename "{stackName}"</DialogTitle>
        </DialogHeader>
        <Alert>
          <InfoIcon />
          <AlertTitle>The stack will be restarted</AlertTitle>
          <AlertDescription>
            It is brought down, renamed, then brought back up under its new name. Containers will be
            briefly stopped.
          </AlertDescription>
        </Alert>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <div className="grid gap-2">
            <form.Field
              name="name"
              validators={{
                onChangeAsync: async ({ value }) => {
                  if (!v.safeParse(schema.entries.name, value).success) return undefined
                  if (value === stackName) return undefined
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
                      onChange={(e) => field.handleChange(e.target.value)}
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
                <Button type="submit" disabled={mutation.isPending || disabled}>
                  {mutation.isPending ? "Renaming..." : "Rename"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
