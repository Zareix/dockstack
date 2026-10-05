package server

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/zareix/dockstack/internal/server/api"
)

//go:embed all:web-dist
var embeddedSPA embed.FS

func (s *Server) spaHandler(r chi.Router) {
	spaFS, err := fs.Sub(embeddedSPA, "web-dist")
	if err != nil {
		panic("embed web-dist: " + err.Error())
	}

	fileServer := http.FileServer(http.FS(spaFS))

	r.NotFound(func(w http.ResponseWriter, req *http.Request) {
		if strings.HasPrefix(req.URL.Path, "/api/") {
			api.WriteError(w, http.StatusNotFound, "not found")
			return
		}
		p := strings.TrimPrefix(path.Clean(req.URL.Path), "/")
		if p == "" {
			p = "index.html"
		}
		if _, err := fs.Stat(spaFS, p); err == nil {
			fileServer.ServeHTTP(w, req)
			return
		}

		req.URL.Path = "/"
		fileServer.ServeHTTP(w, req)
	})
}
