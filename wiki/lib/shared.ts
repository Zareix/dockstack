export const appName = "Dockstack"
export const docsRoute = "/docs"
export const docsImageRoute = "/dockstack/og/docs"
export const docsContentRoute = "/llms.mdx/docs"

export const gitConfig = {
  user: "zareix",
  repo: "dockstack",
  branch: "main",
  directory: "wiki/",
}

export interface EnvVarInfo {
  description: string
  required?: boolean
  default?: string
  dockerDefault?: string
}

export const envVars: Record<string, EnvVarInfo> = {
  BETTER_AUTH_SECRET: {
    description:
      "Secret key for session signing (min 32 chars). Generate with `openssl rand -hex 32`",
    required: true,
  },
  BETTER_AUTH_URL: {
    description: "Public URL of the Dockstack instance",
    required: true,
  },
  ADMIN_EMAIL: {
    description: "Email of the initial admin user (default password `password`)",
    required: true,
  },
  APP_TITLE: {
    description: "Title shown in the UI",
    default: "Dockstack",
  },
  INSTANCE_NAME: {
    description: "Name of this instance, shown in the UI to tell instances apart",
  },
  SERVER_HOST: {
    description: "Host shown in port links in the UI",
    default: "localhost",
  },
  STACKS_DIR: {
    description: "Path to the stacks directory inside the container",
    default: "./stacks",
    dockerDefault: "/app/stacks",
  },
  DATABASE_PATH: {
    description: "Path to the SQLite auth database",
    default: "./db.sqlite",
    dockerDefault: "/app/data/db.sqlite",
  },
  PORT: {
    description: "HTTP port the server listens on",
    default: "3000",
  },
  DOCKER_CONFIG_DIR_PATH: {
    description:
      "Path to Docker config directory (passed as `docker --config`), useful for private registry auth",
    default: "./.docker",
    dockerDefault: "/app/.docker",
  },
  DOCKER_SYSTEM_PRUNE_CRON: {
    description:
      "Cron expression to schedule automatic `docker system prune` (e.g. `0 3 * * *` for 3 AM daily)",
  },
  DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES: {
    description: "Set to `true` to also prune unused volumes during the scheduled prune",
    default: "false",
  },
  REDEPLOY_SKIP: {
    description: "Comma-separated list of service names to skip during redeploy",
  },
  OTHER_INSTANCE_URLS: {
    description:
      "Other Dockstack instances, listed in a dropdown when clicking the app title in the sidebar. Format `name1,url1;name2,url2`",
  },
  AUTODETECT_URL_BASE_DOMAIN: {
    description: "Base domain used to build service URLs from detected proxy labels",
  },
}
