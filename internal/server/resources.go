package server

import (
	"encoding/json"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
)

func decodeJSON(r *http.Request, v any) error {
	defer func() { _ = r.Body.Close() }()
	return json.NewDecoder(r.Body).Decode(v)
}

func (s *Server) containerRoutes() func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/", s.handleContainersList)
		r.Post("/prune", s.handleContainersPrune)
		r.Post("/{id}/start", s.handleContainerAction("start"))
		r.Post("/{id}/stop", s.handleContainerAction("stop"))
		r.Post("/{id}/restart", s.handleContainerAction("restart"))
		r.Delete("/{id}", s.handleContainerRemove)
	}
}

// @Summary List containers
// @Tags resources
// @Security SessionCookie
// @Produce json
// @Success 200 {array} ContainerInfo
// @Router /api/containers [get]
func (s *Server) handleContainersList(w http.ResponseWriter, r *http.Request) {
	containers, err := s.app.docker.ListAllContainers(r.Context(), s.cfg.ServerHost, s.cfg.AutodetectURLBaseDomain)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to list containers")
		return
	}
	writeJSON(w, http.StatusOK, containers)
}

// @Summary Prune containers
// @Tags resources
// @Security SessionCookie
// @Success 200 {object} PruneResult
// @Router /api/containers/prune [post]
func (s *Server) handleContainersPrune(w http.ResponseWriter, r *http.Request) {
	res, err := s.app.docker.ContainerPrune(r.Context())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to prune containers")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

var containerIDRe = regexp.MustCompile(`^[a-f0-9]{1,64}$`)

func (s *Server) handleContainerAction(action string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if !containerIDRe.MatchString(id) {
			writeError(w, http.StatusBadRequest, "invalid container id")
			return
		}
		var err error
		switch action {
		case "start":
			err = s.app.docker.ContainerStart(r.Context(), id)
		case "stop":
			err = s.app.docker.ContainerStop(r.Context(), id)
		case "restart":
			err = s.app.docker.ContainerRestart(r.Context(), id)
		}
		if err != nil {
			s.logError(r, err)
			writeError(w, http.StatusInternalServerError, "container action failed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func (s *Server) handleContainerRemove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !containerIDRe.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid container id")
		return
	}
	if err := s.app.docker.ContainerRemove(r.Context(), id); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to remove container")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) imageRoutes() func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/", s.handleImagesList)
		r.Get("/stale", s.handleImagesStale)
		r.Post("/prune", s.handleImagesPrune)
		r.Delete("/{id}", s.handleImageRemove)
	}
}

// @Summary List images
// @Tags resources
// @Security SessionCookie
// @Produce json
// @Success 200 {array} ImageInfo
// @Router /api/images [get]
func (s *Server) handleImagesList(w http.ResponseWriter, r *http.Request) {
	images, err := s.app.docker.ListImagesInfo(r.Context())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to list images")
		return
	}
	writeJSON(w, http.StatusOK, images)
}

// @Summary Check which images are stale
// @Tags resources
// @Security SessionCookie
// @Success 200 {object} map[string]string
// @Router /api/images/stale [get]
func (s *Server) handleImagesStale(w http.ResponseWriter, r *http.Request) {
	results := s.app.docker.CheckImagesStale(r.Context())
	writeJSON(w, http.StatusOK, results)
}

// @Summary Prune images
// @Tags resources
// @Security SessionCookie
// @Success 200 {object} PruneResult
// @Router /api/images/prune [post]
func (s *Server) handleImagesPrune(w http.ResponseWriter, r *http.Request) {
	res, err := s.app.docker.ImagePrune(r.Context())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to prune images")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

var imageIDRe = regexp.MustCompile(`^[a-zA-Z0-9._:/-]+$`)

func (s *Server) handleImageRemove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !imageIDRe.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid image id")
		return
	}
	if err := s.app.docker.ImageRemove(r.Context(), id); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to remove image")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) volumeRoutes() func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/", s.handleVolumesList)
		r.Post("/prune", s.handleVolumesPrune)
		r.Delete("/{name}", s.handleVolumeRemove)
	}
}

// @Summary List volumes
// @Tags resources
// @Security SessionCookie
// @Produce json
// @Success 200 {array} VolumeInfo
// @Router /api/volumes [get]
func (s *Server) handleVolumesList(w http.ResponseWriter, r *http.Request) {
	volumes, err := s.app.docker.ListVolumesInfo(r.Context())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to list volumes")
		return
	}
	writeJSON(w, http.StatusOK, volumes)
}

// @Summary Prune volumes
// @Tags resources
// @Security SessionCookie
// @Success 200 {object} PruneResult
// @Router /api/volumes/prune [post]
func (s *Server) handleVolumesPrune(w http.ResponseWriter, r *http.Request) {
	res, err := s.app.docker.VolumePrune(r.Context())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to prune volumes")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

var volumeNameRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`)

func (s *Server) handleVolumeRemove(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if !volumeNameRe.MatchString(name) {
		writeError(w, http.StatusBadRequest, "invalid volume name")
		return
	}
	if err := s.app.docker.VolumeRemove(r.Context(), name); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to remove volume")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) networkRoutes() func(r chi.Router) {
	return func(r chi.Router) {
		r.Get("/", s.handleNetworksList)
	}
}

// @Summary List networks
// @Tags resources
// @Security SessionCookie
// @Produce json
// @Success 200 {array} NetworkInfo
// @Router /api/networks [get]
func (s *Server) handleNetworksList(w http.ResponseWriter, r *http.Request) {
	networks, err := s.app.docker.ListNetworksInfo(r.Context())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to list networks")
		return
	}
	writeJSON(w, http.StatusOK, networks)
}
