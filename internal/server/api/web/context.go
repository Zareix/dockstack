package web

import (
	"context"
	"net/http"

	"github.com/zareix/dockstack/internal/auth"
)

type ctxKey int

const (
	CtxUser ctxKey = iota
	CtxSession
)

var RequestKey int

func WithUser(ctx context.Context, u *auth.User, sess *auth.Session) context.Context {
	ctx = context.WithValue(ctx, CtxUser, u)
	if sess != nil {
		ctx = context.WithValue(ctx, CtxSession, sess)
	}
	return ctx
}

func UserFrom(ctx context.Context) *auth.User {
	u, _ := ctx.Value(CtxUser).(*auth.User)
	return u
}

func SessionFrom(ctx context.Context) *auth.Session {
	s, _ := ctx.Value(CtxSession).(*auth.Session)
	return s
}

func RequestFrom(ctx context.Context) *http.Request {
	r, _ := ctx.Value(RequestKey).(*http.Request)
	return r
}
