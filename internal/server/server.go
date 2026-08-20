package server

import (
	"database/sql"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/zareix/dockstack/internal/auth"
	"github.com/zareix/dockstack/internal/config"
	dockerapi "github.com/zareix/dockstack/internal/docker"
)

// App bundles the docker-facing domain services used by API handlers.
type App struct {
	cfg    *config.Config
	docker *dockerapi.Client
	stacks *dockerapi.Stacks
}

func NewApp(cfg *config.Config) (*App, error) {
	dockerClient, err := dockerapi.NewClient(cfg.DockerHost, cfg.DockerConfigDir)
	if err != nil {
		return nil, err
	}
	stacks := dockerapi.NewStacks(dockerClient, cfg.StacksDir, cfg.DockerConfigDir, cfg.ServerHost, cfg.AutodetectURLBaseDomain)
	return &App{cfg: cfg, docker: dockerClient, stacks: stacks}, nil
}

func (a *App) Docker() *dockerapi.Client { return a.docker }

func (a *App) Stacks() *dockerapi.Stacks { return a.stacks }

type Server struct {
	cfg      *config.Config
	db       *sql.DB
	store    *auth.Store
	keys     *auth.APIKeyStore
	passkeys *auth.PasskeyService
	app      *App
}

func New(cfg *config.Config, db *sql.DB, store *auth.Store, keys *auth.APIKeyStore, passkeys *auth.PasskeyService, app *App) *Server {
	return &Server{cfg: cfg, db: db, store: store, keys: keys, passkeys: passkeys, app: app}
}

func (s *Server) Handler() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(requestLogger)

	r.Get("/api/health", s.handleHealth)

	// Public settings + auth metadata
	r.Get("/api/settings", s.handleSettings)
	r.Get("/api/auth/providers", s.handleProviders)

	// Auth
	r.Mount("/api/auth", s.authRoutes())

	// Webhook (API key) — trailing-slash variant, matching the original route.
	r.With(s.requireAPIKey).Get("/api/stacks/", s.handleStacksList)
	r.With(s.requireAPIKey).Post("/api/stacks/redeploy", s.handleStacksRedeploy)

	// Session-gated API
	r.Group(func(r chi.Router) {
		r.Use(s.requireSession)
		r.Get("/api/stacks", s.handleStacksList)
		r.Post("/api/stacks", s.handleStackCreate)
		r.Get("/api/stacks/{name}", s.handleStackGet)
		r.Get("/api/stacks/{name}/containers", s.handleStackContainers)
		r.Get("/api/stacks/{name}/files", s.handleStackFilesGet)
		r.Put("/api/stacks/{name}/files", s.handleStackFilesSave)
		r.Post("/api/stacks/{name}/env", s.handleStackCreateEnv)
		r.Delete("/api/stacks/{name}", s.handleStackDestroy)
		for _, a := range stackActions {
			action := a
			r.Post("/api/stacks/{name}/"+action.path, func(w http.ResponseWriter, req *http.Request) {
				s.handleStackAction(w, req, action.args)
			})
			r.Post("/api/stacks/{name}/"+action.path+"/stream", func(w http.ResponseWriter, req *http.Request) {
				s.handleStackActionStream(w, req, action.args)
			})
		}
		r.Route("/api/containers", s.containerRoutes())
		r.Route("/api/images", s.imageRoutes())
		r.Route("/api/volumes", s.volumeRoutes())
		r.Route("/api/networks", s.networkRoutes())
	})

	// WebSockets (session or API key)
	r.HandleFunc("/api/ws/exec", s.handleWSAuth(s.handleExecWS))
	r.HandleFunc("/api/ws/logs", s.handleWSAuth(s.handleLogsWS))

	// SPA
	s.spaHandler(r)

	return r
}

// @Summary Health check
// @Description Returns 200 when the server is up.
// @Produce json
// @Success 200 {object} map[string]string
// @Router /api/health [get]
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) logError(r *http.Request, err error) {
	slog.Error("request failed", "method", r.Method, "path", r.URL.Path, "error", err)
}
