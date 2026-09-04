package server

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/config"
	dockerapi "github.com/zareix/dockstack/internal/docker"
	"github.com/zareix/dockstack/internal/server/api"
	apiauth "github.com/zareix/dockstack/internal/server/api/auth"
)

type App struct {
	cfg    *config.Config
	docker *dockerapi.Client
	stacks *dockerapi.Stacks
}

func (a *App) Docker() *dockerapi.Client { return a.docker }

func (a *App) Stacks() *dockerapi.Stacks { return a.stacks }

type Server struct {
	cfg   *config.Config
	db    *sql.DB
	store *auth.Store
	app   *App
}

func New(cfg *config.Config, db *sql.DB, store *auth.Store) (*Server, *App, error) {
	dockerClient, err := dockerapi.NewClient(cfg.DockerHost, cfg.DockerConfigDir)
	if err != nil {
		return nil, nil, err
	}
	stacks := dockerapi.NewStacks(dockerClient, cfg.StacksDir, cfg.DockerConfigDir, cfg.ServerHost, cfg.AutodetectURLBaseDomain)
	app := &App{cfg: cfg, docker: dockerClient, stacks: stacks}
	return &Server{cfg: cfg, db: db, store: store, app: app}, app, nil
}

func (s *Server) deps() *api.Deps {
	return &api.Deps{
		Deps: &apiauth.Deps{
			Cfg:   s.cfg,
			DB:    s.db,
			Store: s.store,
		},
		Docker: s.app.docker,
		Stacks: s.app.stacks,
	}
}

func (s *Server) Handler() http.Handler {
	router := chi.NewMux()
	router.Use(middleware.RequestID)
	router.Use(middleware.Recoverer)
	router.Use(requestLogger)

	api.Mount(router, s.deps())

	s.spaHandler(router)

	return router
}
