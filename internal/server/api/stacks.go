package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
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

type stackAction struct {
	path string
	cmds [][]string
}

var upArgs = []string{"up", "-d", "--remove-orphans", "--build"}

var stackActions = []stackAction{
	{"up", [][]string{upArgs}},
	{"stop", [][]string{{"stop"}}},
	{"down", [][]string{{"down"}}},
	{"restart", [][]string{{"restart"}}},
	{"pull", [][]string{{"pull"}}},
	{"update", [][]string{
		{"pull", "--ignore-buildable"},
		{"up", "-d", "--remove-orphans"},
	}},
}

func (a stackAction) invalidatesDigests() bool {
	return a.path == "pull" || a.path == "update"
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

func (d *Deps) handleStackUpdates(ctx context.Context, _ *struct{}) (*web.MapOutput[dockerapi.StaleStatus], error) {
	updates, err := d.Stacks.ListStackUpdates(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to check stack updates")
	}
	return &web.MapOutput[dockerapi.StaleStatus]{Body: updates}, nil
}

func (d *Deps) handleStacksDrift(ctx context.Context, _ *struct{}) (*web.MapOutput[dockerapi.DriftStatus], error) {
	drift, err := d.Stacks.CheckStacksDrift(ctx)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to check stacks drift")
	}
	return &web.MapOutput[dockerapi.DriftStatus]{Body: drift}, nil
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

type stackFilesSaveResponse struct {
	Body struct {
		Success    bool                        `json:"success"`
		Validation dockerapi.ComposeValidation `json:"validation"`
	}
}

func (d *Deps) handleStackFilesSave(ctx context.Context, in *struct {
	Name string `path:"name"`
	Body stackFilesSaveRequest
}) (*stackFilesSaveResponse, error) {
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
	resp := &stackFilesSaveResponse{}
	resp.Body.Success = true
	resp.Body.Validation = d.Stacks.ValidateCompose(ctx, in.Name)
	return resp, nil
}

type stackExportInput struct {
	Name       string `path:"name"`
	IncludeEnv bool   `query:"includeEnv" default:"true" doc:"Include the .env file, which may contain secrets"`
}

func (d *Deps) handleStackExport(ctx context.Context, in *stackExportInput) (*huma.StreamResponse, error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	exists, err := d.Stacks.StackExists(ctx, in.Name)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to check stack")
	}
	if !exists {
		return nil, huma.Error404NotFound("stack not found")
	}
	return &huma.StreamResponse{
		Body: func(hctx huma.Context) {
			hctx.SetHeader("Content-Type", "application/zip")
			hctx.SetHeader("Content-Disposition", fmt.Sprintf(`attachment; filename="%s.zip"`, in.Name))
			if err := d.Stacks.ExportStack(in.Name, in.IncludeEnv, hctx.BodyWriter()); err != nil {
				web.LogError(web.RequestFrom(ctx), err)
			}
		},
	}, nil
}

type stackImportForm struct {
	File huma.FormFile `form:"file" required:"true" doc:"Zip archive of the stack directory"`
	Name string        `form:"name" required:"true" doc:"Name of the imported stack"`
}

type stackImportInput struct {
	RawBody huma.MultipartFormFiles[stackImportForm]
}

type stackImportResponse struct {
	Body struct {
		Name string `json:"name"`
	}
}

func (d *Deps) handleStackImport(ctx context.Context, in *stackImportInput) (*stackImportResponse, error) {
	data := in.RawBody.Data()
	if err := validateStackName(data.Name); err != nil {
		return nil, huma.Error400BadRequest("invalid stack name (allowed: a-zA-Z0-9_-)")
	}
	exists, err := d.Stacks.StackExists(ctx, data.Name)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to check stack")
	}
	if exists {
		return nil, huma.Error409Conflict("stack already exists")
	}
	if err := d.Stacks.ImportStack(data.Name, data.File, data.File.Size); err != nil {
		if errors.Is(err, dockerapi.ErrStackExists) {
			return nil, huma.Error409Conflict("stack already exists")
		}
		return nil, huma.Error400BadRequest(err.Error())
	}
	resp := &stackImportResponse{}
	resp.Body.Name = data.Name
	return resp, nil
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

type stackRenameRequest struct {
	Name string `json:"name"`
}

func (d *Deps) handleStackRename(ctx context.Context, in *struct {
	Name string `path:"name"`
	Body stackRenameRequest
}) (*web.OKResponse, error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	if err := validateStackName(in.Body.Name); err != nil {
		return nil, huma.Error400BadRequest("invalid new stack name (allowed: a-zA-Z0-9_-)")
	}
	if in.Body.Name == in.Name {
		return web.OK(), nil
	}
	exists, err := d.Stacks.StackExists(ctx, in.Name)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to check stack")
	}
	if !exists {
		return nil, huma.Error404NotFound("stack not found")
	}
	newExists, err := d.Stacks.StackExists(ctx, in.Body.Name)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to check stack")
	}
	if newExists {
		return nil, huma.Error409Conflict("stack already exists")
	}
	if _, err := d.Stacks.FindComposePath(in.Name); err == nil {
		if err := d.Stacks.RunCompose(ctx, in.Name, "down"); err != nil {
			web.LogError(web.RequestFrom(ctx), err)
			return nil, huma.Error500InternalServerError("failed to bring stack down")
		}
	}
	oldDir := filepath.Join(d.Stacks.Dir(), in.Name)
	newDir := filepath.Join(d.Stacks.Dir(), in.Body.Name)
	if !isWithinStacksDir(d.Stacks.Dir(), oldDir) || !isWithinStacksDir(d.Stacks.Dir(), newDir) {
		return nil, huma.Error400BadRequest("invalid stack path")
	}
	if err := os.Rename(oldDir, newDir); err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to rename stack directory")
	}
	if _, err := d.Stacks.FindComposePath(in.Body.Name); err == nil {
		if err := d.Stacks.RunCompose(ctx, in.Body.Name, upArgs...); err != nil {
			web.LogError(web.RequestFrom(ctx), err)
			return nil, huma.Error500InternalServerError("stack renamed but failed to start it")
		}
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

func (d *Deps) handleStackRedeploy(ctx context.Context, in *nameInput) (*web.DataOutput[dockerapi.RedeployResult], error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	exists, err := d.Stacks.StackExists(ctx, in.Name)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("failed to check stack")
	}
	if !exists {
		return nil, huma.Error404NotFound("stack not found")
	}
	if slices.Contains(d.Cfg.RedeploySkip, in.Name) {
		return nil, huma.Error409Conflict("stack is excluded by REDEPLOY_SKIP")
	}
	res, err := d.Stacks.RedeployStack(ctx, in.Name)
	if err != nil {
		web.LogError(web.RequestFrom(ctx), err)
		return nil, huma.Error500InternalServerError("redeploy failed")
	}
	if res.Action == "redeployed" {
		d.Docker.InvalidateRemoteDigests()
	}
	return &web.DataOutput[dockerapi.RedeployResult]{Body: res}, nil
}

func (d *Deps) handleStackAction(ctx context.Context, in *nameInput, action stackAction) (*web.OKResponse, error) {
	if err := validateStackName(in.Name); err != nil {
		return nil, err
	}
	for _, args := range action.cmds {
		if err := d.Stacks.RunCompose(ctx, in.Name, args...); err != nil {
			web.LogError(web.RequestFrom(ctx), err)
			return nil, huma.Error500InternalServerError("compose command failed")
		}
	}
	if action.invalidatesDigests() {
		d.Docker.InvalidateRemoteDigests()
	}
	return web.OK(), nil
}

func (d *Deps) handleStackActionStream(w http.ResponseWriter, r *http.Request, action stackAction) {
	name := chi.URLParam(r, "name")
	if !stackNameRe.MatchString(name) {
		web.WriteError(w, http.StatusBadRequest, "invalid stack name")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		web.WriteError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	headersSet := false
	for _, args := range action.cmds {
		lines, waitErr, err := d.Stacks.StreamCompose(r.Context(), name, args...)
		if err != nil {
			web.LogError(r, err)
			if !headersSet {
				web.WriteError(w, http.StatusInternalServerError, "failed to start compose command")
				return
			}
			if _, writeErr := w.Write([]byte("data: Error: failed to start compose command: " + err.Error() + "\n\n")); writeErr != nil {
				return
			}
			flusher.Flush()
			return
		}
		if !headersSet {
			w.Header().Set("Content-Type", "text/event-stream")
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("Connection", "keep-alive")
			headersSet = true
		}
		for line := range lines {
			escaped := strings.ReplaceAll(line, "\n", "\\n")
			if _, err := w.Write([]byte("data: " + escaped + "\n\n")); err != nil {
				return
			}
			flusher.Flush()
		}
		if err := <-waitErr; err != nil {
			if _, writeErr := w.Write([]byte("data: Error: compose command failed: " + err.Error() + "\n\n")); writeErr != nil {
				return
			}
			flusher.Flush()
			return
		}
	}
	if action.invalidatesDigests() {
		d.Docker.InvalidateRemoteDigests()
	}
}

func (d *Deps) registerStacks(api huma.API, router chi.Router) {
	huma.Get(api, "/api/stacks", d.handleStacksList, d.AuthMW)
	huma.Post(api, "/api/stacks", d.handleStackCreate, d.AuthMW)
	huma.Post(api, "/api/stacks/import", d.handleStackImport, d.AuthMW)
	exportOp := huma.Operation{
		OperationID: "get-stacks-name-export",
		Method:      http.MethodGet,
		Path:        "/api/stacks/{name}/export",
		Summary:     "Export a stack as a zip archive",
		Description: "Returns the stack directory as a zip archive. Use `includeEnv` to include the .env file, which may contain secrets.",
		Responses: map[string]*huma.Response{
			"200": {
				Description: "Zip archive of the stack directory",
				Content: map[string]*huma.MediaType{
					"application/zip": {Schema: &huma.Schema{Type: "string", Format: "binary"}},
				},
			},
		},
	}
	d.AuthMW(&exportOp)
	huma.Register(api, exportOp, d.handleStackExport)
	huma.Get(api, "/api/stacks/updates", d.handleStackUpdates, d.AuthMW)
	huma.Get(api, "/api/stacks/drift", d.handleStacksDrift, d.AuthMW)
	huma.Get(api, "/api/stacks/{name}", d.handleStackGet, d.AuthMW)
	huma.Get(api, "/api/stacks/{name}/containers", d.handleStackContainers, d.AuthMW)
	huma.Get(api, "/api/stacks/{name}/files", d.handleStackFilesGet, d.AuthMW)
	huma.Put(api, "/api/stacks/{name}/files", d.handleStackFilesSave, d.AuthMW)
	huma.Post(api, "/api/stacks/{name}/env", d.handleStackCreateEnv, d.AuthMW)
	huma.Post(api, "/api/stacks/{name}/rename", d.handleStackRename, d.AuthMW)
	huma.Delete(api, "/api/stacks/{name}", d.handleStackDestroy, d.AuthMW)
	for _, a := range stackActions {
		action := a
		huma.Register(api, huma.Operation{
			Method:      "POST",
			Path:        "/api/stacks/{name}/" + action.path,
			OperationID: "post-stack-action-" + action.path,
			Middlewares: huma.Middlewares{d.HumaRequireAuth},
		}, func(ctx context.Context, in *nameInput) (*web.OKResponse, error) {
			return d.handleStackAction(ctx, in, action)
		})
	}
	router.Group(func(gr chi.Router) {
		gr.Use(d.RequireSession)
		for _, a := range stackActions {
			action := a
			gr.Post("/api/stacks/{name}/"+action.path+"/stream", func(w http.ResponseWriter, req *http.Request) {
				d.handleStackActionStream(w, req, action)
			})
		}
	})

	redeployOp := huma.Operation{
		Method:      "POST",
		Path:        "/api/stacks/{name}/redeploy",
		OperationID: "post-stack-action-redeploy",
	}
	d.AuthMW(&redeployOp)
	huma.Register(api, redeployOp, d.handleStackRedeploy)

	huma.Post(api, "/api/stacks/redeploy", d.handleStacksRedeploy, d.AuthMW)
}
