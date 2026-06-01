import { env } from '#/env'
import { createServerFn } from '@tanstack/react-start'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as docker from '#/lib/docker'
import type { StackStatus } from '#/lib/docker'
import { z } from 'zod'

export type Stack = { name: string; status: StackStatus }

export const listStacks = createServerFn().handler(
  async (): Promise<Stack[]> => {
    const names = await readdir(env.STACKS_DIR)
    return Promise.all(
      names.map(async (name) => ({
        name,
        status: await docker.getStackStatus(name),
      })),
    )
  },
)

const COMPOSE_FILENAMES = [
  'compose.yaml',
  'compose.yml',
  'docker-compose.yml',
  'docker-compose.yaml',
]

export type StackFiles = { compose: string; composeFile: string; env: string | null }

export const getStackFiles = createServerFn()
  .inputValidator(z.object({ stackName: z.string().min(1) }))
  .handler(async ({ data: { stackName } }): Promise<StackFiles> => {
    const dir = join(env.STACKS_DIR, stackName)

    let compose = ''
    let composeFile = 'compose.yaml'
    for (const f of COMPOSE_FILENAMES) {
      try {
        compose = await readFile(join(dir, f), 'utf8')
        composeFile = f
        break
      } catch {}
    }
    if (!compose) throw new Error(`No compose file found in ${stackName}`)

    const envContent = await readFile(join(dir, '.env'), 'utf8').catch(() => null)

    return { compose, composeFile, env: envContent }
  })

export const saveStackFiles = createServerFn()
  .inputValidator(z.object({
    stackName: z.string().min(1),
    composeFile: z.string().min(1),
    compose: z.string(),
    env: z.string().nullable(),
  }))
  .handler(async ({ data: { stackName, composeFile, compose, env: envContent } }) => {
    const dir = join(env.STACKS_DIR, stackName)
    await writeFile(join(dir, composeFile), compose, 'utf8')
    if (envContent !== null) {
      await writeFile(join(dir, '.env'), envContent, 'utf8')
    }
  })

export const streamLogs = createServerFn()
  .inputValidator(z.object({ stackName: z.string().min(1) }))
  .handler(async function* ({ data: { stackName } }) {
    yield* docker.streamStackLogs(stackName)
  })
