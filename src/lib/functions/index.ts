import { env } from '#/env'
import { createServerFn } from '@tanstack/react-start'
import { readdir, readFile } from 'node:fs/promises'
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

export type StackFiles = { compose: string; env: string | null }

export const getStackFiles = createServerFn()
  .inputValidator(z.object({ stackName: z.string().min(1) }))
  .handler(async ({ data: { stackName } }): Promise<StackFiles> => {
    const dir = join(env.STACKS_DIR, stackName)

    const compose = await (async () => {
      for (const f of COMPOSE_FILENAMES) {
        try {
          return await readFile(join(dir, f), 'utf8')
        } catch {}
      }
      throw new Error(`No compose file found in ${stackName}`)
    })()

    const envContent = await readFile(join(dir, '.env'), 'utf8').catch(
      () => null,
    )

    return { compose, env: envContent }
  })

export const streamLogs = createServerFn()
  .inputValidator(z.object({ stackName: z.string().min(1) }))
  .handler(async function* ({ data: { stackName } }) {
    yield* docker.streamStackLogs(stackName)
  })
