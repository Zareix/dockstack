import { createEnv } from "@t3-oss/env-core"
import * as v from "valibot"

export const env = createEnv({
  server: {
    NODE_ENV: v.optional(v.picklist(["development", "test", "production"]), "development"),
    BETTER_AUTH_URL: v.optional(v.pipe(v.string(), v.url())),
    ADMIN_EMAIL: v.pipe(v.string(), v.email()),
    DOCKER_CONFIG_DIR_PATH: v.optional(v.string(), "./.docker"),
    APP_TITLE: v.optional(v.pipe(v.string(), v.minLength(1)), "Dockstack"),
    SERVER_HOST: v.optional(v.pipe(v.string(), v.minLength(1)), "localhost"),
    STACKS_DIR: v.optional(v.pipe(v.string(), v.minLength(1)), "./stacks"),
    OTHER_INSTANCE_URLS: v.pipe(
      v.optional(v.string(), ""),
      v.transform((val) =>
        val === ""
          ? []
          : val
              .split(";")
              .map((s) => {
                const [title, url] = s
                  .trim()
                  .split(",")
                  .map((t) => t.trim())
                return { title, url }
              })
              .filter(Boolean),
      ),
      v.check(
        (entries) => entries.every((e) => e.title.length > 0 && URL.canParse(e.url)),
        "Each entry must have a title and a valid url",
      ),
    ),
    DATABASE_PATH: v.optional(v.pipe(v.string(), v.minLength(1)), "./db.sqlite"),
    OAUTH_PROVIDER_ID: v.optional(v.string()),
    OAUTH_CLIENT_ID: v.optional(v.string()),
    OAUTH_CLIENT_SECRET: v.optional(v.string()),
    OAUTH_DISCOVERY_URL: v.optional(v.pipe(v.string(), v.url())),
    DOCKER_SYSTEM_PRUNE_CRON: v.optional(v.string()),
    DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES: v.optional(v.boolean(), false),
    REDEPLOY_SKIP: v.pipe(
      v.optional(v.string(), ""),
      v.transform((val) =>
        val === ""
          ? []
          : val
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
      ),
    ),
    AUTODETECT_URL_BASE_DOMAIN: v.optional(v.pipe(v.string(), v.minLength(1))),
  },
  clientPrefix: "VITE_",
  client: {},
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
