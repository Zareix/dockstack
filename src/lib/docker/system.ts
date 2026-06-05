/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { dockerClient } from './client'

export type SystemPruneResult = {
  containers: { deleted: string[]; spaceReclaimed: number }
  images: { deleted: string[]; spaceReclaimed: number }
  networks: { deleted: string[] }
  volumes: { deleted: string[]; spaceReclaimed: number }
  totalSpaceReclaimed: number
}

export const systemPrune = async (
  includeVolumes = false,
): Promise<SystemPruneResult> => {
  const containers = await dockerClient.pruneContainers({})
  const images = await dockerClient.pruneImages({
    filters: JSON.stringify({ dangling: ['false'] }),
  })
  const networks = await dockerClient.pruneNetworks({})
  const volumes = includeVolumes ? await dockerClient.pruneVolumes({}) : null

  const containerSpace = containers.SpaceReclaimed ?? 0
  const imageSpace = images.SpaceReclaimed ?? 0
  const volumeSpace = volumes?.SpaceReclaimed ?? 0

  return {
    containers: {
      deleted: containers.ContainersDeleted ?? [],
      spaceReclaimed: containerSpace,
    },
    images: {
      deleted: (images.ImagesDeleted ?? []).flatMap((d) => d.Deleted),
      spaceReclaimed: imageSpace,
    },
    networks: {
      deleted: networks.NetworksDeleted ?? [],
    },
    volumes: {
      deleted: volumes?.VolumesDeleted ?? [],
      spaceReclaimed: volumeSpace,
    },
    totalSpaceReclaimed: containerSpace + imageSpace + volumeSpace,
  }
}
