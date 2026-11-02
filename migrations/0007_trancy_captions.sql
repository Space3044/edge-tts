-- YouTube caption quota bookkeeping for the Trancy pool.
--
-- `GET /3/youtube/captions/{videoId}?target=en&source=audio` answers
-- synchronously with the whole transcript, and a free account may generate only
-- a handful of AI subtitles per day (`x-quota-limit` response header,
-- `{"code":403,"message":"You've reached the daily limit of ..."}` in the body
-- once it is gone). Both facts drive these columns:
--
--   * a per-account daily counter plus the last observed quota headers, so the
--     scheduler can see who is cheapest before it burns a request;
--   * an exhausted-until timestamp, so a rejected account is parked until the
--     next UTC day instead of being retried on every job.
--
-- Generated subtitles are NOT stored: the gateway is a scheduler, the caller
-- keeps the transcript.
ALTER TABLE trancy_account ADD COLUMN quota_limit INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trancy_account ADD COLUMN quota_remaining INTEGER NOT NULL DEFAULT -1;
ALTER TABLE trancy_account ADD COLUMN quota_checked_at TEXT NOT NULL DEFAULT '';
ALTER TABLE trancy_account ADD COLUMN exhausted_until TEXT NOT NULL DEFAULT '';
ALTER TABLE trancy_account ADD COLUMN day_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trancy_account ADD COLUMN day_used_date TEXT NOT NULL DEFAULT '';
