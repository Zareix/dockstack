import { PlusIcon } from "@phosphor-icons/react"
import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import * as v from "valibot"

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
import { createStack, stackExists } from "#/lib/api"

const schema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Name is required"),
    v.regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, underscores"),
  ),
})

export function CreateStackButton() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (stackName: string) => createStack(stackName),
    onSuccess: (_, stackName) => {
      toast.success(`Stack "${stackName}" created`)
      queryClient.invalidateQueries({ queryKey: ["stacks"] })
      setOpen(false)
      form.reset()
      navigate({
        to: `/stacks/${stackName}`,
        search: {
          tab: "files",
        },
      })
    },
    onError: (e) => toast.error(e.message),
  })

  const form = useForm({
    defaultValues: { name: "" },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => mutation.mutate(value.name),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <div className="grid gap-2">
            <form.Field
              name="name"
              validators={{
                onChangeAsync: async ({ value }) => {
                  if (!v.safeParse(schema.entries.name, value).success) return undefined
                  const exists = await stackExists(value)
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
            <form.Subscribe selector={(state) => state.isValidating}>
              {(isValidating) => (
                <Button type="submit" disabled={mutation.isPending || isValidating}>
                  {mutation.isPending ? "Creating..." : "Create"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
