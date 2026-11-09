package docker

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/distribution/reference"
)

const imageResolveTimeout = 3 * time.Second

type composeImageRef struct {
	Service string
	Image   string
}

func composeImageRefs(cfg resolvedComposeConfig) []composeImageRef {
	refs := []composeImageRef{}
	for _, name := range sortedServiceNames(cfg) {
		image := strings.TrimSpace(cfg.Services[name].Image)
		if image == "" {
			continue
		}
		if _, err := reference.ParseNormalizedNamed(image); err != nil {
			continue
		}
		refs = append(refs, composeImageRef{Service: name, Image: image})
	}
	return refs
}

func (s *Stacks) imageWarnings(ctx context.Context, cfg resolvedComposeConfig) []string {
	if s.client == nil {
		return nil
	}
	refs := composeImageRefs(cfg)
	if len(refs) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, imageResolveTimeout)
	defer cancel()
	return resolveImageWarnings(ctx, refs, s.client.ResolveImage)
}

func resolveImageWarnings(
	ctx context.Context,
	refs []composeImageRef,
	resolve func(context.Context, string) (string, error),
) []string {
	cache := map[string]error{}
	warnings := []string{}
	for _, ref := range refs {
		err, ok := cache[ref.Image]
		if !ok {
			_, err = resolve(ctx, ref.Image)
			cache[ref.Image] = err
		}
		if err == nil || errors.Is(err, errRegistryUnavailable) {
			continue
		}
		warnings = append(warnings, fmt.Sprintf(
			"image %q for service %q could not be resolved: %s",
			ref.Image, ref.Service, err,
		))
	}
	return warnings
}
