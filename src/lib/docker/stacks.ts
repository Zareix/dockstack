import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"

import { env } from "#/env"

import { mergeStreams } from "../streams"
import { COMPOSE_FILENAMES, dockerClient } from "./client"

export type StackStatus =
  | "running"
  | "healthy"
  | "unhealthy"
  | "starting"
  | "restarting"
  | "partial"
  | "stopped"
  | "down"
  | "unknown"
  | "missing"

export type RedeployResult = {
  name: string
} & (
  | {
      action: "skipped"
    }
  | {
      action: "redeployed"
      services: string[]
    }
  | {
      action: "error"
      error: string
    }
)

export const getDockerEnv = () => {
  const dockerEnv = { ...process.env }
  delete dockerEnv.BETTER_AUTH_URL
  delete dockerEnv.ADMIN_EMAIL
  delete dockerEnv.APP_TITLE
  delete dockerEnv.SERVER_HOST
  delete dockerEnv.STACKS_DIR
  delete dockerEnv.DATABASE_PATH
  delete dockerEnv.OAUTH_PROVIDER_ID
  delete dockerEnv.OAUTH_CLIENT_ID
  delete dockerEnv.OAUTH_CLIENT_SECRET
  delete dockerEnv.OAUTH_DISCOVERY_URL
  delete dockerEnv.DOCKER_SYSTEM_PRUNE_CRON
  delete dockerEnv.DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES
  delete dockerEnv.REDEPLOY_SKIP
  return dockerEnv
}

export const findComposePath = async (stackName: string) => {
  const dir = join(env.STACKS_DIR, stackName)
  for (const f of COMPOSE_FILENAMES) {
    const path = join(dir, f)
    if (await Bun.file(path).exists()) return path
  }
  throw new Error(`No compose file found in ${stackName}`)
}

export const findEnvPath = async (stackName: string) => {
  const path = join(env.STACKS_DIR, stackName, ".env")
  if (await Bun.file(path).exists()) return path
  return null
}

export const listStacks = async () => {
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

async function* spawnCompose(stackName: string, args: string[]) {
  const composePath = await findComposePath(stackName)

  const envPath = await findEnvPath(stackName)
  const command = [
    "--config",
    env.DOCKER_CONFIG_DIR_PATH,
    "compose",
    "--progress",
    "plain",
    "--file",
    composePath,
    ...(envPath ? ["--env-file", envPath] : []),
    ...args,
  ]

  yield `$ docker ${command.join(" ")}`

  const proc = Bun.spawn(["docker", ...command], {
    stdout: "pipe",
    stderr: "pipe",
    env: getDockerEnv(),
  })
  yield* mergeStreams(proc.stdout, proc.stderr)
}

export async function* streamStackUp(stackName: string) {
  yield* spawnCompose(stackName, ["up", "-d", "--remove-orphans", "--build"])
}

export async function* streamStackStop(stackName: string) {
  yield* spawnCompose(stackName, ["stop"])
}

export async function* streamStackDown(stackName: string) {
  yield* spawnCompose(stackName, ["down"])
}

export async function* streamStackRestart(stackName: string) {
  yield* spawnCompose(stackName, ["restart"])
}

export async function* streamStackPull(stackName: string) {
  yield* spawnCompose(stackName, ["pull"])
}

export const stackUpServices = async (stackName: string, services: string[]) => {
  const composePath = await findComposePath(stackName)
  const envPath = await findEnvPath(stackName)
  const configPath = env.DOCKER_CONFIG_DIR_PATH
  if (envPath) {
    await Bun.$`docker --config ${configPath} compose -f ${composePath} --env-file ${envPath} up -d ${services}`.env(
      getDockerEnv(),
    )
  } else {
    await Bun.$`docker --config ${configPath} compose -f ${composePath} up -d ${services}`.env(
      getDockerEnv(),
    )
  }
}

export const getRunningServices = async (stackName: string): Promise<string[]> => {
  const containers = await dockerClient.listContainers({
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
      status: ["running"],
    }),
  })
  return [...new Set(containers.map((c) => c.Labels["com.docker.compose.service"]).filter(Boolean))]
}

export const getStackStatus = async (stackName: string): Promise<StackStatus> => {
  const containers = await dockerClient.listContainers({
    all: true,
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
    }),
  })
  if (containers.length === 0) return "down"
  const restarting = containers.filter((c) => c.State === "restarting")
  const running = containers.filter((c) => c.State === "running")
  if (running.length === 0 && restarting.length === 0) return "stopped"
  if (running.length === 0) return "restarting"
  if (running.length + restarting.length < containers.length || restarting.length > 0)
    return "partial"
  if (running.some((c) => c.Status.includes("(unhealthy)"))) return "unhealthy"
  if (running.some((c) => c.Status.includes("(health: starting)"))) return "starting"
  if (running.every((c) => c.Status.includes("(healthy)"))) return "healthy"
  return "running"
}

export const redeployAllRunningStacks = async (): Promise<RedeployResult[]> => {
  const skipList = env.REDEPLOY_SKIP
  const names = await listStacks()
  const results = await Promise.allSettled<RedeployResult>(
    names
      .filter((name) => !skipList.includes(name))
      .map(async (name) => {
        const services = await getRunningServices(name)
        if (services.length === 0) return { name, action: "skipped" }
        await stackUpServices(name, services)
        return { name, action: "redeployed", services }
      }),
  )
  return results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { name: names[i], action: "error", error: String(r.reason) },
  )
}
