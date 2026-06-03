import { dockerClient } from './client'

export type ImageInfo = {
  id: string
  tags: string[]
  size: number
  created: number
}

export const imageRemove = (id: string) =>
  dockerClient.getImage(id).remove({ force: true })

export const listImages = async (): Promise<ImageInfo[]> => {
  return (await dockerClient.listImages())
    .map((i) => ({
      id: i.Id.replace('sha256:', '').slice(0, 12),
      tags: i.RepoTags ?? [],
      size: i.Size,
      created: i.Created,
    }))
    .sort((a, b) => b.created - a.created)
}
