import { Bunqueue } from "bunqueue/client"

import { redeployAllRunningStacks, type RedeployResult } from "#/lib/docker"
export const redeployQueue = {
  _queue: new Bunqueue<unknown, RedeployResult[]>("redeploy", {
    embedded: true,
    concurrency: 1,
    processor: async () => redeployAllRunningStacks(),
    retry: { maxAttempts: 3, delay: 30_000, strategy: "exponential" },
    deduplication: { ttl: 10_000, replace: true },
  }),
  enqueueRedeploy: () => redeployQueue._queue.add("redeploy", {}),
  isRunning: async () => (await redeployQueue._queue.getJobCountsAsync()).active > 0,
  size: async () => (await redeployQueue._queue.getJobCountsAsync()).waiting,
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void redeployQueue._queue.close().finally(() => process.exit(0))
  })
}
