import { ApiError } from "#/lib/api/orval-mutator"

async function errorMessage(res: Response) {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function exportStack(name: string, includeEnv: boolean) {
  const res = await fetch(
    `/api/stacks/${encodeURIComponent(name)}/export?includeEnv=${includeEnv}`,
    { credentials: "same-origin" },
  )
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = `${name}.zip`
  link.click()
  URL.revokeObjectURL(url)
}

export async function importStack(name: string, file: File): Promise<string> {
  const body = new FormData()
  body.set("name", name)
  body.set("file", file)
  const res = await fetch("/api/stacks/import", {
    method: "POST",
    credentials: "same-origin",
    body,
  })
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  const data = (await res.json()) as { name: string }
  return data.name
}
