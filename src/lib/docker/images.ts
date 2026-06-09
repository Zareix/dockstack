import { dockerClient } from './client'

export type ImageInfo = {
  id: string
  tags: string[]
  repoDigests: string[]
  size: number
  created: number
}

export type StaleStatus = 'outdated' | 'up-to-date' | 'unknown'

export const formatImageTag = (tag: string) => {
  if (tag.startsWith('sha256:')) {
    return tag.replace('sha256:', '').slice(0, 12)
  }
  return tag
}

export const imageRemove = (id: string) =>
  dockerClient.getImage(id).remove({ force: true })

export const imagePrune = async () => {
  const res = await dockerClient.pruneImages({
    filters: '{"dangling":["false"]}',
  })
  return {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    prunedImages: res.ImagesDeleted ?? [],
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    spaceReclaimed: res.SpaceReclaimed ?? 0,
  }
}

export const listImages = async (): Promise<ImageInfo[]> => {
  return (await dockerClient.listImages())
    .map((i) => ({
      id: formatImageTag(i.Id),
      tags: i.RepoTags ?? [],
      repoDigests: i.RepoDigests ?? [],
      size: i.Size,
      created: i.Created,
    }))
    .sort((a, b) => b.created - a.created)
}

const getRemoteDigest = (tag: string): Promise<string> =>
  new Promise((resolve, reject) => {
    dockerClient.modem.dial(
      {
        path: `/distribution/${tag}/json`,
        method: 'GET',
        statusCodes: {
          200: true,
          401: 'unauthorized',
          404: 'not found',
          500: 'server error',
        },
      },
      (err: Error | null, data: unknown) => {
        if (err) reject(err)
        else
          resolve(
            (data as { Descriptor: { digest: string } }).Descriptor.digest,
          )
      },
    )
  })

export const checkImagesStale = async (): Promise<
  Record<string, StaleStatus>
> => {
  const images = await listImages()
  const results: Record<string, StaleStatus> = {}

  await Promise.all(
    images.map(async (image) => {
      if (image.tags.length === 0 || image.repoDigests.length === 0) {
        results[image.id] = 'unknown'
        return
      }
      try {
        const remoteDigest = await getRemoteDigest(image.tags[0])
        results[image.id] = image.repoDigests.some((d) =>
          d.includes(remoteDigest),
        )
          ? 'up-to-date'
          : 'outdated'
      } catch {
        results[image.id] = 'unknown'
      }
    }),
  )

  return results
}
