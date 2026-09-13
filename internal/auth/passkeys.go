package auth

import (
	"context"
	"encoding/json"
	"errors"
	"time"
	"uuid"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"

	"github.com/zareix/dockstack/internal/db/store"
)

type Passkey struct {
	ID           string `json:"id"`
	UserID       string `json:"userId"`
	Name         string `json:"name"`
	CredentialID string `json:"credentialId"`
	CreatedAt    int64  `json:"createdAt"`
}

type passkeyUser struct {
	id    string
	name  string
	creds []webauthn.Credential
}

func (u *passkeyUser) WebAuthnID() []byte                         { return []byte(u.id) }
func (u *passkeyUser) WebAuthnName() string                       { return u.name }
func (u *passkeyUser) WebAuthnDisplayName() string                { return u.name }
func (u *passkeyUser) WebAuthnCredentials() []webauthn.Credential { return u.creds }

func (s *Store) userCredentials(ctx context.Context, userID string) ([]webauthn.Credential, error) {
	rows, err := s.q.ListPasskeyPublicKeys(ctx, userID)
	if err != nil {
		return nil, err
	}
	var creds []webauthn.Credential
	for _, raw := range rows {
		var c webauthn.Credential
		if err := json.Unmarshal(raw, &c); err != nil {
			continue
		}
		creds = append(creds, c)
	}
	return creds, nil
}

func (s *Store) userFor(ctx context.Context, userID string) (*passkeyUser, error) {
	row, err := s.q.GetUserByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	creds, err := s.userCredentials(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &passkeyUser{id: userID, name: row.Name, creds: creds}, nil
}

func (s *Store) BeginRegistration(ctx context.Context, userID string) (any, string, error) {
	user, err := s.userFor(ctx, userID)
	if err != nil {
		return nil, "", err
	}
	var exclusions []protocol.CredentialDescriptor
	for _, c := range user.WebAuthnCredentials() {
		exclusions = append(exclusions, protocol.CredentialDescriptor{
			Type:         protocol.PublicKeyCredentialType,
			CredentialID: c.ID,
		})
	}
	options, session, err := s.wa.BeginRegistration(user, webauthn.WithExclusions(exclusions))
	if err != nil {
		return nil, "", err
	}
	challengeID, err := s.saveChallenge(ctx, userID, "registration", session)
	if err != nil {
		return nil, "", err
	}
	return options.Response, challengeID, nil
}

func (s *Store) FinishRegistration(ctx context.Context, userID, challengeID string, response []byte) (Passkey, error) {
	var p Passkey
	session, err := s.loadChallenge(ctx, challengeID, "registration", userID)
	if err != nil {
		return p, err
	}
	defer s.deleteChallenge(ctx, challengeID)
	user, err := s.userFor(ctx, userID)
	if err != nil {
		return p, err
	}
	parsed, err := protocol.ParseCredentialCreationResponseBytes(response)
	if err != nil {
		return p, err
	}
	cred, err := s.wa.CreateCredential(user, session, parsed)
	if err != nil {
		return p, err
	}
	raw, err := json.Marshal(cred)
	if err != nil {
		return p, err
	}
	p = Passkey{
		ID:           uuid.New().String(),
		UserID:       userID,
		Name:         "Passkey",
		CredentialID: string(cred.ID),
		CreatedAt:    time.Now().UnixMilli(),
	}
	err = s.q.InsertPasskey(ctx, store.InsertPasskeyParams{
		ID:           p.ID,
		UserID:       p.UserID,
		Name:         p.Name,
		CredentialID: p.CredentialID,
		PublicKey:    raw,
		Counter:      int64(cred.Authenticator.SignCount),
		Aaguid:       cred.Authenticator.AAGUID,
		Transports:   string(mustJSON(cred.Transport)),
		CreatedAt:    p.CreatedAt,
	})
	if err != nil {
		return p, err
	}
	return p, nil
}

func (s *Store) BeginAuthentication(ctx context.Context) (any, string, error) {
	options, session, err := s.wa.BeginDiscoverableLogin()
	if err != nil {
		return nil, "", err
	}
	challengeID, err := s.saveChallenge(ctx, "", "authentication", session)
	if err != nil {
		return nil, "", err
	}
	return options.Response, challengeID, nil
}

func (s *Store) FinishAuthentication(ctx context.Context, challengeID string, response []byte) (string, error) {
	session, err := s.loadChallenge(ctx, challengeID, "authentication", "")
	if err != nil {
		return "", err
	}
	defer s.deleteChallenge(ctx, challengeID)

	parsed, err := protocol.ParseCredentialRequestResponseBytes(response)
	if err != nil {
		return "", err
	}
	user, cred, err := s.wa.ValidatePasskeyLogin(func(rawID, userHandle []byte) (webauthn.User, error) {
		uid := string(userHandle)
		user, err := s.userFor(ctx, uid)
		if err != nil {
			return nil, err
		}
		return user, nil
	}, session, parsed)
	if err != nil {
		return "", err
	}
	userID := string(user.WebAuthnID())
	err = s.q.UpdatePasskeyCounter(ctx, store.UpdatePasskeyCounterParams{
		Counter:      int64(cred.Authenticator.SignCount),
		UserID:       userID,
		CredentialID: string(cred.ID),
	})
	if err != nil {
		return "", err
	}
	return userID, nil
}

func (s *Store) ListPasskeys(ctx context.Context, userID string) ([]Passkey, error) {
	rows, err := s.q.ListPasskeysByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Passkey, 0, len(rows))
	for _, r := range rows {
		out = append(out, Passkey{
			ID:           r.ID,
			UserID:       r.UserID,
			Name:         r.Name,
			CredentialID: r.CredentialID,
			CreatedAt:    r.CreatedAt,
		})
	}
	return out, nil
}

func (s *Store) DeletePasskey(ctx context.Context, userID, id string) error {
	return s.q.DeletePasskey(ctx, store.DeletePasskeyParams{ID: id, UserID: userID})
}

func (s *Store) saveChallenge(ctx context.Context, userID, kind string, session *webauthn.SessionData) (string, error) {
	id := uuid.New().String()
	raw, err := json.Marshal(session)
	if err != nil {
		return "", err
	}
	var uid *string
	if userID != "" {
		uid = &userID
	}
	now := time.Now().UnixMilli()
	err = s.q.InsertChallenge(ctx, store.InsertChallengeParams{
		ID:        id,
		Challenge: string(raw),
		UserID:    uid,
		Kind:      kind,
		ExpiresAt: time.Now().Add(5 * time.Minute).UnixMilli(),
		CreatedAt: now,
	})
	return id, err
}

func (s *Store) loadChallenge(ctx context.Context, id, kind, userID string) (webauthn.SessionData, error) {
	var session webauthn.SessionData
	row, err := s.q.GetChallenge(ctx, store.GetChallengeParams{
		ID:        id,
		Kind:      kind,
		ExpiresAt: time.Now().UnixMilli(),
	})
	if err != nil {
		return session, errors.New("invalid or expired challenge")
	}
	if userID != "" && (row.UserID == nil || *row.UserID != userID) {
		return session, errors.New("invalid challenge")
	}
	if err := json.Unmarshal([]byte(row.Challenge), &session); err != nil {
		return session, errors.New("invalid challenge")
	}
	return session, nil
}

func (s *Store) deleteChallenge(ctx context.Context, id string) {
	_ = s.q.DeleteChallenge(ctx, id)
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}
