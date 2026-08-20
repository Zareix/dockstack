package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/zareix/dockstack/internal/auth"
)

type apiKeyResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt int64  `json:"createdAt"`
	ExpiresAt *int64 `json:"expiresAt"`
	Enabled   bool   `json:"enabled"`
}

func toAPIKeyResponse(k auth.APIKey) apiKeyResponse {
	return apiKeyResponse{
		ID:        k.ID,
		Name:      k.Name,
		CreatedAt: k.CreatedAt,
		ExpiresAt: k.ExpiresAt,
		Enabled:   k.Enabled,
	}
}

type createAPIKeyRequest struct {
	Name      string `json:"name"`
	ExpiresAt *int64 `json:"expiresAt"`
}

func (s *Server) handleCreateAPIKey(w http.ResponseWriter, r *http.Request) {
	user := UserFrom(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	var req createAPIKeyRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	key, err := auth.GenerateAPIKey()
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to generate key")
		return
	}
	created, err := s.keys.Create(r.Context(), auth.NewAPIKey{
		UserID:    user.ID,
		Name:      req.Name,
		KeyHash:   auth.HashToken(key),
		ExpiresAt: req.ExpiresAt,
	})
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to create API key")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"key":    key,
		"apiKey": toAPIKeyResponse(*created),
	})
}

func (s *Server) handleListAPIKeys(w http.ResponseWriter, r *http.Request) {
	user := UserFrom(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	keys, err := s.keys.List(r.Context(), user.ID)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to list API keys")
		return
	}
	out := make([]apiKeyResponse, 0, len(keys))
	for _, k := range keys {
		out = append(out, toAPIKeyResponse(k))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleDeleteAPIKey(w http.ResponseWriter, r *http.Request) {
	user := UserFrom(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if err := s.keys.Delete(r.Context(), user.ID, id); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to delete API key")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}
