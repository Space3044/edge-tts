-- Trancy accounts for the multi-account gateway.
--
-- One row per account. The JWT is stored with the same AES-GCM envelope as
-- provider API keys (src/secrets/crypto.js) using "trancy:<id>" as additional
-- authenticated data, so a ciphertext copied from one row into another fails
-- to decrypt.
--
-- Two things are deliberately not encrypted or not modelled here:
--
--   * `password` is plaintext. It exists so a dead token can be revived with
--     one click (`POST /1/login` with the stored credential) instead of
--     walking the operator through devtools again. The read API only echoes it
--     to callers that already passed the write guard.
--   * There is no label/notes column: `/1/user/profile` answers with the email,
--     so the email identifies an account and nothing has to be typed twice.
--
-- The token has no `exp` claim. `/1/user/profile` answers with a freshly issued
-- token (new `iat`, new signature), and an unrefreshed token stays valid for an
-- unknown window, so `token_issued_at` records the last renewal, not an expiry.
CREATE TABLE IF NOT EXISTS trancy_account (
    id TEXT PRIMARY KEY,
    token_cipher TEXT NOT NULL DEFAULT '',
    password TEXT NOT NULL DEFAULT '',
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
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Re-adding the same Trancy user updates the existing row instead of creating a
-- duplicate. Empty user_id (an unparsable token) is exempt so it never collides.
CREATE UNIQUE INDEX IF NOT EXISTS trancy_account_user_id
    ON trancy_account (user_id) WHERE user_id <> '';

CREATE INDEX IF NOT EXISTS trancy_account_status
    ON trancy_account (status, cooldown_until);
