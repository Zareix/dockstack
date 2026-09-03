package api

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/danielgtaylor/huma/v2"

	"github.com/go-chi/chi/v5"
	"github.com/zareix/dockstack/internal/server/api/web"

	dockerapi "github.com/zareix/dockstack/internal/docker"
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

type nameInput struct {
	Name string `path:"name"`
}

func validateStackName(name string) error {
	if !stackNameRe.MatchString(name) {
		return huma.Error400BadRequest("invalid stack name")
	}
	return nil
}

func (d *Deps) handleStacksList(ctx context.Context, _ *struct{}) (*web.ListOutput[dockerapi.Stack], error) {
	stacks, err := d.Stacks.ListStacksWithStatus(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to list stacks")
	}
	return &web.ListOutput[dockerapi.Stack]{Body: stacks}, nil
}

type stackGetResponse struct {
	Body struct {
		Name   string                `json:"name"`
		Status dockerapi.StackStatus `json:"status"`
	}
}

func (d *Deps) handleStackGet(ctx context.Context, in *nameInput) (*stackGetResponse, error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	exists, err := d.Stacks.StackExists(ctx, in.Name)
	if err != nil || !exists {
		return nil, huma.Error404NotFound("stack not found")
	}
	status, err := d.Stacks.GetStackStatus(ctx, in.Name)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to get stack status")
	}
	resp := &stackGetResponse{}
	resp.Body.Name = in.Name
	resp.Body.Status = status
	return resp, nil
}

func (d *Deps) handleStackContainers(ctx context.Context, in *nameInput) (*web.ListOutput[dockerapi.ContainerInfo], error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	containers, err := d.Stacks.GetStackContainers(ctx, in.Name)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to get stack containers")
	}
	return &web.ListOutput[dockerapi.ContainerInfo]{Body: containers}, nil
}

type stackFilesResponse struct {
	Body struct {
		Compose     string  `json:"compose"`
		ComposeFile string  `json:"composeFile"`
		Env         *string `json:"env"`
	}
}

func (d *Deps) handleStackFilesGet(ctx context.Context, in *nameInput) (*stackFilesResponse, error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	composePath, err := d.Stacks.FindComposePath(in.Name)
	if err != nil {
		return nil, huma.Error404NotFound(err.Error())
	}
	compose, err := os.ReadFile(composePath)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to read compose file")
	}
	resp := &stackFilesResponse{}
	resp.Body.Compose = string(compose)
	resp.Body.ComposeFile = filepath.Base(composePath)
	if envPath := d.Stacks.FindEnvPath(in.Name); envPath != "" {
		env, err := os.ReadFile(envPath)
		if err == nil {
			envStr := string(env)
			resp.Body.Env = &envStr
		}
	}
	return resp, nil
}

type stackFilesSaveRequest struct {
	ComposeFile string  `json:"composeFile"`
	Compose     string  `json:"compose"`
	Env         *string `json:"env,omitempty"`
}

func (d *Deps) handleStackFilesSave(ctx context.Context, in *struct {
	Name string `path:"name"`
	Body stackFilesSaveRequest
}) (*web.OKResponse, error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	req := in.Body
	if req.ComposeFile == "" || filepath.Base(req.ComposeFile) != req.ComposeFile {
		return nil, huma.Error400BadRequest("invalid compose file name")
	}
	if req.Compose == "" {
		return nil, huma.Error400BadRequest("compose content is required")
	}
	dir := d.Stacks.Dir()
	composePath := filepath.Join(dir, in.Name, req.ComposeFile)
	if !isWithinStacksDir(filepath.Join(dir, in.Name), composePath) {
		return nil, huma.Error400BadRequest("invalid compose file path")
	}
	if err := os.WriteFile(composePath, []byte(req.Compose), 0o644); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to save compose file")
	}
	if req.Env != nil {
		if err := os.WriteFile(filepath.Join(dir, in.Name, ".env"), []byte(*req.Env), 0o644); err != nil {
			web.LogError(web.RequestFrom(ctx), err)
			return nil, huma.Error500InternalServerError("failed to save env file")
		}
	}
	return web.OK(), nil
}

type stackCreateRequest struct {
	Name string `json:"name"`
}

func (d *Deps) handleStackCreate(ctx context.Context, in *struct {
	Body stackCreateRequest
}) (*web.OKResponse, error) {
	if !stackNameRe.MatchString(in.Body.Name) {
		return nil, huma.Error400BadRequest("invalid stack name (allowed: a-zA-Z0-9_-)")
	}
	exists, err := d.Stacks.StackExists(ctx, in.Body.Name)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to check stack")
	}
	if exists {
		return nil, huma.Error409Conflict("stack already exists")
	}
	dir := filepath.Join(d.Stacks.Dir(), in.Body.Name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to create stack directory")
	}
	template := "services:\n  app:\n    image: " + in.Body.Name + "\n    container_name: " + in.Body.Name + "_app\n"
	if err := os.WriteFile(filepath.Join(dir, "compose.yaml"), []byte(template), 0o644); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to write starter compose file")
	}
	return web.OK(), nil
}

func (d *Deps) handleStackCreateEnv(ctx context.Context, in *nameInput) (*web.OKResponse, error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	dir := filepath.Join(d.Stacks.Dir(), in.Name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to access stack directory")
	}
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte("# VAR1=example\n"), 0o644); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to write env file")
	}
	return web.OK(), nil
}

func (d *Deps) handleStackDestroy(ctx context.Context, in *nameInput) (*web.OKResponse, error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	if err := d.Stacks.RunCompose(ctx, in.Name, "down"); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to bring stack down")
	}
	dir := filepath.Join(d.Stacks.Dir(), in.Name)
	if !isWithinStacksDir(d.Stacks.Dir(), dir) {
		return nil, huma.Error400BadRequest("invalid stack path")
	}
	if err := os.RemoveAll(dir); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to remove stack directory")
	}
	return web.OK(), nil
}

func (d *Deps) handleStacksRedeploy(ctx context.Context, _ *struct{}) (*web.ListOutput[dockerapi.RedeployResult], error) {
	results := d.Stacks.RedeployAllRunning(ctx, d.Cfg.RedeploySkip)
	return &web.ListOutput[dockerapi.RedeployResult]{Body: results}, nil
}

func (d *Deps) handleStackAction(ctx context.Context, in *nameInput, args []string) (*web.OKResponse, error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	if err := d.Stacks.RunCompose(ctx, in.Name, args...); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("compose command failed")
	}
	return web.OK(), nil
}

func (d *Deps) handleStackActionStream(w http.ResponseWriter, r *http.Request, args []string) {
	name := chi.URLParam(r, "name")
	if !stackNameRe.MatchString(name) {
		web.WriteError(w, http.StatusBadRequest, "invalid stack name")
		return
	}
	lines, err := d.Stacks.StreamCompose(r.Context(), name, args...)
	if err != nil {
		web.LogError(r, err)
		web.WriteError(w, http.StatusInternalServerError, "failed to start compose command")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		web.WriteError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	for line := range lines {
		escaped := strings.ReplaceAll(line, "\n", "\\n")
		if _, err := w.Write([]byte("data: " + escaped + "\n\n")); err != nil {
			return
		}
		flusher.Flush()
	}
}

func (d *Deps) registerStacks(api huma.API, router chi.Router) {
	huma.Get(api, "/api/stacks", d.handleStacksList, d.SessionMW)
	huma.Post(api, "/api/stacks", d.handleStackCreate, d.SessionMW)
	huma.Get(api, "/api/stacks/{name}", d.handleStackGet, d.SessionMW)
	huma.Get(api, "/api/stacks/{name}/containers", d.handleStackContainers, d.SessionMW)
	huma.Get(api, "/api/stacks/{name}/files", d.handleStackFilesGet, d.SessionMW)
	huma.Put(api, "/api/stacks/{name}/files", d.handleStackFilesSave, d.SessionMW)
	huma.Post(api, "/api/stacks/{name}/env", d.handleStackCreateEnv, d.SessionMW)
	huma.Delete(api, "/api/stacks/{name}", d.handleStackDestroy, d.SessionMW)
	for _, a := range stackActions {
		action := a
		huma.Register(api, huma.Operation{
			Method:      "POST",
			Path:        "/api/stacks/{name}/" + action.path,
			OperationID: "post-stack-action-" + action.path,
			Middlewares: huma.Middlewares{d.HumaRequireSession},
		}, func(ctx context.Context, in *nameInput) (*web.OKResponse, error) {
			return d.handleStackAction(ctx, in, action.args)
		})
	}
	router.Group(func(gr chi.Router) {
		gr.Use(d.RequireSession)
		for _, a := range stackActions {
			action := a
			gr.Post("/api/stacks/{name}/"+action.path+"/stream", func(w http.ResponseWriter, req *http.Request) {
				d.handleStackActionStream(w, req, action.args)
			})
		}
	})

	huma.Get(api, "/api/stacks/", d.handleStacksList, d.apiKeyMW)
	huma.Post(api, "/api/stacks/redeploy", d.handleStacksRedeploy, d.apiKeyMW)
}
