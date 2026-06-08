import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { COMPOSE_FILENAMES, dockerClient } from './client'
import { env } from '#/env'

export type StackStatus = 'running' | 'partial' | 'stopped' | 'down' | 'unknown'

export type RedeployResult = {
  name: string
  action: 'redeployed' | 'skipped' | 'error'
  services?: string[]
  error?: string
}

export const findComposePath = async (stackName: string): Promise<string> => {
  const dir = join(env.STACKS_DIR, stackName)
  for (const f of COMPOSE_FILENAMES) {
    const path = join(dir, f)
    if (await Bun.file(path).exists()) return path
  }
  throw new Error(`No compose file found in ${stackName}`)
}

export const listStacks = async (): Promise<string[]> => {
  const entries = await readdir(env.STACKS_DIR)
  return (
    await Promise.all(
      entries.map(async (name) =>
        (await stat(join(env.STACKS_DIR, name))).isDirectory() ? name : null,
      ),
    )
  )
    .filter(Boolean)
    .sort()
}

export const stackUp = async (stackName: string) => {
  const composePath = await findComposePath(stackName)
  await Bun.$`docker compose -f ${composePath} up -d --remove-orphans`
}

export async function* streamStackUp(stackName: string): AsyncGenerator<string> {
  const composePath = await findComposePath(stackName)
  const proc = Bun.spawn(
    ['docker', 'compose', '-f', composePath, 'up', '-d', '--remove-orphans'],
    { stdout: 'pipe', stderr: 'pipe' },
  )

  const queue: string[] = []
  let done = 0
  let notify: (() => void) | null = null

  const finish = () => {
    done++
    const fn = notify
    if (fn) fn()
  }

  const processStream = async (stream: ReadableStream<Uint8Array>) => {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    try {
      // eslint-disable-next-line
      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() ?? ''
        for (const line of parts) {
          if (!line) continue
          queue.push(line)
          const fn = notify
          if (fn) fn()
        }
      }
      if (buf) {
        queue.push(buf)
        const fn = notify
        if (fn) fn()
      }
    } finally {
      reader.releaseLock()
    }
  }

  processStream(proc.stdout).finally(finish)
  processStream(proc.stderr).finally(finish)

  while (done < 2 || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((r) => (notify = r))
      notify = null
    }
    while (queue.length > 0) yield queue.shift()!
  }
}

export const stackStop = async (stackName: string) => {
  const composePath = await findComposePath(stackName)
  await Bun.$`docker compose -f ${composePath} stop`
}

export const stackDown = async (stackName: string) => {
  const composePath = await findComposePath(stackName)
  await Bun.$`docker compose -f ${composePath} down`
}

export const stackRestart = async (stackName: string) => {
  const composePath = await findComposePath(stackName)
  await Bun.$`docker compose -f ${composePath} restart`
}

export const stackPull = async (stackName: string) => {
  const composePath = await findComposePath(stackName)
  await Bun.$`docker compose -f ${composePath} pull`
}

export const stackUpServices = async (
  stackName: string,
  services: string[],
) => {
  const composePath = await findComposePath(stackName)
  await Bun.$`docker compose -f ${composePath} up -d ${services}`
}

export const getRunningServices = async (
  stackName: string,
): Promise<string[]> => {
  const containers = await dockerClient.listContainers({
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
      status: ['running'],
    }),
  })
  return [
    ...new Set(
      containers
        .map((c) => c.Labels['com.docker.compose.service'])
        .filter(Boolean),
    ),
  ]
}

export const getStackStatus = async (
  stackName: string,
): Promise<StackStatus> => {
  const containers = await dockerClient.listContainers({
    all: true,
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
    }),
  })
  if (containers.length === 0) return 'down'
  const running = containers.filter((c) => c.State === 'running').length
  if (running === containers.length) return 'running'
  if (running === 0) return 'stopped'
  return 'partial'
}

export const redeployAllRunningStacks = async (): Promise<RedeployResult[]> => {
  const skipList = env.REDEPLOY_SKIP
  const names = await listStacks()
  const results = await Promise.allSettled<RedeployResult>(
    names
      .filter((name) => !skipList.includes(name))
      .map(async (name) => {
        const services = await getRunningServices(name)
        if (services.length === 0) return { name, action: 'skipped' }
        await stackUpServices(name, services)
        return { name, action: 'redeployed', services }
      }),
  )
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: names[i], action: 'error', error: String(r.reason) },
  )
}
