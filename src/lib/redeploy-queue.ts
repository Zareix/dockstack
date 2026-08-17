import { Bunqueue } from "bunqueue/client"

import { redeployAllRunningStacks, type RedeployResult } from "#/lib/docker"

/**
 * File de redeploy en mémoire basée sur bunqueue (mode embarqué).
 *
 * Sans `dataPath`, bunqueue tourne en mémoire (perdue au restart) — suffisant
 * pour un redeploy idempotent que le prochain webhook rattrapera.
 *
 * - `concurrency: 1`  : sérialise les passes (une seule à la fois) ;
 * - `retry`           : relance les passes échouées (backoff exponentiel) ;
 * - `deduplication`   : fusionne les webhooks répétés (même job dans la fenêtre).
 */
export const redeployQueue = new Bunqueue<unknown, RedeployResult[]>("redeploy", {
  embedded: true,
  concurrency: 1,
  processor: async () => redeployAllRunningStacks(),
  retry: { maxAttempts: 3, delay: 30_000, strategy: "exponential" },
  deduplication: { ttl: 10_000, replace: true },
})

export const enqueueRedeploy = () => redeployQueue.add("redeploy", {})

export const isRedeployRunning = async () => (await redeployQueue.getJobCountsAsync()).active > 0

export const redeployQueueSize = async () => (await redeployQueue.getJobCountsAsync()).waiting

// Arrêt propre du worker à la sortie du process.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void redeployQueue.close().finally(() => process.exit(0))
  })
}
