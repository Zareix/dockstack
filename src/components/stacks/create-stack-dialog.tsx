import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { createStack } from '#/lib/functions'
import { Label } from '#/components/ui/label'
import { Input } from '#/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { FieldError } from '#/components/ui/field'

const schema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, hyphens, underscores'),
})

export function CreateStackButton() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (stackName: string) => createStack({ data: { stackName } }),
    onSuccess: (_, stackName) => {
      toast.success(`Stack "${stackName}" created`)
      queryClient.invalidateQueries({ queryKey: ['stacks'] })
      setOpen(false)
      form.reset()
      navigate({
        to: `/stacks/${stackName}`,
        search: {
          tab: 'files',
        },
      })
    },
    onError: (e) => toast.error(e.message),
  })

  const form = useForm({
    defaultValues: { name: '' },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => mutation.mutate(value.name),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon />
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
            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <div
                    data-invalid={isInvalid || undefined}
                    className="grid gap-2"
                  >
                    <Label htmlFor={field.name}>Name</Label>
                    <Input
                      id={field.name}
                      placeholder="my-app"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      aria-invalid={isInvalid}
                      autoFocus
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </div>
                )
              }}
            </form.Field>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
