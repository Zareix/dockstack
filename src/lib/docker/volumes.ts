import { dockerClient } from "./client"

export const listVolumes = async () => {
  const [volRes, dfRes] = await Promise.all([dockerClient.listVolumes(), dockerClient.df()])
  const usageMap = new Map<string, { size: number; refCount: number }>(
    (dfRes.Volumes ?? []).map(
      (v: { Name: string; UsageData?: { Size: number; RefCount: number } | null }) => [
        v.Name,
        { size: v.UsageData?.Size ?? -1, refCount: v.UsageData?.RefCount ?? 0 },
      ],
    ),
  )
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  return (volRes.Volumes ?? [])
    .map((v) => {
      const usage = usageMap.get(v.Name)
      return {
        name: v.Name,
        driver: v.Driver,
        // @ts-ignore Typing is wrong in dockerode
        created: v.CreatedAt,
        size: usage?.size ?? -1,
        status: (usage?.refCount ?? 0) > 0 ? ("in-use" as const) : ("unused" as const),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export type VolumeInfo = Awaited<ReturnType<typeof listVolumes>>[number]

export const volumeRemove = (name: string) => dockerClient.getVolume(name).remove({ force: true })

export const volumePrune = async () => {
  const res = await dockerClient.pruneVolumes({ filters: JSON.stringify({ all: ["true"] }) })
  return {
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    prunedVolumes: res.VolumesDeleted ?? [],
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    spaceReclaimed: res.SpaceReclaimed ?? 0,
  }
}
