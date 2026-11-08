# Agent Note: 补齐 Trancy AI 字幕生成与查询

Status: implemented

## Problem

`source=audio` 的 GET 只读取已有字幕。此前在视频没有 AI 字幕时返回 `caption_not_found`，即使账号有生成资格也不会创建字幕。官方客户端在这种情况下调用独立 POST 并查询状态；把“读取成功”的样本当成“同步生成成功”的证据，导致网关缺少生成链路。新视频通常处理数分钟，单个 HTTP 请求不能可靠承载完整等待。

## Decision

网关按读取、生成、查询分工：先调用 `/3/youtube/captions/{id}`；明确缺少 AI 字幕时查询 `/2/youtube/captions/{id}/status`；状态为 `none` 或可重试的 `error` 才 POST `/2/youtube/captions`。已有 `pending`、`downloaded` 或 `ok` 任务继续查询。JSON3 保持只读，不替代用户请求的 AI 字幕。

`POST /api/trancy/captions` 已有字幕返回兼容的 200，任务处理返回 202、`statusUrl`、`retryAfterMs`。`GET /api/trancy/captions/status?ticket=...` 查询状态，完成后取回整段字幕；它永不提交任务。所有响应禁止中间缓存。

调用方保存 AES-GCM 保护的 continuation ticket，绑定账号 ID、视频、语言、开始时间和 90 分钟期限。复用现有加密实现和独立 AAD，ticket 内不放账号 token、密码或字幕。每次查询从 D1 读取当前账号凭据，因此凭据续期与 Worker 重启不丢任务。账号额度耗尽或暂时冷却不阻止查询已提交任务；删除、封禁或失效账号明确报错。Cloudflare Access 仍是访问鉴权层。

上游保管生成任务；网关不引入任务表、字幕缓存或占位锁，保留用户将缓存与并发去重交给调用方的决定。查询状态不记本地用量；直接读取成功和明确接收生成各记一次，完成后的结果读取只更新额度观测，不重复增加本地计数或清除额度停泊。缺少额度头时余额为未知，不推测扣额。

生成 POST 超时、5xx 或不可识别的确认响应可能已经产生任务，因此返回 `submission_unknown` 并只查询同一账号。短暂 `none` 给 30 秒可见性窗口，仍未出现则明确返回 `generation_not_found`；不自动换号重复提交。明确的 daily-limit 或权限拒绝才允许在最多三个账号内尝试后续账号；权限拒绝不标记配额耗尽。未知状态与处理失败不会冷却健康账号。

### Change boundary

修改 `api.js` 上游协议、`captions.js` 调度、`store.js` 账号读取及额度观测、`routes/trancy.js` HTTP 状态；新增 `caption-ticket.js` 续查参数保护和 SQLite 回归脚本；同步 README 与相关决定。应用调用方仍需消费新增 202 契约；本次不修改 cognito-english、不发布、不重启 50 视频预计算、不恢复已删除 KV。

## Alternatives considered

- **一次 POST 内等待几分钟并最终返回 200**：最少改下游，但代理或调用方超时会丢失等待状态，还可能触发重复生成，因此使用 202 与独立查询。
- **D1 任务表、锁与后台轮询**：能统一去重并保证提交计数，但重新引入已删除的网关任务持久化和维护义务。当前上游已经提供状态，采用不保存任务的查询凭据；跨调用并发去重仍由调用方承担。
- **查询时重新从账号池选一个账号或自动补一次 POST**：遇到原账号问题时可能恢复，但会使任务归属、计数及重复扣额不可控，因此固定原账号，网络不确定时只查询。

## Consequences

新视频终于能触发真实 AI 字幕生成；已有字幕和 JSON3 的 200 返回结构兼容，不需要数据库迁移。新增 202 是有意的接口扩展，旧调用方若只认 200，必须增加遵循 `retryAfterMs` 的查询循环，并使用同一 Access 身份。单次状态查询故障可用原地址重试，终态失败与查询过期明确区分。

没有任务表意味着不能保证多个独立 POST 恰好生成一次；上游状态可减少顺序重复，但并发检查到 `none` 仍可能同时提交。提交成功后确认响应丢失时，本地计数也可能低于实际提交数，它不是计费账本。密钥更换会使旧 ticket 失效，删除原账号会阻断它的任务读取。若产品今后要求跨调用的严格去重或后台自驱恢复，应重新评估任务表而非偷偷扩大 ticket 能力。

## Verification

- 官方网页 `https://www.trancy.org/ai-subtitle` 明确生成队列；当前公开客户端 `https://learn.trancy.org/assets/index-CesRJ58b.js` 提供独立 POST、状态查询与 GET 结果流程，调用参数按该客户端核实。
- 2026-11-09 使用已配置账号对 `mFGzioRMW5s` 发起一次真实生成：之前状态 `none`，POST 返回 HTTP 200、`{"data":"pending","message":"ok"}`，后续状态 `ok`；最终读取 378 段字幕，每段都有 words，总共 4,103 个词。最终响应观测 `limit=2, remaining=0`，不据此推算每一步实际扣额。没有写入应用 KV。
- `scripts/verify-trancy-generation.mjs` 使用真实 SQLite 验证 HTTP 202 到 200、参数与方法、原账号续查、配额停泊、用量不重复增加、防篡改与过期、JSON3 不生成、明确拒绝换号、未知提交不重试、失败与可见性窗口。
- 既有 Trancy gateway、quota、代码卫生检查覆盖账号管理、原生字幕与现有返回结构。

## Related decisions

检索命中的记录中：[缺字幕错误分类](../bug-fix/2026-11-08-trancy-missing-ai-caption.md)保留底层错误识别，缺字幕就结束的策略由本文替代；[删除字幕缓存](../simplification/2026-11-02-drop-caption-cache.md)保留不存结果与调用方去重边界，仅“没有 202”被上游异步流程取代；[字幕调度](2026-11-02-trancy-caption-scheduler.md)保留账号选择、明确额度拒绝停泊，所谓同步生成由本文纠正；[额度观测](../bug-fix/2026-11-07-trancy-quota-observations.md)保留未知余额和本地计数不等于扣额，本文补充查询不计数。上述均部分重叠并互链；账号登录与建库决定无变动，没有完全吸收或待拒绝提案。
