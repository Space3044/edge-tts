-- VoiceCraft 数据库结构（从零建库用）
--
-- 内容等价于按顺序执行完 migrations/0001..0007 之后的最终结构，已合并掉历史上
-- 加了又删的 Microsoft 字段，以及 Trancy 早期的 label / 字幕缓存表。
--
-- 两种用法，二选一：
--
--   A. 交给 wrangler 管版本（推荐，以后有迁移直接 apply）
--      npx wrangler d1 create voicecraft
--      # 把返回的 database_id 填进 wrangler.toml（默认 / production / staging）
--      npx wrangler d1 migrations apply voicecraft --remote
--
--   B. 已经建好库，想一次执行完整 DDL
--      npx wrangler d1 execute voicecraft --remote --file=schema.sql
--      文件末尾会把 0001..0007 记进 d1_migrations，之后 migrations apply 不会
--      重复执行，将来新增的迁移照常 apply。
--
-- 已有数据的库不要执行本文件，用 migrations apply 走增量。
--
-- 加密约定（两条都依赖 Worker 的 SECRETS_ENCRYPTION_KEY，base64 的 32 字节）：
--   provider_config.api_key_cipher  aad = provider 名（如 "openai"）
--   trancy_account.token_cipher     aad = "trancy:<该行 id>"
-- 密文形如 v1.<iv_b64>.<ciphertext_b64>；换掉密钥等于让这些字段全部无法解密。

-- 转录服务的 endpoint / 模型 / API Key。
-- endpoint、model 是明文，便于在设置面板回显；密钥只存密文与掩码尾巴。
CREATE TABLE IF NOT EXISTS provider_config (
    provider TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    api_key_cipher TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);

-- Trancy 账号池。
--
-- * token_cipher 加密；password 明文（一键重新登录用，因此 /api/* 必须在 Access 后面）。
-- * status: new | ok | banned | dead；dead 只能靠重贴 token 或重新登录恢复。
-- * quota_* / day_used* 是 YouTube AI 字幕的每日额度账本（UTC 日界）；
--   exhausted_until 停泊当天额度用完的账号，到期自动回池。
-- * 没有 label 列：邮箱就是账号标识。
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
    quota_limit INTEGER NOT NULL DEFAULT 0,
    quota_remaining INTEGER NOT NULL DEFAULT -1,
    quota_checked_at TEXT NOT NULL DEFAULT '',
    exhausted_until TEXT NOT NULL DEFAULT '',
    day_used INTEGER NOT NULL DEFAULT 0,
    day_used_date TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 同一个 Trancy 用户重复添加时更新原行，而不是插入第二行；
-- 解析不出 user_id 的行不受约束。
CREATE UNIQUE INDEX IF NOT EXISTS trancy_account_user_id
    ON trancy_account (user_id) WHERE user_id <> '';

-- 调度器按 (status, cooldown_until) 过滤候选账号。
CREATE INDEX IF NOT EXISTS trancy_account_status
    ON trancy_account (status, cooldown_until);

-- wrangler 的迁移账本：只走用法 B（手工执行本文件）时才需要写。
-- 用法 A 由 wrangler 自己维护，这里的 INSERT OR IGNORE 不会造成重复。
CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT OR IGNORE INTO d1_migrations (name) VALUES
    ('0001_provider_config.sql'),
    ('0002_microsoft_oauth.sql'),
    ('0003_microsoft_access_token.sql'),
    ('0004_microsoft_playground_cookie.sql'),
    ('0005_drop_microsoft_columns.sql'),
    ('0006_trancy_account.sql'),
    ('0007_trancy_captions.sql');
