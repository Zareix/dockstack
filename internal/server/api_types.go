package server

import dockerapi "github.com/zareix/dockstack/internal/docker"

// Type aliases so swag can resolve response types for OpenAPI generation.
type Stack = dockerapi.Stack
type RedeployResult = dockerapi.RedeployResult
type ContainerInfo = dockerapi.ContainerInfo
type PruneResult = dockerapi.PruneResult
type ImageInfo = dockerapi.ImageInfo
type VolumeInfo = dockerapi.VolumeInfo
type NetworkInfo = dockerapi.NetworkInfo
