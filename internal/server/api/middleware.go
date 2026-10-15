package api

import (
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"

	"github.com/zareix/dockstack/internal/server/api/web"
)

type apiError struct {
	status int
	Err    string `json:"error"`
}

func (e *apiError) Error() string  { return e.Err }
func (e *apiError) GetStatus() int { return e.status }

func init() {
	huma.NewError = func(status int, msg string, errs ...error) huma.StatusError {
		if len(errs) > 0 {
			details := make([]string, len(errs))
			for i, e := range errs {
				details[i] = e.Error()
			}
			return &apiError{status: status, Err: msg + ": " + strings.Join(details, "; ")}
		}
		return &apiError{status: status, Err: msg}
	}
}

var WriteError = web.WriteError

func (d *Deps) requestMiddleware(ctx huma.Context, next func(huma.Context)) {
	if r, _ := humachi.Unwrap(ctx); r != nil {
		ctx = huma.WithValue(ctx, web.RequestKey, r)
	}
	next(ctx)
}
