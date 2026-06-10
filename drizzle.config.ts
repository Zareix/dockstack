import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: [".env.local", ".env"] })

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${process.env.DATABASE_PATH}`,
  },
})
