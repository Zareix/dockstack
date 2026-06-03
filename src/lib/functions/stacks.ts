import { env } from '#/env'
import * as docker from '#/lib/docker'
import { createServerFn } from '@tanstack/react-start'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

export type Stack = { name: string; status: docker.StackStatus }

export const listStacks = createServerFn().handler(
  async (): Promise<Stack[]> => {
    const names = await docker.listStacks()
    return Promise.all(
      names.map(async (name) => ({
        name,
        status: await docker.getStackStatus(name),
      })),
    )
  },
)

export const getStackStatus = createServerFn()
  .inputValidator(z.object({ stackName: z.string().min(1) }))
  .handler(({ data: { stackName } }) => docker.getStackStatus(stackName))

export const getStackContainers = createServerFn()
  .inputValidator(z.object({ stackName: z.string().min(1) }))
  .handler(({ data: { stackName } }) => docker.getStackContainers(stackName))

const stackNameSchema = z.object({ stackName: z.string().min(1) })

export const stackUp = createServerFn()
  .inputValidator(stackNameSchema)
  .handler(({ data: { stackName } }) => docker.stackUp(stackName))

export const stackStop = createServerFn()
  .inputValidator(stackNameSchema)
  .handler(({ data: { stackName } }) => docker.stackStop(stackName))

export const stackDown = createServerFn()
  .inputValidator(stackNameSchema)
  .handler(({ data: { stackName } }) => docker.stackDown(stackName))

export const stackRestart = createServerFn()
  .inputValidator(stackNameSchema)
  .handler(({ data: { stackName } }) => docker.stackRestart(stackName))

export const stackDestroy = createServerFn()
  .inputValidator(stackNameSchema)
  .handler(async ({ data: { stackName } }) => {
    await docker.stackDown(stackName).catch(() => {})
    await rm(join(env.STACKS_DIR, stackName), { recursive: true, force: true })
  })

export const stackPull = createServerFn()
  .inputValidator(stackNameSchema)
  .handler(({ data: { stackName } }) => docker.stackPull(stackName))
