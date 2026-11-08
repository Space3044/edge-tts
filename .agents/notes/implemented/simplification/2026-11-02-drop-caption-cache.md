# Agent Note: 删掉字幕缓存

Status: implemented

> 不存字幕及调用方去重的边界仍保留；上游异步生成所需的 202 与实时查询见
> [字幕生成](../feature/2026-11-09-trancy-caption-generation.md)，它不恢复缓存表或占位锁。

> 无缓存边界保持不变；后续的额度展示与原子调用计数见
> [额度观测修复](../bug-fix/2026-11-07-trancy-quota-observations.md)。

## Problem

[字幕调度按每日额度分配](../feature/2026-11-02-trancy-caption-scheduler.md) 当初把「同视频不花第二次额度」
做成了网关自带的能力：`trancy_caption` 表按 `(video_id, target)` 存整段字幕，再加一行空 `payload`
的占位记录当并发锁（抢不到的回 `202 pending`，90 秒没人完成就接管）。

这套机制自身是自洽的，但它把网关变成了**半个存储服务**：

- 字幕是调用方要的数据，网关多存一份，就要回答「存多久、谁来清、换 target 算不算同一条」；
- 占位锁带来 `202 pending` 这个第三态，下游必须实现「等一下再重试」的循环；
- 表里躺着的是十几 KB 的 JSON，和「按额度挑账号」这个真正的职责没有关系。

使用者的判断更直接：**不需要缓存**。去重是调用方的事（它本来就知道自己要生成哪些视频），
网关只负责在额度内把请求发出去、把结果交给对方。

## Decision

删掉缓存与它带出来的一切：

- `trancy_caption` 表、`writeCaptionCache` / `readCaptionCache`、`claimCaptionSlot` /
  `stealStaleCaptionClaim` / `releaseCaptionClaim`；
- `readCachedCaptions`、`cacheView`、`PENDING_RETRY_MS`、`CLAIM_TTL_MS`，以及响应里的 `cached` 字段；
- `GET /api/trancy/captions/:videoId`（它只读缓存）和 `202 pending` 这一状态；
- `migrations/0007` 里只保留额度账本那六列，不再建表（迁移尚未上过任何环境，直接改写而不是再补一条 `DROP TABLE`）。

`POST /api/trancy/captions` 现在是唯一的字幕入口，行为退化成一次干净的三步：

1. 按「今天用得最少 → 上游 `x-quota-remaining` → LRU」挑账号；
2. 打一次上游，成功就把 `data` 原样回给调用方并记账；
3. 额度耗尽的账号停泊到次日 UTC 零点，全部停泊则 `503 no_caption_quota` + `resetAt` + `tried`。

`target` 保留（默认 `en`），因为「生成哪种语言的字幕」是请求本身的属性，不是缓存的一部分。

## Alternatives considered

- **保留缓存但去掉 202 锁**：少一个状态，但表还在，仍然要回答「存多久、谁清」，只是把并发问题藏起来。
- **缓存加 TTL（比如 7 天）+ 定时清理**：把「不需要缓存」的问题变成「定时任务维护缓存」的问题，
  多一条 cron、多一个失败面。
- **把字幕写回调用方指定的存储（R2/外部 DB）**：那是另一个产品，网关不该拥有写入目的地。
- **保留 `GET /captions/:videoId` 只查 D1**：没有缓存表就没有可查的东西；留着只会是 404 制造机。

## Consequences

- **重复请求会重复花额度**。同一个视频请求两次就是两次生成（除非 Trancy 自己命中它的上游缓存，
  实测有时会，但那是对方行为，不作保证）。这是明确接受的代价：去重责任转移给调用方。
- **并发同一视频会各花一次额度**。之前那套占位锁一并删除，不再有 `202`。
- 下游从「POST 拿 202 → 轮询 GET」简化成「POST 拿 200」，少一个状态机；README 的示例同步缩短。
- 少一张表、一个迁移里的建表语句、五个 store 函数、一个路由分支；`scripts/verify-trancy-gateway.mjs`
  里关于缓存命中、占位锁、接管、202 的四组用例全部删除。
- 迁移 `0007` 被就地改写（只留 `ALTER TABLE ... ADD COLUMN` 六条）。因为它还没在任何环境应用过，
  再补一条 `DROP TABLE` 只会留下「建了又删」的历史。

## Testing

`scripts/verify-trancy-gateway.mjs`：

- **同一视频请求两次 → 上游被调用两次**，断言网关不再保存任何东西（响应里没有 `cached` / `pending`）；
- 额度拒绝时换号重试、只停泊一个账号、UTC 零点恢复时间不变；
- 全部停泊 → `503 no_caption_quota` + `resetAt`，且不再发起上游请求；
- HTTP 层：只传 `videoId` 就是合法请求（`target` 默认 `en`）、`GET /api/trancy/captions/:id` 现在 404。

真机（本地 `wrangler dev`，绕开本机 HTTP 代理）：`POST /api/trancy/captions {"videoId":"npka43vhwNo"}`
返回 200 与 108 句；`GET /api/trancy/captions/npka43vhwNo` 返回 404；库里 `trancy_caption` 表已不存在。
