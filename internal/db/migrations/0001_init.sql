-- Clean Go-native schema for dockstack.

CREATE TABLE users (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    username       TEXT UNIQUE,
    avatar         TEXT NOT NULL DEFAULT '',
    role           TEXT NOT NULL DEFAULT 'user',
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
);

CREATE TABLE credentials (
    user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    updated_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
    id             TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash     TEXT NOT NULL UNIQUE,
    expires_at     INTEGER NOT NULL,
    ip_address     TEXT NOT NULL DEFAULT '',
    user_agent     TEXT NOT NULL DEFAULT '',
    impersonated_by TEXT,
    created_at     INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE api_keys (
    id                 TEXT PRIMARY KEY,
    user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    key_hash           TEXT NOT NULL UNIQUE,
    enabled            INTEGER NOT NULL DEFAULT 1,
    expires_at         INTEGER,
    request_count      INTEGER NOT NULL DEFAULT 0,
    last_request_at    INTEGER,
    rate_limit_max     INTEGER NOT NULL DEFAULT 100,
    rate_limit_window  INTEGER NOT NULL DEFAULT 60000,
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL
);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);

CREATE TABLE passkeys (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL DEFAULT '',
    credential_id TEXT NOT NULL UNIQUE,
    public_key    BLOB NOT NULL,
    counter       INTEGER NOT NULL DEFAULT 0,
    aaguid        BLOB NOT NULL,
    transports    TEXT NOT NULL DEFAULT '[]',
    created_at    INTEGER NOT NULL
);
CREATE INDEX idx_passkeys_user ON passkeys(user_id);

CREATE TABLE webauthn_challenges (
    id         TEXT PRIMARY KEY,
    challenge  TEXT NOT NULL,
    user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE oauth_accounts (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id       TEXT NOT NULL,
    provider_user_id  TEXT NOT NULL,
    email             TEXT NOT NULL DEFAULT '',
    created_at        INTEGER NOT NULL,
    UNIQUE (provider_id, provider_user_id)
);
CREATE INDEX idx_oauth_accounts_user ON oauth_accounts(user_id);

CREATE TABLE reset_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);