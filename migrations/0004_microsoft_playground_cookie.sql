-- Microsoft AI Playground mode authenticates with a pasted browser cookie jar
-- instead of an Azure credential. Encrypted with the same envelope as the
-- other provider secrets.
ALTER TABLE provider_config ADD COLUMN cookie_cipher TEXT NOT NULL DEFAULT '';
