import { dockerClient } from "./client"

export type LogEntry = {
  containerName: string
  message: string
  stream: "stdout" | "stderr"
  timestamp: string
}

export const streamStackLogs = async function* (stackName: string) {
  const containers = await dockerClient.listContainers({
    filters: JSON.stringify({
      label: [`com.docker.compose.project=${stackName}`],
    }),
  })

  const queue: LogEntry[] = []
  let done = 0
  let notify: (() => void) | null = null

  const finish = () => {
    done++
    const fn = notify
    if (fn) fn()
  }

  const decoder = new TextDecoder()

  const processStream = async (
    stream: ReadableStream<Uint8Array>,
    containerName: string,
    streamType: "stdout" | "stderr",
  ) => {
    const reader = stream.getReader()
    let buf = ""
    try {
      // oxlint-disable-next-line
      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split("\n")
        buf = parts.pop() ?? ""
        for (const line of parts) {
          if (!line) continue
          const spaceIdx = line.indexOf(" ")
          const timestamp = spaceIdx > -1 ? line.slice(0, spaceIdx) : ""
          const message = spaceIdx > -1 ? line.slice(spaceIdx + 1) : line
          queue.push({ containerName, message, stream: streamType, timestamp })
          const fn = notify
          if (fn) fn()
        }
      }
      if (buf) {
        queue.push({
          containerName,
          message: buf,
          stream: streamType,
          timestamp: "",
        })
        const fn = notify
        if (fn) fn()
      }
    } finally {
      reader.releaseLock()
    }
  }

  for (const info of containers) {
    const containerName = info.Names[0]?.replace(/^\//, "") ?? info.Id.slice(0, 12)
    ;(async () => {
      try {
        const proc = Bun.spawn(
          ["docker", "logs", "--follow", "--timestamps", "--tail", "1000", info.Id],
          { stdout: "pipe", stderr: "pipe" },
        )
        await Promise.all([
          processStream(proc.stdout, containerName, "stdout"),
          processStream(proc.stderr, containerName, "stderr"),
        ])
      } catch {
        // container may have stopped or been removed
      } finally {
        finish()
      }
    })()
  }

  while (done < containers.length || queue.length > 0) {
    if (queue.length === 0) {
      await new Promise<void>((r) => (notify = r))
      notify = null
    }
    while (queue.length > 0) yield queue.shift()!
  }
}
