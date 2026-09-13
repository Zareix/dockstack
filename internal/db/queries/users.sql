-- name: CountUsers :one
SELECT COUNT(*) FROM users;

-- name: CreateUser :exec
INSERT INTO users (id, name, email, email_verified, username, avatar, role, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ?;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ?;

-- name: GetUserByUsername :one
SELECT * FROM users WHERE username = ?;

-- name: UsernameTaken :one
SELECT COUNT(*) FROM users WHERE username = ?;

-- name: UpdateUser :exec
UPDATE users
SET name = COALESCE(sqlc.narg('name'), name),
    avatar = ?,
    updated_at = ?
WHERE id = ?;

-- name: ChangeUserEmail :exec
UPDATE users SET email = ?, updated_at = ? WHERE id = ?;
