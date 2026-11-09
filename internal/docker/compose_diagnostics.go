package docker

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/distribution/reference"
	"gopkg.in/yaml.v3"
)

var (
	composeVarRe = regexp.MustCompile(`\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)([^}]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)`)
	envKeyRe     = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
)

type resolvedComposeConfig struct {
	Services map[string]resolvedService `yaml:"services"`
}

type resolvedService struct {
	Image string         `yaml:"image"`
	Ports []resolvedPort `yaml:"ports"`
}

type resolvedPort struct {
	HostIP    string `yaml:"host_ip"`
	Published any    `yaml:"published"`
	Protocol  string `yaml:"protocol"`
}

type hostBinding struct {
	service  string
	hostIP   string
	protocol string
	start    int
	end      int
}

func composeEnvUsage(compose string, env *string) ComposeEnvUsage {
	usedSet := map[string]struct{}{}
	requiredSet := map[string]struct{}{}
	for _, match := range composeVarRe.FindAllStringSubmatch(compose, -1) {
		name := match[1]
		rest := match[2]
		if name == "" {
			name = match[3]
			rest = ""
		}
		if name == "" {
			continue
		}
		usedSet[name] = struct{}{}
		if !hasFallback(rest) {
			requiredSet[name] = struct{}{}
		}
	}

	envKeys := map[string]struct{}{}
	if env != nil {
		for _, key := range parseEnvKeys(*env) {
			envKeys[key] = struct{}{}
		}
	}

	available := map[string]struct{}{}
	for _, kv := range getDockerEnv() {
		key, _, _ := strings.Cut(kv, "=")
		available[key] = struct{}{}
	}

	unusedSet := map[string]struct{}{}
	for key := range envKeys {
		if _, ok := usedSet[key]; !ok {
			unusedSet[key] = struct{}{}
		}
	}

	missingSet := map[string]struct{}{}
	for key := range requiredSet {
		if _, ok := envKeys[key]; ok {
			continue
		}
		if _, ok := available[key]; !ok {
			missingSet[key] = struct{}{}
		}
	}

	return ComposeEnvUsage{
		Used:    sortedKeys(usedSet),
		Unused:  sortedKeys(unusedSet),
		Missing: sortedKeys(missingSet),
	}
}

func hasFallback(rest string) bool {
	return strings.HasPrefix(rest, ":-") ||
		strings.HasPrefix(rest, "-") ||
		strings.HasPrefix(rest, ":+") ||
		strings.HasPrefix(rest, "+")
}

func parseEnvKeys(env string) []string {
	keys := []string{}
	for line := range strings.SplitSeq(env, "\n") {
		line = strings.TrimSpace(strings.TrimPrefix(line, "\ufeff"))
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		key, _, _ := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if envKeyRe.MatchString(key) {
			keys = append(keys, key)
		}
	}
	return keys
}

func sortedKeys(set map[string]struct{}) []string {
	keys := make([]string, 0, len(set))
	for key := range set {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func composeStaticWarnings(resolved string) []string {
	cfg, ok := parseResolvedCompose(resolved)
	if !ok {
		return nil
	}
	warnings := invalidImageWarnings(cfg)
	return append(warnings, duplicatePortWarnings(cfg)...)
}

func parseResolvedCompose(resolved string) (resolvedComposeConfig, bool) {
	var cfg resolvedComposeConfig
	if strings.TrimSpace(resolved) == "" {
		return cfg, false
	}
	if err := yaml.Unmarshal([]byte(resolved), &cfg); err != nil {
		return cfg, false
	}
	return cfg, true
}

func composePortBindings(cfg resolvedComposeConfig) []hostBinding {
	bindings := []hostBinding{}
	for _, name := range sortedServiceNames(cfg) {
		for _, port := range cfg.Services[name].Ports {
			published := strings.TrimSpace(fmt.Sprint(port.Published))
			if published == "" || published == "<nil>" {
				continue
			}
			start, end, ok := parsePortRange(published)
			if !ok {
				continue
			}
			protocol := port.Protocol
			if protocol == "" {
				protocol = "tcp"
			}
			bindings = append(bindings, hostBinding{
				service:  name,
				hostIP:   normalizeHostIP(port.HostIP),
				protocol: protocol,
				start:    start,
				end:      end,
			})
		}
	}
	return bindings
}

func sortedServiceNames(cfg resolvedComposeConfig) []string {
	names := make([]string, 0, len(cfg.Services))
	for name := range cfg.Services {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func invalidImageWarnings(cfg resolvedComposeConfig) []string {
	warnings := []string{}
	for _, name := range sortedServiceNames(cfg) {
		image := strings.TrimSpace(cfg.Services[name].Image)
		if image == "" {
			continue
		}
		if _, err := reference.ParseNormalizedNamed(image); err != nil {
			warnings = append(warnings, fmt.Sprintf("service %q has invalid image reference %q", name, image))
		}
	}
	return warnings
}

func duplicatePortWarnings(cfg resolvedComposeConfig) []string {
	warnings := []string{}
	seen := map[string]struct{}{}
	bindings := composePortBindings(cfg)
	for index, binding := range bindings {
		for _, existing := range bindings[:index] {
			if existing.protocol != binding.protocol ||
				!portRangesOverlap(binding.start, binding.end, existing.start, existing.end) ||
				!hostIPsConflict(binding.hostIP, existing.hostIP) {
				continue
			}
			key := fmt.Sprintf("%s/%d-%d/%s/%s", binding.protocol, binding.start, binding.end, existing.service, binding.service)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			warnings = append(warnings, portWarning(binding.service, existing.service, binding.protocol, binding.start, binding.end))
		}
	}
	return warnings
}

func portWarning(name, existing, protocol string, start, end int) string {
	port := strconv.Itoa(start)
	if start != end {
		port = fmt.Sprintf("%d-%d", start, end)
	}
	if name == existing {
		return fmt.Sprintf("host port %s/%s is published more than once by service %q", port, protocol, name)
	}
	return fmt.Sprintf("host port %s/%s is published by services %q and %q", port, protocol, existing, name)
}

func parsePortRange(value string) (int, int, bool) {
	if start, end, ok := strings.Cut(value, "-"); ok {
		first, err := strconv.Atoi(start)
		if err != nil {
			return 0, 0, false
		}
		last, err := strconv.Atoi(end)
		if err != nil || first > last {
			return 0, 0, false
		}
		return first, last, true
	}
	port, err := strconv.Atoi(value)
	if err != nil {
		return 0, 0, false
	}
	return port, port, true
}

func portRangesOverlap(aStart, aEnd, bStart, bEnd int) bool {
	return aStart <= bEnd && bStart <= aEnd
}

func normalizeHostIP(ip string) string {
	ip = strings.TrimSpace(ip)
	ip = strings.TrimPrefix(ip, "[")
	return strings.TrimSuffix(ip, "]")
}

func hostIPsConflict(a, b string) bool {
	wildcard := func(ip string) bool { return ip == "" || ip == "0.0.0.0" || ip == "::" }
	return wildcard(a) || wildcard(b) || a == b
}
