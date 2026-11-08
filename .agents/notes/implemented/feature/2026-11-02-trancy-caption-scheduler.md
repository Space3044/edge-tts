# Agent Note: Trancy 字幕调度按每日额度分配

Status: implemented

> 同步返回只适用于已有字幕；新视频需要单独提交生成，见
> [异步生成与查询](2026-11-09-trancy-caption-generation.md)。

> 第 7 条的未知额度估算与调用次数口径由
> [额度观测修复](../bug-fix/2026-11-07-trancy-quota-observations.md) 取代。

> 第 1、5 条（结果缓存、并发占位锁）已被
> [删掉字幕缓存](../simplification/2026-11-02-drop-caption-cache.md) 取代：
> 网关只做额度调度，不保存字幕。

## Problem

多账号网关真正要服务的接口只有一个：

```text
GET https://api.trancy.org/3/youtube/captions/{videoId}?target=en&source=audio|json3
```

而免费号每个账号每天只能生成少量 AI 字幕（页面上写 5 个视频/天）。通用转发
（[Trancy 多账号网关](2026-11-02-trancy-account-gateway.md) 里的 `/api/trancy/relay`）
只做 LRU 轮换，不知道额度，结果是：额度烧完的账号仍被选中、同一个视频被重复生成、
一个视频失败就把三个账号的额度一起试掉。

实测契约（决定了下面的设计）：

- 接口**同步**返回整段字幕（句子 + 词级时间戳），没有 job、不需要轮询；
- 额度耗尽是 `200 {"code":403,"message":"You've reached the daily limit of 5 AI subtitles..."}`，
  不是 429——和鉴权失败一样只能看 body；
- 响应头有 `x-quota-limit` / `x-quota-remaining`，是唯一的结构化信号；
- 同一视频重复请求命中上游缓存时不扣额度（实测 `remaining` 不变），但这属于对方实现细节。

## Decision

把网关从「轮换转发」改成「额度分配器 + 结果缓存」。

### 1. 同视频同语言永不花第二次额度

`trancy_caption (video_id, target, account_id, payload, sentence_count, created_at)`。
命中直接返回 `cached: true`，不产生任何上游请求。理由很直接：5 个/天 的池子里，
重复生成是唯一能瞬间吃光额度的错误。缓存没有 TTL——字幕是静态内容，
真要刷新就删行。

### 2. 被拒绝的账号停泊到下一个 UTC 零点

`trancy_account.exhausted_until`。拒绝只是当天额度没了，token 仍然有效，
所以 `status` 保持 `ok`，每日 cron 照常续期：第二天零点账号自动回到池子里，
不需要人工干预。这比把状态改成 `dead` 准确得多。

### 3. 先花最空的账号

排序：本地 `day_used`（UTC 日）→ 上游 `x-quota-remaining` → LRU。
上游的 `quota_remaining` 语义有不一致（实测同一账号 `limit=2` 但文案写 5），
所以**自己的计数是主，上游数字是辅**：即使表头撒谎，每日 5 次的账本仍然成立。

### 4. 无额度可花时说清楚

`503 no_caption_quota` + `resetAt`（下一个 UTC 零点）+ `tried`（每个被咨询账号的失败原因）。
区分「池子是空的」（`no_account`）和「池子今天花完了」（`no_caption_quota`），
因为调用方对这两种情况的重试策略完全不同。

### 5. 并发同一视频只生成一次

缓存只能挡住「已经生成完」的重复请求；两个请求**同时**到达时都会 miss，
都会打上游，各扣一次额度——在 5 次/天的池子里这是最贵的一种浪费，所以生成权也用
`trancy_caption` 那一行来表示：

- 发起前 `INSERT ... ON CONFLICT(video_id, target) DO NOTHING` 写一行空 `payload` 占位；
  写进去的才是 owner，写不进去的直接读行：有 payload 就是已完成，没有就是有人在生成 →
  `202 {pending: true, retryAfterMs: 1500}` + `Retry-After`。
- 成功时用真实 payload 覆盖占位行；失败（额度耗尽、网络）删掉占位行，保证同一视频能立刻重试。
- 占位超过 90 秒视为 owner 已死（Worker 被回收、超时），下一个请求直接接管，避免永久卡死。
- `GET /api/trancy/captions/:videoId` 命中占位行时同样回 `202`，语义是「正在生成」而不是「不存在」。

### 6. 鉴权不是这里的事

网关不做应用层鉴权：`/api/*` 整体挂在 Cloudflare Access 后面，`TRANCY_API_TOKEN` 之类的窄钥匙
已经删除，下游改用 Access Service Token。理由与被删掉的 relay 记在
[收窄网关](../simplification/2026-11-02-access-only-auth-and-drop-relay.md)。

### 7. 额度要对人可见

额度只能在响应头里看到，所以面板不能只显示「上次的结果」，要显示可决策的数字：

- 每行 `AI subtitles <剩余>/<上限> · today <已用>`，未知时按官方 5 当分母
  （`TRANCY_DEFAULT_DAILY_LIMIT`，由 `GET /api/trancy/accounts` 下发，避免前端另写一个 5）；
- 顶部池子汇总 `<剩余> / <容量> left`；
- 额度耗尽的账号加 `QUOTA OUT` 徽章 + 恢复时间。

分母**不硬编码 5**：上游实测报 `x-quota-limit: 2`，所以有观测值时用观测值，没有才退回 5。
这个数字只用于展示与「还剩多少」的估算，真正的拦截仍然是上游的 403。

### 8. 接口收口

只有两个入口：`POST /api/trancy/captions`（花额度）与 `GET /api/trancy/captions/:videoId`
（只读缓存）。`target` 可省略、默认 `en`；`source` 也可省略、默认 `audio`，只允许 `audio` 或 `json3`，并原样传给上游；下游只要知道 videoId。
`videoId` / `target` / `source` 仍然做白名单校验。

## Alternatives considered

- **只保留通用 `/relay`，让调用方自己算额度**：额度账本会散落在每个调用方里，
  任一处算错就烧掉账号一天；而且缓存无从谈起，同一视频会被不同调用方反复生成。
- **按「请求数」而不是「视频数」计数**：上游按生成次数算账，重试、失败、换语言都会各算一次；
  按视频记账并配缓存，才是与用户可见额度对齐的口径。
- **把额度耗尽的账号标成 `dead`**：会迫使人工重新登录/重贴 token 才能恢复，
  而实际上 token 完好，只是今天没钱了。`exhausted_until` 更贴近事实。
- **等上游给出 429 再加调度**：上游永远 200，等的过程中账号已经被反复浪费。
- **失败时把同一个视频轮流打给所有账号直到成功**：看起来「成功率更高」，
  实际上一次失败会连坐多个账号的额度，且掩盖真正的错误（视频无音轨、语言不支持等）。
  这里限制最多 3 个账号，并且 `daily_limit` 之外的失败会记冷却而不是继续换号。

## Consequences

- 额度账本依赖我们自己的 `day_used` + UTC 日界。上游的真实重置时区没有测出来
  （只观测到拒绝的文案），如果它在别的时区重置，凌晨那几小时可能提前放行或提前拒绝；
  `exhausted_until` 至少保证不会重复试探。
- 缓存没有淘汰策略：视频多了表会长大。目前没有 TTL，因为删了就要重新花额度；
  如果将来要清，按 `created_at` 保留最近 N 天最合理。
- 同一个视频换语言算新的条目、也要花一次额度（上游是否这样计费未验证）。`source` 默认是 `audio`，调用方也可以显式选择 `json3`；两种 source 共用同一账号额度账本。
- `503` 语义变成「今天没额度了，`resetAt` 再来」，调用方需要按这个语义重试而不是快速重试。
- 新增 `trancy_caption` 表与 6 个账号列（`quota_*`、`exhausted_until`、`day_used*`），
  迁移 `0007` 已包含。

## Testing

`scripts/verify-trancy-gateway.mjs` 新增两组：第一次请求走上游并记账（`day_used=1`、
写入 `quota_*`）、同视频第二次 `cached: true` 且上游调用数不增加、换语言换账号（本地计数少的优先）、
第一个账号回 `daily limit` 时换号成功且只停泊一个账号（`exhausted_until` 落在 UTC 零点）、
全部停泊时 `503 no_caption_quota` 且**不再发起上游请求**，以及 HTTP 层：
非法 `videoId` 400、非法 `source` 400、默认 `audio` 和显式 `json3` 都会传给上游、`GET` 未缓存 404。

真机验证（同一天额度已耗尽的账号）：`POST` 首次返回 108 句、`X-Quota-Limit: 2`、
`X-Quota-Remaining: 0`、`usedToday: 1`；同视频第二次 `X-Trancy-Cached: 1`；
换一个新视频得到 `503 no_caption_quota` 且 `tried: ["…: daily_limit"]`、
账号 `exhaustedUntil` 落在次日 UTC 零点、`status` 仍是 `ok`。
