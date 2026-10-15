-- name: CreateAPIKey :exec
INSERT INTO api_keys (id, user_id, name, key_hash, enabled, expires_at, created_at, updated_at)
VALUES (?, ?, ?, ?, 1, ?, ?, ?);

-- name: ListAPIKeysByUser :many
SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC;

-- name: GetAPIKeyByHash :one
SELECT * FROM api_keys WHERE key_hash = ?;

-- name: DeleteAPIKey :exec
DELETE FROM api_keys WHERE id = ? AND user_id = ?;

-- name: UpdateAPIKeyRateLimit :execrows
UPDATE api_keys
SET request_count = CASE
        WHEN last_request_at IS NULL OR last_request_at < sqlc.arg('window_start') THEN 1
        ELSE request_count + 1
    END,
    last_request_at = sqlc.arg('now')
WHERE id = sqlc.arg('id')
  AND (
    request_count < sqlc.arg('max') OR last_request_at IS NULL OR last_request_at < sqlc.arg('window_start')
  );
