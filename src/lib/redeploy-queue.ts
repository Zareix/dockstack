import { Bunqueue } from "bunqueue/client"

import { env } from "#/env"
import { redeployAllRunningStacks, type RedeployResult } from "#/lib/docker"

/**
 * File de redeploy persistante (SQLite) basée sur bunqueue (mode embarqué).
 *
 * - `embedded: true` : queue + worker dans le process Bun (aucun broker) ;
 * - `dataPath`        : persiste les jobs dans un fichier SQLite (survit au
 *   restart), personnalisable via `REDEPLOY_QUEUE_PATH` ;
 * - `concurrency: 1`  : sérialise les passes (une seule à la fois) ;
 * - `retry`           : relance les passes échouées (backoff exponentiel) ;
 * - `deduplication`   : fusionne les webhooks répétés (même job dans la fenêtre).
 */
export const redeployQueue = new Bunqueue<unknown, RedeployResult[]>("redeploy", {
  embedded: true,
  dataPath: env.REDEPLOY_QUEUE_PATH,
  concurrency: 1,
  processor: async () => redeployAllRunningStacks(),
  retry: { maxAttempts: 3, delay: 30_000, strategy: "exponential" },
  deduplication: { ttl: 10_000, replace: true },
})

export const enqueueRedeploy = () => redeployQueue.add("redeploy", {})

export const isRedeployRunning = async () => (await redeployQueue.getJobCountsAsync()).active > 0

export const redeployQueueSize = async () => (await redeployQueue.getJobCountsAsync()).waiting

// Arrêt propre du worker (flush + fermeture SQLite) à la sortie du process.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void redeployQueue.close().finally(() => process.exit(0))
  })
}
