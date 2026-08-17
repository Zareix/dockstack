import PQueue from "p-queue"

import { redeployAllRunningStacks } from "#/lib/docker"

const queue = new PQueue({ concurrency: 1 })

export const redeployQueue = {
  enqueueRedeploy: () =>
    queue.add(async () => {
      console.log("Running job redeploy")
      const results = await redeployAllRunningStacks()
      console.log("Job redeploy completed", results)
    }),
  isRedeployRunning: () => queue.pending > 0,
  redeployQueueSize: () => queue.size,
}
