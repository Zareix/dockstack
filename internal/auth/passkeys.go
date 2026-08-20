package auth

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/zareix/dockstack/internal/randid"
)

type Passkey struct {
	ID           string `json:"id"`
	UserID       string `json:"userId"`
	Name         string `json:"name"`
	CredentialID string `json:"credentialId"`
	CreatedAt    int64  `json:"createdAt"`
}

type PasskeyService struct {
	db *sql.DB
	wa *webauthn.WebAuthn
}

func NewPasskeyService(db *sql.DB, rpID, rpName, origin string) (*PasskeyService, error) {
	wa, err := webauthn.New(&webauthn.Config{
		RPDisplayName: rpName,
		RPID:          rpID,
		RPOrigins:     []string{origin},
	})
	if err != nil {
		return nil, err
	}
	return &PasskeyService{db: db, wa: wa}, nil
}

// passkeyUser adapts our DB user to the webauthn.User interface.
type passkeyUser struct {
	id    string
	name  string
	creds []webauthn.Credential
}

func (u *passkeyUser) WebAuthnID() []byte                         { return []byte(u.id) }
func (u *passkeyUser) WebAuthnName() string                       { return u.name }
func (u *passkeyUser) WebAuthnDisplayName() string                { return u.name }
func (u *passkeyUser) WebAuthnCredentials() []webauthn.Credential { return u.creds }

func (s *PasskeyService) userCredentials(ctx context.Context, userID string) ([]webauthn.Credential, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT public_key FROM passkeys WHERE user_id = ?`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var creds []webauthn.Credential
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var c webauthn.Credential
		if err := json.Unmarshal(raw, &c); err != nil {
			continue
		}
		creds = append(creds, c)
	}
	return creds, rows.Err()
}

func (s *PasskeyService) userFor(userID string) (*passkeyUser, error) {
	var name string
	err := s.db.QueryRow(`SELECT name FROM users WHERE id = ?`, userID).Scan(&name)
	if err != nil {
		return nil, err
	}
	creds, err := s.userCredentials(context.Background(), userID)
	if err != nil {
		return nil, err
	}
	return &passkeyUser{id: userID, name: name, creds: creds}, nil
}

// BeginRegistration starts a WebAuthn registration ceremony for the current user.
func (s *PasskeyService) BeginRegistration(ctx context.Context, userID string) (any, string, error) {
	user, err := s.userFor(userID)
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

// FinishRegistration validates the attestation response and stores the credential.
func (s *PasskeyService) FinishRegistration(ctx context.Context, userID, challengeID string, response []byte) (Passkey, error) {
	var p Passkey
	session, err := s.loadChallenge(ctx, challengeID, "registration", userID)
	if err != nil {
		return p, err
	}
	defer s.deleteChallenge(ctx, challengeID)
	user, err := s.userFor(userID)
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
		ID:           randid.New(),
		UserID:       userID,
		Name:         "Passkey",
		CredentialID: string(cred.ID),
		CreatedAt:    time.Now().UnixMilli(),
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO passkeys (id, user_id, name, credential_id, public_key, counter, aaguid, transports, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		p.ID, userID, p.Name, string(cred.ID), raw, cred.Authenticator.SignCount,
		cred.Authenticator.AAGUID, string(mustJSON(cred.Transport)), p.CreatedAt)
	if err != nil {
		return p, err
	}
	return p, nil
}

// BeginAuthentication starts a discoverable-login ceremony.
func (s *PasskeyService) BeginAuthentication(ctx context.Context) (any, string, error) {
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

// FinishAuthentication validates the assertion and returns the user ID.
func (s *PasskeyService) FinishAuthentication(ctx context.Context, challengeID string, response []byte) (string, error) {
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
		user, err := s.userFor(uid)
		if err != nil {
			return nil, err
		}
		return user, nil
	}, session, parsed)
	if err != nil {
		return "", err
	}
	userID := string(user.WebAuthnID())
	// Update the stored counter.
	if _, err := s.db.ExecContext(ctx,
		`UPDATE passkeys SET counter = ? WHERE user_id = ? AND credential_id = ?`,
		cred.Authenticator.SignCount, userID, string(cred.ID)); err != nil {
		return "", err
	}
	return userID, nil
}

func (s *PasskeyService) List(ctx context.Context, userID string) ([]Passkey, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user_id, name, credential_id, created_at FROM passkeys WHERE user_id = ?`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Passkey
	for rows.Next() {
		var p Passkey
		if err := rows.Scan(&p.ID, &p.UserID, &p.Name, &p.CredentialID, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *PasskeyService) Delete(ctx context.Context, userID, id string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM passkeys WHERE id = ? AND user_id = ?`, id, userID)
	return err
}

func (s *PasskeyService) saveChallenge(ctx context.Context, userID, kind string, session *webauthn.SessionData) (string, error) {
	id := randid.New()
	raw, err := json.Marshal(session)
	if err != nil {
		return "", err
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO webauthn_challenges (id, challenge, user_id, kind, expires_at, created_at)
		 VALUES (?, ?, NULLIF(?, ''), ?, ?, ?)`,
		id, string(raw), userID, kind, time.Now().Add(5*time.Minute).UnixMilli(), time.Now().UnixMilli())
	return id, err
}

func (s *PasskeyService) loadChallenge(ctx context.Context, id, kind, userID string) (webauthn.SessionData, error) {
	var session webauthn.SessionData
	var raw string
	var storedUser sql.NullString
	err := s.db.QueryRowContext(ctx,
		`SELECT challenge, user_id FROM webauthn_challenges
		 WHERE id = ? AND kind = ? AND expires_at > ?`,
		id, kind, time.Now().UnixMilli()).Scan(&raw, &storedUser)
	if err != nil {
		return session, errors.New("invalid or expired challenge")
	}
	if userID != "" && (!storedUser.Valid || storedUser.String != userID) {
		return session, errors.New("invalid challenge")
	}
	if err := json.Unmarshal([]byte(raw), &session); err != nil {
		return session, errors.New("invalid challenge")
	}
	return session, nil
}

func (s *PasskeyService) deleteChallenge(ctx context.Context, id string) {
	_, _ = s.db.ExecContext(ctx, `DELETE FROM webauthn_challenges WHERE id = ?`, id)
}

func mustJSON(v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}

var _ = bytes.NewReader
