import { writeFile } from 'node:fs/promises'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { env } from '#/env'

export const migrateDB = async () => {
  if (!(await Bun.file(env.DATABASE_PATH).exists())) {
    console.log('Database file created')
    await writeFile(env.DATABASE_PATH, '')
  }

  console.log('Migrating database...')

  const sqlite = new Database(env.DATABASE_PATH)
  sqlite.run('PRAGMA journal_mode = WAL;')
  sqlite.run('PRAGMA foreign_keys = ON;')
  const db = drizzle(sqlite)
  migrate(db, { migrationsFolder: './drizzle' })

  console.log('Database migrated')

  db.$client.close()
}
