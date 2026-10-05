-- name: InsertChallenge :exec
INSERT INTO webauthn_challenges (id, challenge, user_id, kind, expires_at, created_at)
VALUES (?, ?, ?, ?, ?, ?);

-- name: GetChallenge :one
SELECT challenge, user_id FROM webauthn_challenges
WHERE id = ? AND kind = ? AND expires_at > ?;

-- name: DeleteChallenge :exec
DELETE FROM webauthn_challenges WHERE id = ?;
