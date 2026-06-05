import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as authSchema from './schema/auth-schema'
import { env } from '@/env'

const globalForDb = globalThis as unknown as {
  client?: Database
}

export const client = globalForDb.client ?? new Database(env.DATABASE_PATH)
if (env.NODE_ENV !== 'production') globalForDb.client = client

client.run('PRAGMA journal_mode = WAL;')
client.run('PRAGMA foreign_keys = ON;')

export const db = drizzle(client, {
  schema: authSchema,
})
