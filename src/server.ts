import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { migrateDB } from '#/db/migrate'
import { seed } from '#/db/seed'

await migrateDB()
await seed()

export default createServerEntry({
  fetch(req) {
    return handler.fetch(req)
  },
})
