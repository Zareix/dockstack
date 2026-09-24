-- name: InsertPasskey :exec
INSERT INTO passkeys (id, user_id, name, credential_id, public_key, counter, aaguid, transports, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: ListPasskeyPublicKeys :many
SELECT public_key FROM passkeys WHERE user_id = ?;

-- name: UpdatePasskeyCounter :exec
UPDATE passkeys SET counter = ? WHERE user_id = ? AND credential_id = ?;

-- name: ListPasskeysByUser :many
SELECT id, user_id, name, credential_id, created_at FROM passkeys WHERE user_id = ?;

-- name: DeletePasskey :exec
DELETE FROM passkeys WHERE id = ? AND user_id = ?;
