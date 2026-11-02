-- Provider configuration for the speech-to-text engines.
--
-- endpoint / model are plain text so the settings UI can echo them back.
-- api_key_cipher holds the AES-GCM envelope produced by src/secrets/crypto.js
-- in the form "v1.<iv_b64>.<ciphertext_b64>"; the plaintext key never leaves
-- the Worker.
CREATE TABLE IF NOT EXISTS provider_config (
    provider TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    api_key_cipher TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);
