-- name: UpsertCredential :exec
INSERT INTO credentials (user_id, password_hash, updated_at)
VALUES (?, ?, ?)
ON CONFLICT (user_id) DO UPDATE
SET password_hash = excluded.password_hash,
    updated_at = excluded.updated_at;

-- name: GetCredential :one
SELECT * FROM credentials WHERE user_id = ?;
