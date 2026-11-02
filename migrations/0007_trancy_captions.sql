-- YouTube caption scheduling for the Trancy pool.
--
-- `GET /3/youtube/captions/{videoId}?target=en&source=audio` answers
-- synchronously with the whole transcript, and free accounts may generate only
-- a handful of AI subtitles per day (`x-quota-limit` header,
-- `{"code":403,"message":"You've reached the daily limit of ..."}` on the body
-- once it is gone). Both facts drive the schema:
--
--   * a per-account daily counter plus the last observed quota headers, so the
--     scheduler can skip an account before it burns a request;
--   * an exhausted-until timestamp, so a rejected account is parked until the
--     next UTC day instead of being retried on every job;
--   * a cache keyed by (video, target): repeating a video must never spend
--     quota a second time.
ALTER TABLE trancy_account ADD COLUMN quota_limit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trancy_account ADD COLUMN quota_remaining INTEGER NOT NULL DEFAULT -1;
ALTER TABLE trancy_account ADD COLUMN quota_checked_at TEXT NOT NULL DEFAULT '';
ALTER TABLE trancy_account ADD COLUMN exhausted_until TEXT NOT NULL DEFAULT '';
ALTER TABLE trancy_account ADD COLUMN day_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trancy_account ADD COLUMN day_used_date TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS trancy_caption (
    video_id TEXT NOT NULL,
    target TEXT NOT NULL,
    account_id TEXT NOT NULL DEFAULT '',
    payload TEXT NOT NULL,
    sentence_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    PRIMARY KEY (video_id, target)
);

CREATE INDEX IF NOT EXISTS trancy_caption_created_at
    ON trancy_caption (created_at);
