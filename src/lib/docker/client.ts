import Docker from "dockerode"

import { env } from "#/env.ts"

export const COMPOSE_FILENAMES = [
  "compose.yaml",
  "compose.yml",
  "docker-compose.yml",
  "docker-compose.yaml",
]

export const dockerClient = new Docker({ socketPath: "/var/run/docker.sock" })

const registryFromTag = (tag: string): string => {
  const parts = tag.split("/")
  if (parts.length > 1 && (parts[0].includes(".") || parts[0].includes(":"))) {
    return parts[0]
  }
  return "https://index.docker.io/v1/"
}

export const getAuthConfig = async (
  tag: string,
): Promise<{ username: string; password: string; serveraddress: string } | undefined> => {
  const registry = registryFromTag(tag)
  const file = Bun.file(`${env.DOCKER_CONFIG_DIR_PATH}/config.json`)
  if (!(await file.exists())) return undefined
  const config = (await file.json()) as {
    auths?: Record<string, { auth: string }>
  }
  const entry = config.auths?.[registry]
  if (!entry?.auth) return undefined
  const [username, ...rest] = Buffer.from(entry.auth, "base64").toString("utf8").split(":")
  return { username, password: rest.join(":"), serveraddress: registry }
}
