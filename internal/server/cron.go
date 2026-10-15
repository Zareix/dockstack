package server

import (
	"context"
	"log/slog"
	"strconv"
	"time"

	"github.com/go-co-op/gocron/v2"
	"github.com/zareix/dockstack/internal/config"
)

func StartPruneCron(cfg *config.Config, app *App) {
	s, err := gocron.NewScheduler()
	if err != nil {
		slog.Error("failed to create scheduler", "error", err)
		return
	}
	spec := cfg.DockerSystemPruneCron
	includeVolumes := cfg.DockerSystemPruneIncludeVolumes
	if _, err := s.NewJob(
		gocron.CronJob(spec, false),
		gocron.NewTask(func() {
			slog.Info("running docker system prune", "includeVolumes", includeVolumes)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()
			results, err := app.docker.SystemPrune(ctx, includeVolumes)
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
		}),
	); err != nil {
		slog.Error("invalid cron spec", "spec", spec, "error", err)
		return
	}
	slog.Info("starting docker system prune cron", "spec", spec, "includeVolumes", includeVolumes)
	s.Start()
}
