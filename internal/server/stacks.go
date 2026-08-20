package server

import (
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
)

var stackNameRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func isWithinStacksDir(base, target string) bool {
	base = filepath.Clean(base)
	target = filepath.Clean(target)
	return target == base || strings.HasPrefix(target, base+string(os.PathSeparator))
}

var stackActions = []struct {
	path string
	args []string
}{
	{"up", []string{"up", "-d", "--remove-orphans", "--build"}},
	{"stop", []string{"stop"}},
	{"down", []string{"down"}},
	{"restart", []string{"restart"}},
	{"pull", []string{"pull"}},
}

// @Summary List stacks
// @Description List all stacks with their status.
// @Tags stacks
// @Security SessionCookie
// @Security ApiKeyAuth
// @Produce json
// @Success 200 {array} Stack
// @Router /api/stacks [get]
func (s *Server) handleStacksList(w http.ResponseWriter, r *http.Request) {
	stacks, err := s.app.stacks.ListStacksWithStatus(r.Context())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to list stacks")
		return
	}
	writeJSON(w, http.StatusOK, stacks)
}

type stackGetResponse struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

// @Summary Get a stack
// @Tags stacks
// @Security SessionCookie
// @Param name path string true "Stack name"
// @Success 200 {object} stackGetResponse
// @Router /api/stacks/{name} [get]
func (s *Server) handleStackGet(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if !stackNameRe.MatchString(name) {
		writeError(w, http.StatusBadRequest, "invalid stack name")
		return
	}
	exists, err := s.app.stacks.StackExists(r.Context(), name)
	if err != nil || !exists {
		writeError(w, http.StatusNotFound, "stack not found")
		return
	}
	status, err := s.app.stacks.GetStackStatus(r.Context(), name)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to get stack status")
		return
	}
	writeJSON(w, http.StatusOK, stackGetResponse{Name: name, Status: string(status)})
}

func (s *Server) handleStackContainers(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if !stackNameRe.MatchString(name) {
		writeError(w, http.StatusBadRequest, "invalid stack name")
		return
	}
	containers, err := s.app.stacks.GetStackContainers(r.Context(), name)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to get stack containers")
		return
	}
	writeJSON(w, http.StatusOK, containers)
}

type stackFilesResponse struct {
	Compose     string  `json:"compose"`
	ComposeFile string  `json:"composeFile"`
	Env         *string `json:"env"`
}

func (s *Server) handleStackFilesGet(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if !stackNameRe.MatchString(name) {
		writeError(w, http.StatusBadRequest, "invalid stack name")
		return
	}
	composePath, err := s.app.stacks.FindComposePath(name)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	compose, err := os.ReadFile(composePath)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to read compose file")
		return
	}
	resp := stackFilesResponse{
		Compose:     string(compose),
		ComposeFile: filepath.Base(composePath),
	}
	if envPath := s.app.stacks.FindEnvPath(name); envPath != "" {
		env, err := os.ReadFile(envPath)
		if err == nil {
			envStr := string(env)
			resp.Env = &envStr
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

type stackFilesSaveRequest struct {
	ComposeFile string  `json:"composeFile"`
	Compose     string  `json:"compose"`
	Env         *string `json:"env"`
}

func (s *Server) handleStackFilesSave(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if !stackNameRe.MatchString(name) {
		writeError(w, http.StatusBadRequest, "invalid stack name")
		return
	}
	var req stackFilesSaveRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.ComposeFile == "" || filepath.Base(req.ComposeFile) != req.ComposeFile {
		writeError(w, http.StatusBadRequest, "invalid compose file name")
		return
	}
	if req.Compose == "" {
		writeError(w, http.StatusBadRequest, "compose content is required")
		return
	}
	dir := s.app.stacks.Dir()
	composePath := filepath.Join(dir, name, req.ComposeFile)
	if !isWithinStacksDir(filepath.Join(dir, name), composePath) {
		writeError(w, http.StatusBadRequest, "invalid compose file path")
		return
	}
	if err := os.WriteFile(composePath, []byte(req.Compose), 0o644); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to save compose file")
		return
	}
	if req.Env != nil {
		if err := os.WriteFile(filepath.Join(dir, name, ".env"), []byte(*req.Env), 0o644); err != nil {
			s.logError(r, err)
			writeError(w, http.StatusInternalServerError, "failed to save env file")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

type stackCreateRequest struct {
	Name string `json:"name"`
}

// @Summary Create a stack
// @Tags stacks
// @Security SessionCookie
// @Param body body stackCreateRequest true "Stack name"
// @Success 200 {object} map[string]bool
// @Router /api/stacks [post]
func (s *Server) handleStackCreate(w http.ResponseWriter, r *http.Request) {
	var req stackCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !stackNameRe.MatchString(req.Name) {
		writeError(w, http.StatusBadRequest, "invalid stack name (allowed: a-zA-Z0-9_-)")
		return
	}
	exists, err := s.app.stacks.StackExists(r.Context(), req.Name)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to check stack")
		return
	}
	if exists {
		writeError(w, http.StatusConflict, "stack already exists")
		return
	}
	dir := filepath.Join(s.app.stacks.Dir(), req.Name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to create stack directory")
		return
	}
	template := "services:\n  app:\n    image: " + req.Name + "\n    container_name: " + req.Name + "_app\n"
	if err := os.WriteFile(filepath.Join(dir, "compose.yaml"), []byte(template), 0o644); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to write starter compose file")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) handleStackCreateEnv(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if !stackNameRe.MatchString(name) {
		writeError(w, http.StatusBadRequest, "invalid stack name")
		return
	}
	dir := filepath.Join(s.app.stacks.Dir(), name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to access stack directory")
		return
	}
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte("# VAR1=example\n"), 0o644); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to write env file")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// @Summary Destroy a stack
// @Description Brings the stack down and removes its directory.
// @Tags stacks
// @Security SessionCookie
// @Param name path string true "Stack name"
// @Success 200 {object} map[string]bool
// @Router /api/stacks/{name} [delete]
func (s *Server) handleStackDestroy(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if !stackNameRe.MatchString(name) {
		writeError(w, http.StatusBadRequest, "invalid stack name")
		return
	}
	if err := s.app.stacks.RunCompose(r.Context(), name, "down"); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to bring stack down")
		return
	}
	dir := filepath.Join(s.app.stacks.Dir(), name)
	if !isWithinStacksDir(s.app.stacks.Dir(), dir) {
		writeError(w, http.StatusBadRequest, "invalid stack path")
		return
	}
	if err := os.RemoveAll(dir); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to remove stack directory")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// @Summary Redeploy running stacks
// @Description Recreate running services for all stacks (webhook, API key auth).
// @Tags stacks
// @Security ApiKeyAuth
// @Success 200 {array} RedeployResult
// @Router /api/stacks/redeploy [post]
func (s *Server) handleStacksRedeploy(w http.ResponseWriter, r *http.Request) {
	results := s.app.stacks.RedeployAllRunning(r.Context(), s.cfg.RedeploySkip)
	writeJSON(w, http.StatusOK, results)
}

func (s *Server) handleStackAction(w http.ResponseWriter, r *http.Request, args []string) {
	name := chi.URLParam(r, "name")
	if !stackNameRe.MatchString(name) {
		writeError(w, http.StatusBadRequest, "invalid stack name")
		return
	}
	if err := s.app.stacks.RunCompose(r.Context(), name, args...); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "compose command failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) handleStackActionStream(w http.ResponseWriter, r *http.Request, args []string) {
	name := chi.URLParam(r, "name")
	if !stackNameRe.MatchString(name) {
		writeError(w, http.StatusBadRequest, "invalid stack name")
		return
	}
	lines, err := s.app.stacks.StreamCompose(r.Context(), name, args...)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to start compose command")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	for line := range lines {
		escaped := strings.ReplaceAll(line, "\n", "\\n")
		if _, err := w.Write([]byte("data: " + escaped + "\n\n")); err != nil {
			return
		}
		flusher.Flush()
	}
}
