package server

import (
	"context"
	"log/slog"
	"strconv"
	"time"

	"github.com/go-co-op/gocron/v2"
	"github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/config"
)

func StartAuthCleanupCron(cfg *config.Config, store *auth.Store) {
	run := func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		defer cancel()
		challenges, err := store.DeleteExpiredChallenges(ctx)
		if err != nil {
			slog.Error("failed to delete expired challenges", "error", err)
		}
		tokens, err := store.DeleteExpiredResetTokens(ctx)
		if err != nil {
			slog.Error("failed to delete expired reset tokens", "error", err)
		}
		if challenges > 0 || tokens > 0 {
			slog.Info("deleted expired auth rows", "challenges", challenges, "resetTokens", tokens)
		}
	}
	spec := cfg.AuthCleanupCron

	s, err := gocron.NewScheduler()
	if err != nil {
		slog.Error("failed to create scheduler", "error", err)
		return
	}
	if _, err := s.NewJob(
		gocron.CronJob(spec, false),
		gocron.NewTask(run),
	); err != nil {
		slog.Error("invalid cleanup cron spec", "spec", spec, "error", err)
		return
	}
	slog.Info("starting auth cleanup cron", "spec", spec)
	run()
	s.Start()
}

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
