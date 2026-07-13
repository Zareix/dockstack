import { rm } from "node:fs/promises"
import { join } from "node:path"

import { createServerFn } from "@tanstack/react-start"
import * as v from "valibot"

import { env } from "#/env"
import * as docker from "#/lib/docker"
import { authMiddleware } from "#/lib/middleware"

export type Stack = { name: string; status: docker.StackStatus }

export const listStacks = createServerFn()
  .middleware([authMiddleware])
  .handler(async (): Promise<Stack[]> => {
    const names = await docker.listStacks()
    return Promise.all(
      names.map(async (name) => ({
        name,
        status: await docker.getStackStatus(name),
      })),
    )
  })

export const getStackStatus = createServerFn()
  .middleware([authMiddleware])
  .validator(v.object({ stackName: v.pipe(v.string(), v.minLength(1)) }))
  .handler(({ data: { stackName } }) => docker.getStackStatus(stackName))

export const getStackContainers = createServerFn()
  .middleware([authMiddleware])
  .validator(v.object({ stackName: v.pipe(v.string(), v.minLength(1)) }))
  .handler(({ data: { stackName } }) => docker.getStackContainers(stackName))

const stackNameSchema = v.object({ stackName: v.pipe(v.string(), v.minLength(1)) })

export const stackUp = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async ({ data: { stackName } }) => {
    for await (const _line of docker.streamStackUp(stackName)) {
    }
    return { success: true }
  })

export const stackStop = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async ({ data: { stackName } }) => {
    for await (const _line of docker.streamStackStop(stackName)) {
    }
    return { success: true }
  })

export const stackDown = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async ({ data: { stackName } }) => {
    for await (const _line of docker.streamStackDown(stackName)) {
    }
    return { success: true }
  })

export const stackRestart = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async ({ data: { stackName } }) => {
    for await (const _line of docker.streamStackRestart(stackName)) {
    }
    return { success: true }
  })

export const stackDestroy = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async ({ data: { stackName } }) => {
    for await (const _line of docker.streamStackDown(stackName)) {
    }
    await rm(join(env.STACKS_DIR, stackName), { recursive: true, force: true })
    return { success: true }
  })

export const stackPull = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async ({ data: { stackName } }) => {
    for await (const _line of docker.streamStackPull(stackName)) {
    }
    return { success: true }
  })

export const streamStackUp = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async function* ({ data: { stackName } }) {
    yield* docker.streamStackUp(stackName)
  })

export const streamStackStop = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async function* ({ data: { stackName } }) {
    yield* docker.streamStackStop(stackName)
  })

export const streamStackDown = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async function* ({ data: { stackName } }) {
    yield* docker.streamStackDown(stackName)
  })

export const streamStackRestart = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async function* ({ data: { stackName } }) {
    yield* docker.streamStackRestart(stackName)
  })

export const streamStackPull = createServerFn()
  .middleware([authMiddleware])
  .validator(stackNameSchema)
  .handler(async function* ({ data: { stackName } }) {
    yield* docker.streamStackPull(stackName)
  })
