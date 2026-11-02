CREATE TABLE IF NOT EXISTS provider_config (
    provider TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    api_key_cipher TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trancy_account (
    id TEXT PRIMARY KEY,
    token_cipher TEXT NOT NULL DEFAULT '',
    password_cipher TEXT NOT NULL DEFAULT '',
    user_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    premium INTEGER NOT NULL DEFAULT 0,
    banned INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    token_issued_at TEXT NOT NULL DEFAULT '',
    last_checked_at TEXT NOT NULL DEFAULT '',
    last_used_at TEXT NOT NULL DEFAULT '',
    use_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    cooldown_until TEXT NOT NULL DEFAULT '',
    quota_limit INTEGER NOT NULL DEFAULT 0,
    quota_remaining INTEGER NOT NULL DEFAULT -1,
    quota_checked_at TEXT NOT NULL DEFAULT '',
    exhausted_until TEXT NOT NULL DEFAULT '',
    day_used INTEGER NOT NULL DEFAULT 0,
    day_used_date TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS trancy_account_user_id
    ON trancy_account (user_id) WHERE user_id <> '';

CREATE INDEX IF NOT EXISTS trancy_account_status
    ON trancy_account (status, cooldown_until);
