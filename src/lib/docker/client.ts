import Docker from "dockerode"

export const COMPOSE_FILENAMES = [
  "compose.yaml",
  "compose.yml",
  "docker-compose.yml",
  "docker-compose.yaml",
]

export const dockerClient = new Docker({ socketPath: "/var/run/docker.sock" })
