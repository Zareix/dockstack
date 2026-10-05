package docker

import (
	"context"
	"sort"
	"strings"
	"sync"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/volume"
)

func (c *Client) SystemPrune(ctx context.Context, includeVolumes bool) (SystemPruneResult, error) {
	var res SystemPruneResult
	var err error

	res.Containers, err = c.ContainerPrune(ctx)
	if err != nil {
		return res, err
	}
	res.Images, err = c.ImagePrune(ctx)
	if err != nil {
		return res, err
	}
	res.Networks, err = c.NetworkPrune(ctx)
	if err != nil {
		return res, err
	}
	if includeVolumes {
		res.Volumes, err = c.VolumePrune(ctx)
		if err != nil {
			return res, err
		}
	}
	res.TotalSpaceReclaimed = res.Containers.SpaceReclaimed +
		res.Images.SpaceReclaimed +
		res.Volumes.SpaceReclaimed
	return res, nil
}

func (c *Client) ListVolumesInfo(ctx context.Context) ([]VolumeInfo, error) {
	volumes, err := c.ListVolumes(ctx)
	if err != nil {
		return nil, err
	}
	df, err := c.api.DiskUsage(ctx, types.DiskUsageOptions{})
	if err != nil {
		return nil, err
	}
	usage := map[string]volume.UsageData{}
	for _, v := range df.Volumes {
		if v.UsageData != nil {
			usage[v.Name] = *v.UsageData
		}
	}
	out := make([]VolumeInfo, 0, len(volumes))
	for _, v := range volumes {
		u, ok := usage[v.Name]
		size := int64(-1)
		inUse := false
		if ok {
			size = int64(u.Size)
			inUse = u.RefCount > 0
		}
		status := "unused"
		if inUse {
			status = "in-use"
		}
		out = append(out, VolumeInfo{
			Name:    v.Name,
			Driver:  v.Driver,
			Created: v.CreatedAt,
			Size:    size,
			InUse:   inUse,
			Status:  VolumeStatus(status),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func (c *Client) ListNetworksInfo(ctx context.Context) ([]NetworkInfo, error) {
	networks, err := c.ListNetworks(ctx)
	if err != nil {
		return nil, err
	}
	containers, err := c.ListContainers(ctx, true, "")
	if err != nil {
		return nil, err
	}
	used := map[string]bool{}
	for _, ct := range containers {
		if ct.NetworkSettings == nil {
			continue
		}
		for name := range ct.NetworkSettings.Networks {
			used[name] = true
		}
	}
	systemNetworks := map[string]bool{"bridge": true, "host": true, "none": true}
	out := make([]NetworkInfo, 0, len(networks))
	for _, n := range networks {
		status := "unused"
		if systemNetworks[n.Name] {
			status = "system"
		} else if used[n.Name] {
			status = "in-use"
		}
		out = append(out, NetworkInfo{
			ID:     truncateID(n.ID),
			Name:   n.Name,
			Driver: n.Driver,
			Scope:  n.Scope,
			Status: NetworkStatus(status),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func (c *Client) ListImagesInfo(ctx context.Context) ([]ImageInfo, error) {
	images, err := c.ListImages(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]ImageInfo, 0, len(images))
	for _, img := range images {
		out = append(out, ImageInfo{
			ID:          formatImageTag(img.ID),
			Tags:        img.RepoTags,
			RepoDigests: img.RepoDigests,
			Size:        img.Size,
			Created:     img.Created,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Created > out[j].Created })
	return out, nil
}

func (c *Client) CheckImagesStale(ctx context.Context) map[string]StaleStatus {
	images, err := c.ListImagesInfo(ctx)
	if err != nil {
		return map[string]StaleStatus{}
	}
	results := make(map[string]StaleStatus, len(images))
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, img := range images {
		if len(img.Tags) == 0 || len(img.RepoDigests) == 0 {
			results[img.ID] = StaleUnknown
			continue
		}
		wg.Add(1)
		go func(img ImageInfo) {
			defer wg.Done()
			status := StaleUnknown
			if digest, ok := c.RemoteDigest(ctx, img.Tags[0]); ok {
				for _, d := range img.RepoDigests {
					if strings.Contains(d, digest) {
						status = StaleUpToDate
						break
					}
				}
				if status != StaleUpToDate {
					status = StaleOutdated
				}
			}
			mu.Lock()
			results[img.ID] = status
			mu.Unlock()
		}(img)
	}
	wg.Wait()
	return results
}
