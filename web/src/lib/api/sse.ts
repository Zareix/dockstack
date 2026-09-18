export const HEARTBEAT = "\u200b"

async function* sseStream(path: string): AsyncGenerator<string, void, unknown> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
  })
  if (!res.ok) {
    throw new Error(`stream request failed: ${res.status} ${res.statusText}`)
  }
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue
          yield line.slice(6)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export const streamStackAction =
  (
    stackName: string,
    action: "up" | "stop" | "down" | "restart" | "pull",
  ): (() => Promise<AsyncIterable<string>>) =>
  () =>
    Promise.resolve(sseStream(`/api/stacks/${encodeURIComponent(stackName)}/${action}/stream`))
