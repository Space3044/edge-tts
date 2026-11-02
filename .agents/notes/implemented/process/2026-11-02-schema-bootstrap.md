# Agent Note: 合并出一份从零建库的 schema.sql

Status: implemented

## Problem

建库只能靠「按顺序跑 7 个迁移」。迁移链里有一半是历史包袱：`0002`–`0004` 加 Microsoft 字段、
`0005` 又删掉；Trancy 这边也经历过「建 `label` 列 → 删」「建字幕缓存表 → 删」。
全新环境执行一遍能跑通，但它不是一份能拿去看的结构说明书：想手动建库、
或先看一眼「到底有几张表、哪些列」，得把 7 个文件在脑子里叠加。

## Decision

仓库根目录加一份 `schema.sql`，内容是**跑完所有迁移之后的最终结构**——三张表
（`provider_config`、`trancy_account`、wrangler 自己的 `d1_migrations`）加两个索引，
字段顺序与 `ALTER TABLE` 追加后的实际顺序一致（`quota_*` / `day_used*` 在末尾）。

放根目录而不是 `migrations/`：放进去会被 `wrangler d1 migrations apply` 当成第 8 个迁移执行，
而它在全新库上会先建出最终表、再让 `0002` 的 `ALTER TABLE ADD COLUMN` 撞上重复列名。

两种用法并存：

- **A（推荐）**：`d1 create` + `d1 migrations apply`，版本由 wrangler 管；
- **B**：`d1 execute --file=schema.sql` 一次性建好。为了不让 B 把 A 弄坏，文件末尾自己建
  `d1_migrations` 表并 `INSERT OR IGNORE` 写入 `0001`–`0007`，于是之后 `migrations apply`
  报告 "No migrations to apply"，而**新增**的迁移照常按名字顺序执行。

文件头也写明了两条密文各自的 `aad` 约定（`provider` 名 / `trancy:<行 id>`）、
`password` 为什么是明文、`status` 的取值、`quota_*` 与 `exhausted_until` 的 UTC 日界语义。

## Alternatives considered

- **把 `schema.sql` 放进 `migrations/0000_...`**：会与 `0002`–`0007` 在全新库上冲突（见上）。
- **把迁移链压成一条再删掉其余的**：对已有数据的库是破坏性操作，且 wrangler 记录过的迁移名不能改。
- **只写文档描述结构，不给可执行 DDL**：手工建库容易漏索引或写错默认值，最后表现为运行时报错。
- **加 `DROP TABLE IF EXISTS` 让脚本可重复执行**：误用时静默清库，也绕过了「已有数据的库走增量」这条规则。

## Consequences

- 有两处描述同一结构（迁移链 + `schema.sql`），加新迁移时必须同步更新 `schema.sql`，
  否则它会悄悄落后。README 和文件头都写了这条约束；`verify-readme.mjs` 断言 README 提及 `schema.sql`。
- 用法 B 之后 `d1_migrations` 里已有 7 条记录，wrangler 不会回放历史迁移；
  若手工删了某张表，`migrations apply` 不会替你重建——那是 `schema.sql` 的职责。
- 脚本只用 `CREATE ... IF NOT EXISTS`，没有任何破坏性语句：重复执行最多是 no-op。

## Testing

删掉 `.wrangler/state` 后只执行 `npx wrangler d1 execute voicecraft --local --file=schema.sql`，然后验证：

- `sqlite_master` 里正好是 `provider_config`、`trancy_account`、`d1_migrations` 三张表 + 两个索引；
- `d1_migrations` 有 7 条记录，`wrangler d1 migrations apply --local` 输出 "No migrations to apply!"；
- 真机 `wrangler dev`：`PUT /api/providers/openai` 写入并回显 `••••hema`；
  `POST /api/trancy/accounts/login` 插入行（密文前缀 `v1.`、`password` 长度 15）；
  `POST /api/trancy/captions` 写回 `quota_limit=2`、`quota_remaining=0`、`day_used=1`、`day_used_date`。
  这三条覆盖全部列的读写路径，列名/类型与代码不一致会立刻报错。
