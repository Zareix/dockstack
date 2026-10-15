-- name: GetOAuthAccountUser :one
SELECT user_id FROM oauth_accounts WHERE provider_id = ? AND provider_user_id = ?;

-- name: InsertOAuthAccount :exec
INSERT INTO oauth_accounts (id, user_id, provider_id, provider_user_id, email, created_at)
VALUES (?, ?, ?, ?, ?, ?);
