package main

import (
	"fmt"
	"os"

	"github.com/go-chi/chi/v5"

	"github.com/zareix/dockstack/internal/config"
	dockerapi "github.com/zareix/dockstack/internal/docker"
	"github.com/zareix/dockstack/internal/server/api"
	apiauth "github.com/zareix/dockstack/internal/server/api/auth"
)

func main() {
	cfg := &config.Config{
		AppTitle:        "Dockstack API",
		ServerHost:      "localhost",
		StacksDir:       "./stacks",
		DockerHost:      "unix:///var/run/docker.sock",
		DockerConfigDir: "./.docker",
	}

	dockerClient, err := dockerapi.NewClient(cfg.DockerHost, cfg.DockerConfigDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, "docker client:", err)
		os.Exit(1)
	}

	deps := &api.Deps{
		Deps: &apiauth.Deps{
			Cfg: cfg,
		},
		Docker: dockerClient,
		Stacks: dockerapi.NewStacks(dockerClient, cfg.StacksDir, cfg.DockerConfigDir, cfg.ServerHost, ""),
	}

	api := api.Mount(chi.NewRouter(), deps)

	out := os.Stdout
	if len(os.Args) > 1 {
		f, err := os.Create(os.Args[1])
		if err != nil {
			fmt.Fprintln(os.Stderr, "create file:", err)
			os.Exit(1)
		}
		defer f.Close()
		out = f
	}

	yaml, err := api.OpenAPI().YAML()
	if err != nil {
		fmt.Fprintln(os.Stderr, "marshal spec:", err)
		os.Exit(1)
	}
	if _, err := out.Write(yaml); err != nil {
		fmt.Fprintln(os.Stderr, "write spec:", err)
		os.Exit(1)
	}
}
