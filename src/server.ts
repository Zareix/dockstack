import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { migrateDB } from '#/db/migrate'
import { seed } from '#/db/seed'
import { env } from '#/env'
import * as docker from '#/lib/docker'

await migrateDB()
await seed()

const { DOCKER_SYSTEM_PRUNE_CRON, DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES } = env

if (DOCKER_SYSTEM_PRUNE_CRON) {
  console.log(
    `Starting cron job for docker system prune${DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES ? ' (including volumes)' : ''}: ${DOCKER_SYSTEM_PRUNE_CRON}`,
  )
  Bun.cron(DOCKER_SYSTEM_PRUNE_CRON, async () => {
    try {
      console.log(
        `Running docker system prune${DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES ? ' (including volumes)' : ''}...`,
      )
      const results = await docker.systemPrune(
        DOCKER_SYSTEM_PRUNE_INCLUDE_VOLUMES,
      )
      const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`
      console.log(
        [
          'Docker system prune complete:',
          `  containers : ${results.containers.deleted.length} removed`,
          `  images     : ${results.images.deleted.length} removed`,
          `  networks   : ${results.networks.deleted.length} removed`,
          `  volumes    : ${results.volumes.deleted.length} removed`,
          `  reclaimed  : ${mb(results.totalSpaceReclaimed)}`,
        ].join('\n'),
      )
    } catch (error) {
      console.error(error)
    }
  })
}

export default createServerEntry({
  fetch(req) {
    return handler.fetch(req)
  },
})
