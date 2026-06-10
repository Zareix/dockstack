import { dockerClient } from "./client"

export const listNetworks = async () => {
  const [networks, containers] = await Promise.all([
    dockerClient.listNetworks(),
    dockerClient.listContainers({ all: true }),
  ])
  const usedNetworks = new Set(containers.flatMap((c) => Object.keys(c.NetworkSettings.Networks)))
  return networks
    .map((n) => ({
      id: n.Id.slice(0, 12),
      name: n.Name,
      driver: n.Driver,
      scope: n.Scope,
      status: (usedNetworks.has(n.Name) ? "in-use" : "unused") as "in-use" | "unused",
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export type NetworkInfo = Awaited<ReturnType<typeof listNetworks>>[number]
