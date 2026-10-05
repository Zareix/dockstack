export type LogEntry = {
  containerName: string
  message: string
  stream: "stdout" | "stderr"
  timestamp: string
}
