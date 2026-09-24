-- name: CreateSession :exec
INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: GetSessionWithUserByTokenHash :one
SELECT
    s.id AS session_id,
    s.user_id AS session_user_id,
    s.expires_at,
    s.ip_address,
    s.user_agent,
    s.impersonated_by,
    s.created_at AS session_created_at,
    u.id AS user_id,
    u.name AS user_name,
    u.email AS user_email,
    u.email_verified AS user_email_verified,
    u.username AS user_username,
    u.avatar AS user_avatar,
    u.role AS user_role,
    u.created_at AS user_created_at,
    u.updated_at AS user_updated_at
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = ?;

-- name: ListSessionsByUser :many
SELECT id, user_id, expires_at, ip_address, user_agent, impersonated_by, created_at
FROM sessions
WHERE user_id = ?
ORDER BY created_at DESC;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = ? AND user_id = ?;

-- name: DeleteOtherSessions :exec
DELETE FROM sessions WHERE user_id = ? AND id != ?;

-- name: DeleteSessionByTokenHash :exec
DELETE FROM sessions WHERE token_hash = ?;
