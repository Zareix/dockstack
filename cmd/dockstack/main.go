package main

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/config"
	"github.com/zareix/dockstack/internal/db"
	"github.com/zareix/dockstack/internal/logging"
	"github.com/zareix/dockstack/internal/server"
	"github.com/zareix/dockstack/internal/server/api"
)

const Version = "1.0.0"

func main() {
	api.Version = Version
	if err := config.LoadDotEnv(); err != nil {
		fatal("dotenv", err)
	}

	logging.Setup()

	cfg, err := config.Load()
	if err != nil {
		fatal("config", err)
	}

	sqlDB, err := db.Open(cfg.DatabasePath)
	if err != nil {
		fatal("db", err)
	}
	defer func() {
		if err := sqlDB.Close(); err != nil {
			fatal("db", err)
		}
	}()

	if err := db.Migrate(sqlDB); err != nil {
		fatal("migrate", err)
	}
	if err := db.Seed(context.Background(), sqlDB, cfg.AdminEmail); err != nil {
		fatal("seed", err)
	}

	store, err := auth.NewStore(cfg, sqlDB)
	if err != nil {
		fatal("store", err)
	}

	srv, app, err := server.New(cfg, sqlDB, store)
	if err != nil {
		fatal("server", err)
	}

	if cfg.DockerSystemPruneCron != "" {
		server.StartPruneCron(cfg, app)
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

func fatal(context string, err error) {
	slog.Error(context, "error", err)
	os.Exit(1)
}

func portFromHost(host string) string {
	if strings.Contains(host, ":") {
		_, port, err := net.SplitHostPort(host)
		if err == nil && port != "" {
			return port
		}
	}
	return "3000"
}
