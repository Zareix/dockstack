package main

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/robfig/cron/v3"

	"github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/config"
	"github.com/zareix/dockstack/internal/db"
	"github.com/zareix/dockstack/internal/server"
)

func main() {
	if err := config.LoadDotEnv(); err != nil {
		fatal("dotenv", err)
	}

	setupLogging()

	cfg, err := config.Load()
	if err != nil {
		fatal("config", err)
	}

	sqlDB, err := db.Open(cfg.DatabasePath)
	if err != nil {
		fatal("db", err)
	}
	defer sqlDB.Close()

	if err := db.Migrate(sqlDB); err != nil {
		fatal("migrate", err)
	}
	if err := db.Seed(context.Background(), sqlDB, cfg.AdminEmail); err != nil {
		fatal("seed", err)
	}

	secure := strings.HasPrefix(strings.ToLower(cfg.AppURL), "https://")
	store := auth.NewStore(sqlDB, cfg.AuthSecret, secure)
	keys := auth.NewAPIKeyStore(sqlDB)

	rpID, origin := webauthnParams(cfg)
	passkeys, err := auth.NewPasskeyService(sqlDB, rpID, cfg.AppTitle, origin)
	if err != nil {
		fatal("passkeys", err)
	}

	app, err := server.NewApp(cfg)
	if err != nil {
		fatal("docker client", err)
	}

	srv := server.New(cfg, sqlDB, store, keys, passkeys, app)

	if cfg.DockerSystemPruneCron != "" {
		startPruneCron(cfg, app)
	}

	addr := ":" + portFromHost(cfg.ServerHost)
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("dockstack listening", "addr", addr, "title", cfg.AppTitle)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fatal("server", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	slog.Info("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(ctx)
}

// setupLogging configures the default slog logger. LOG_FORMAT=json switches to
// JSON output; LOG_LEVEL (debug|info|warn|error) sets the level, default info.
func setupLogging() {
	var level slog.Level
	switch strings.ToLower(os.Getenv("LOG_LEVEL")) {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	opts := &slog.HandlerOptions{Level: level}
	var handler slog.Handler
	if strings.ToLower(os.Getenv("LOG_FORMAT")) == "json" {
		handler = slog.NewJSONHandler(os.Stderr, opts)
	} else {
		handler = slog.NewTextHandler(os.Stderr, opts)
	}
	slog.SetDefault(slog.New(handler))
}

// fatal logs an error with a context string and exits.
func fatal(context string, err error) {
	slog.Error(context, "error", err)
	os.Exit(1)
}

// webauthnParams derives the relying-party ID and origin from APP_URL.
func webauthnParams(cfg *config.Config) (string, string) {
	if cfg.AppURL != "" {
		u, err := url.Parse(cfg.AppURL)
		if err == nil {
			return u.Hostname(), strings.TrimSuffix(cfg.AppURL, "/")
		}
	}
	return "localhost", "http://localhost:3000"
}

// portFromHost extracts the port from a SERVER_HOST value like "localhost" or
// "0.0.0.0:8080", defaulting to :3000.
func portFromHost(host string) string {
	if strings.Contains(host, ":") {
		_, port, err := net.SplitHostPort(host)
		if err == nil && port != "" {
			return port
		}
	}
	return "3000"
}

func startPruneCron(cfg *config.Config, app *server.App) {
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
