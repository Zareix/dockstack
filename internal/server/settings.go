package server

import (
	"net/http"
)

type settingsResponse struct {
	AppTitle     string     `json:"appTitle"`
	InstanceName string     `json:"instanceName"`
	Instances    []instance `json:"instances"`
}

type instance struct {
	Title     string `json:"title"`
	URL       string `json:"url"`
	IsCurrent bool   `json:"isCurrent"`
}

// @Summary Get public settings
// @Description App title, instance name and linked instances.
// @Tags stacks
// @Produce json
// @Success 200 {object} settingsResponse
// @Router /api/settings [get]
func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	instances := make([]instance, 0, len(s.cfg.OtherInstanceURLs)+1)
	for _, inst := range s.cfg.OtherInstanceURLs {
		instances = append(instances, instance{Title: inst.Title, URL: inst.URL})
	}
	currentURL := s.cfg.AppURL
	if currentURL == "" {
		currentURL = "/"
	}
	instances = append(instances, instance{
		Title:     s.cfg.AppTitle,
		URL:       currentURL,
		IsCurrent: true,
	})
	writeJSON(w, http.StatusOK, settingsResponse{
		AppTitle:     s.cfg.AppTitle,
		InstanceName: s.cfg.InstanceName,
		Instances:    instances,
	})
}

type socialProvider struct {
	ID string `json:"id"`
}

// @Summary List social providers
// @Description OAuth provider IDs available for sign-in.
// @Tags auth
// @Produce json
// @Success 200 {array} socialProvider
// @Router /api/auth/providers [get]
func (s *Server) handleProviders(w http.ResponseWriter, r *http.Request) {
	providers := []socialProvider{}
	if s.cfg.OAuth != nil {
		providers = append(providers, socialProvider{ID: s.cfg.OAuth.ProviderID})
	}
	writeJSON(w, http.StatusOK, providers)
}
