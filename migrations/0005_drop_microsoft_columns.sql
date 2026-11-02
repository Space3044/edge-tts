-- The Microsoft engine was removed, so the columns that only served it go too.
ALTER TABLE provider_config DROP COLUMN region;
ALTER TABLE provider_config DROP COLUMN refresh_token_cipher;
ALTER TABLE provider_config DROP COLUMN token_updated_at;
ALTER TABLE provider_config DROP COLUMN access_token_cipher;
ALTER TABLE provider_config DROP COLUMN access_token_expires_at;
ALTER TABLE provider_config DROP COLUMN cookie_cipher;
