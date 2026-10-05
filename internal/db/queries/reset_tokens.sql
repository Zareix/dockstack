-- name: InsertResetToken :exec
INSERT INTO reset_tokens (id, user_id, token_hash, expires_at, created_at)
VALUES (?, ?, ?, ?, ?);

-- name: GetActiveResetToken :one
SELECT user_id FROM reset_tokens WHERE token_hash = ? AND expires_at > ?;

-- name: DeleteResetTokensByUser :exec
DELETE FROM reset_tokens WHERE user_id = ?;
