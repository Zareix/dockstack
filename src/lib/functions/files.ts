import { writeFile } from "node:fs/promises"
import path, { join } from "node:path"

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

import { env } from "#/env"
import * as docker from "#/lib/docker"
import { authMiddleware } from "#/lib/middleware"

export type StackFiles = {
  compose: string
  composeFile: string
  env: string | null
}

export const getStackFiles = createServerFn()
  .middleware([authMiddleware])
  .validator(z.object({ stackName: z.string().min(1) }))
  .handler(async ({ data: { stackName } }): Promise<StackFiles> => {
    const dir = join(env.STACKS_DIR, stackName)
    const composeFile = await docker.findComposePath(stackName)
    const compose = await Bun.file(composeFile).text()
    if (!compose) throw new Error(`No compose file found in ${stackName}`)
    const envContent = await Bun.file(join(dir, ".env"))
      .text()
      .catch(() => null)
    return { compose, composeFile: path.basename(composeFile), env: envContent }
  })

export const saveStackFiles = createServerFn()
  .middleware([authMiddleware])
  .validator(
    z.object({
      stackName: z.string().min(1),
      composeFile: z.string().min(1),
      compose: z.string(),
      env: z.string().nullable(),
    }),
  )
  .handler(async ({ data: { stackName, composeFile, compose, env: envContent } }) => {
    const dir = join(env.STACKS_DIR, stackName)
    await writeFile(join(dir, composeFile), compose, "utf8")
    if (envContent !== null) {
      await writeFile(join(dir, ".env"), envContent, "utf8")
    }
  })

export const createStack = createServerFn()
  .middleware([authMiddleware])
  .validator(
    z.object({
      stackName: z
        .string()
        .min(1, "Name is required")
        .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, underscores"),
    }),
  )
  .handler(async ({ data: { stackName } }) => {
    const dir = join(env.STACKS_DIR, stackName)
    await Bun.write(
      join(dir, "compose.yaml"),
      `services:\n  app:\n    image: ${stackName}\n    container_name: ${stackName}_app`,
    )
  })

export const createDotEnv = createServerFn()
  .middleware([authMiddleware])
  .validator(z.object({ stackName: z.string().min(1) }))
  .handler(async ({ data: { stackName } }) => {
    const dir = join(env.STACKS_DIR, stackName)
    await Bun.file(join(dir, ".env")).write("# VAR1=example")
  })
