-- Microsoft (Azure AI Speech) needs a region for the speech endpoint and an
-- OAuth refresh token instead of an API key. Both are stored on the same
-- provider row; the refresh token uses the same AES-GCM envelope as API keys,
-- with "microsoft:refresh_token" as additional authenticated data.
ALTER TABLE provider_config ADD COLUMN region TEXT NOT NULL DEFAULT '';
ALTER TABLE provider_config ADD COLUMN refresh_token_cipher TEXT NOT NULL DEFAULT '';
ALTER TABLE provider_config ADD COLUMN token_updated_at TEXT NOT NULL DEFAULT '';
