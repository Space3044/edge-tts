-- Microsoft tokens are pasted by the user instead of fetched through an OAuth
-- callback, so the access token needs its own column plus the expiry decoded
-- from the JWT `exp` claim.
ALTER TABLE provider_config ADD COLUMN access_token_cipher TEXT NOT NULL DEFAULT '';
ALTER TABLE provider_config ADD COLUMN access_token_expires_at TEXT NOT NULL DEFAULT '';
