export const HEARTBEAT = "​"
const HEARTBEAT_INTERVAL_MS = 5000

async function* readLines(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder()
  let buffer = ""
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })
    const parts = buffer.split("\n")
    buffer = parts.pop()!
    for (const line of parts) {
      if (line) yield line
    }
  }
  if (buffer) yield buffer
}

export async function* mergeStreams(
  stdout: ReadableStream<Uint8Array>,
  stderr: ReadableStream<Uint8Array>,
) {
  const queue: string[] = []
  let resolve: (() => void) | null = null
  let remaining = 2

  const wake = () => {
    resolve?.()
    resolve = null
  }

  const drain = async (stream: ReadableStream<Uint8Array>) => {
    for await (const line of readLines(stream)) {
      queue.push(line)
      wake()
    }
    if (--remaining === 0) wake()
  }

  drain(stdout)
  drain(stderr)

  while (remaining > 0 || queue.length > 0) {
    if (queue.length > 0) {
      yield queue.shift()!
      continue
    }

    let timedOut = false
    await Promise.race([
      new Promise<void>((r) => {
        resolve = r
      }),
      new Promise<void>((r) =>
        setTimeout(() => {
          timedOut = true
          r()
        }, HEARTBEAT_INTERVAL_MS),
      ),
    ])
    // oxlint-disable-next-line no-unnecessary-condition
    if (timedOut && queue.length === 0 && remaining > 0) yield HEARTBEAT
  }
}
