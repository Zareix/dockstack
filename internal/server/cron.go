package server

import (
	"context"
	"log/slog"
	"strconv"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/zareix/dockstack/internal/config"
)

func StartPruneCron(cfg *config.Config, app *App) {
	c := cron.New()
	spec := cfg.DockerSystemPruneCron
	includeVolumes := cfg.DockerSystemPruneIncludeVolumes
	if _, err := c.AddFunc(spec, func() {
		slog.Info("running docker system prune", "includeVolumes", includeVolumes)
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		results, err := app.Docker().SystemPrune(ctx, includeVolumes)
		if err != nil {
			slog.Error("system prune failed", "error", err)
			return
		}
		mb := func(b int64) string { return strconv.FormatFloat(float64(b)/1024/1024, 'f', 2, 64) + " MB" }
		slog.Info("docker system prune complete",
			"containers", len(results.Containers.Deleted),
			"images", len(results.Images.Deleted),
			"networks", len(results.Networks.Deleted),
			"volumes", len(results.Volumes.Deleted),
			"reclaimed", mb(results.TotalSpaceReclaimed))
	}); err != nil {
		slog.Error("invalid cron spec", "spec", spec, "error", err)
		return
	}
	slog.Info("starting docker system prune cron", "spec", spec, "includeVolumes", includeVolumes)
	c.Start()
}
