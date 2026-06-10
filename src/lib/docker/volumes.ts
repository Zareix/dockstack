import { dockerClient } from "./client"

export type VolumeInfo = {
  name: string
  driver: string
  mountpoint: string
  created: string
  scope: string
}

export const listVolumes = async (): Promise<VolumeInfo[]> => {
  const res = await dockerClient.listVolumes()
  return (res.Volumes ?? [])
    .map((v) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      created: v.CreatedAt ?? "",
      scope: v.Scope,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const volumeRemove = (name: string) => dockerClient.getVolume(name).remove({ force: true })

export const volumePrune = async () => {
  const res = await dockerClient.pruneVolumes({})
  return {
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    prunedVolumes: res.VolumesDeleted ?? [],
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    spaceReclaimed: res.SpaceReclaimed ?? 0,
  }
}
