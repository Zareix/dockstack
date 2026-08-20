package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/zareix/dockstack/internal/auth"
)

const passkeyChallengeCookie = "dockstack_passkey_challenge"

func (s *Server) setPasskeyChallengeCookie(w http.ResponseWriter, id string) {
	http.SetCookie(w, &http.Cookie{
		Name:     passkeyChallengeCookie,
		Value:    id,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.store.Secure(),
	})
}

func (s *Server) clearPasskeyChallengeCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     passkeyChallengeCookie,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   s.store.Secure(),
		MaxAge:   -1,
	})
}

func (s *Server) handlePasskeyRegisterBegin(w http.ResponseWriter, r *http.Request) {
	user := UserFrom(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	options, challengeID, err := s.passkeys.BeginRegistration(r.Context(), user.ID)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to start registration")
		return
	}
	s.setPasskeyChallengeCookie(w, challengeID)
	writeJSON(w, http.StatusOK, map[string]any{
		"options":     options,
		"challengeId": challengeID,
	})
}

type passkeyRegisterFinishRequest struct {
	Credential json.RawMessage `json:"credential"`
	Name       string          `json:"name"`
}

func (s *Server) handlePasskeyRegisterFinish(w http.ResponseWriter, r *http.Request) {
	user := UserFrom(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	challengeID, err := r.Cookie(passkeyChallengeCookie)
	if err != nil || challengeID.Value == "" {
		writeError(w, http.StatusBadRequest, "missing challenge")
		return
	}
	var req passkeyRegisterFinishRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	passkey, err := s.passkeys.FinishRegistration(r.Context(), user.ID, challengeID.Value, req.Credential)
	if err != nil {
		writeError(w, http.StatusBadRequest, "registration failed")
		return
	}
	s.clearPasskeyChallengeCookie(w)
	writeJSON(w, http.StatusOK, map[string]any{"passkey": passkey})
}

func (s *Server) handlePasskeyAuthBegin(w http.ResponseWriter, r *http.Request) {
	options, challengeID, err := s.passkeys.BeginAuthentication(r.Context())
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to start authentication")
		return
	}
	s.setPasskeyChallengeCookie(w, challengeID)
	writeJSON(w, http.StatusOK, map[string]any{
		"options":     options,
		"challengeId": challengeID,
	})
}

type passkeyAuthFinishRequest struct {
	Credential json.RawMessage `json:"credential"`
}

func (s *Server) handlePasskeyAuthFinish(w http.ResponseWriter, r *http.Request) {
	challengeID, err := r.Cookie(passkeyChallengeCookie)
	if err != nil || challengeID.Value == "" {
		writeError(w, http.StatusBadRequest, "missing challenge")
		return
	}
	var req passkeyAuthFinishRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	userID, err := s.passkeys.FinishAuthentication(r.Context(), challengeID.Value, req.Credential)
	if err != nil {
		writeError(w, http.StatusBadRequest, "authentication failed")
		return
	}
	s.clearPasskeyChallengeCookie(w)
	user, err := s.store.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	s.signIn(w, r, user)
}

func (s *Server) handleListPasskeys(w http.ResponseWriter, r *http.Request) {
	user := UserFrom(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	passkeys, err := s.passkeys.List(r.Context(), user.ID)
	if err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to list passkeys")
		return
	}
	if passkeys == nil {
		passkeys = []auth.Passkey{}
	}
	writeJSON(w, http.StatusOK, passkeys)
}

func (s *Server) handleDeletePasskey(w http.ResponseWriter, r *http.Request) {
	user := UserFrom(r.Context())
	if user == nil {
		writeError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if err := s.passkeys.Delete(r.Context(), user.ID, id); err != nil {
		s.logError(r, err)
		writeError(w, http.StatusInternalServerError, "failed to delete passkey")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}
