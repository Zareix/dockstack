import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    NODE_ENV: z._default(z.enum(["development", "test", "production"]), "development"),
    BETTER_AUTH_URL: z.url().optional(),
    ADMIN_EMAIL: z.email(),
    APP_TITLE: z.string().min(1).optional().default("Dockstack"),
    SERVER_HOST: z.string().min(1),
    STACKS_DIR: z.string().min(1),
    OTHER_INSTANCE_URLS: z
      .string()
      .transform((val) =>
        val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url()))
      .optional()
      .default([]),
    DATABASE_PATH: z._default(z.string(), "./db.sqlite"),
    OAUTH_PROVIDER_ID: z.string().optional(),
    OAUTH_CLIENT_ID: z.string().optional(),
    OAUTH_CLIENT_SECRET: z.string().optional(),
    OAUTH_DISCOVERY_URL: z.url().optional(),
    DOCKER_SYSTEM_PRUNE_CRON: z.string().optional(),
    DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES: z.boolean().optional().default(false),
    REDEPLOY_SKIP: z
      .string()
      .transform((val) =>
        val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().min(1)))
      .optional()
      .default([]),
  },

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: "VITE_",

  client: {},

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: process.env,

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
})
