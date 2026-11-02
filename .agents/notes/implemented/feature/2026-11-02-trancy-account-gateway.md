# Agent Note: Trancy 多账号网关

Status: implemented

## Problem

需要把多个 Trancy 账号合成一个入口：管理凭据、轮换账号、自动续期，并给外部程序一个统一的转发点。

第二轮的诉求更具体：手动翻 devtools 复制 `trancy` cookie 太麻烦，希望能**登录或注册就把账号收进来**，
把邮箱密码一起存下来，token 失效时点一下就能重新登录换新 token。

上一轮同类需求（Microsoft AI Playground cookie）以失败收场，见
[移除 Microsoft 转录引擎](../simplification/2026-11-02-remove-microsoft-engine.md)：
短命会话 cookie 只能人工重贴，最后整条渠道被删。所以这次先取证再动手，结论决定架构。

实测（浏览器 + 裸 curl，同一账号）：

- 凭据是一条 HS256 JWT，载荷仅 `{ name, id, iat }`，**没有 `exp`、没有 scope、没有 refresh token**。
- 客户端（网页 / 扩展）把它放在 `.trancy.org` 的**非 httpOnly** `trancy` cookie 里（365 天），
  调 `api.trancy.org` 时用 `Authorization: Bearer <token>`。
- **没有刷新接口**。任何一次 `GET /1/user/profile` 都会返回一条 `iat` 被推到当前秒的新 token；
  旧 token 不会被吊销（同一 token 连续用三次都 200）。
- **鉴权失败返回 200**：`{"data":null,"message":"ok"}`，和「完全没带凭据」的响应一模一样。
- 没有 IP 绑定、设备指纹或 CSRF 校验：从东京 Linode（数据中心 IP）用裸 curl、无 cookie、
  无 Origin/Referer 请求 profile 直接 200。
- 上游响应从不发 `Set-Cookie`，cookie 完全由前端 JS 写入。

## Decision

`/trancy` 标签页 + `trancy_account` 表 + 每天一次的 cron 续期 + 受写权限保护的转发接口。

### 账号标识就是邮箱，没有备注名

一开始每个账号带一个运维手填的 `label`，实测没人愿意每次想名字，而 Trancy 自己的 profile 就回邮箱。
于是 `label` 列在发布前就被从 `migrations/0006` 里去掉（迁移还没上过任何环境，不值得留一条 `DROP COLUMN`）：列表标题用 `email`，还没探测成功的账号退回 JWT 里的 `name`
（Trancy 的 `name` 就是邮箱前缀），转发响应头也从 `X-Trancy-Label` 改成 `X-Trancy-Email`。
少一个输入框、少一个可能写错又永远对不上的字符串，去重键仍然是 JWT 的 `id`。

### 凭据可以来自登录，也可以来自粘贴

`POST /1/login` 和 `POST /1/signup` 都直接返回 `{message:"ok", data:{..., token}}`，
没有邮箱验证、没有 cookie、没有第二次往返，所以「登录即入库」是一条 subrequest 就能完成的事：
`loginTrancyAccount` 拿到 token 后直接写表（token 加密，密码明文），不再额外探活。
失败的形状是 **`200 {"code":409,"message":"Incorrect password"}`**，判定同样不看状态码，
`message !== "ok"` 即失败，并且把 Trancy 自己的文案透给前端（`email: Invalid email; ...` 这类校验信息很有用）。

密码明文落库是使用者明确要求的取舍（`migrations/0006` 的 `password` 列），
换来的能力是 `POST /api/trancy/accounts/:id/login` 一键复活 `dead` 账号。
代价用**读侧收口**压低：`GET /api/trancy/accounts` 只有在请求本身通过写权限校验时才回 `password`，
否则只给 `hasPassword: true` 和空串——`locked` 部署、匿名请求都看不到密码。
token 仍然加密：页面只显示尾巴，密文跨行不可解密。

### 凭据就是一条 token，不是 cookie jar

网关只存 token 字符串：不做 cookie 解析、不存 `Set-Cookie`、不实现 cookie jar 合并。
上游不发 `Set-Cookie`，这条复杂度根本不存在。粘贴入口仍接受 `Bearer ...`、
`trancy=...` 和整条 `Cookie:` 头，因为运维手上通常是这些形态（`normalizeTrancyToken`）。

### 续期 = 打一次 profile

`src/trancy/api.js` 的 `fetchTrancyProfile` 同时承担「探活」和「续期」：返回的 `profile.token`
就是新凭据。`iat` 是 token 唯一的时效信息，因此表里记 `token_issued_at`（上次签发时间），
不记 expiry。`wrangler.toml` 的 `crons = ["17 3 * * *"]` 每天跑一次
`refreshAllTrancyAccounts`，逐个账号写回新密文并更新 `premium` / `banned`。

### 判活看 `data`，不看状态码

`data === null` 是**唯一**可用的失效信号，HTTP 状态永远是 200。三处依赖这条：
`refreshTrancyAccount`（把一个账号标成 `dead`）、`relayTrancyRequest`（把 `tokenInvalid` 传回路由）、
以及 cron 的统计。

### 状态机与轮换

`new → ok / banned / dead`，加 `fail_count` 与 `cooldown_until`：

- `ok` 才会被 `pickTrancyAccount` 选中；`banned` 记录但永不派出；`dead` 只有人工重贴 token 才复活。
- 网络/5xx 只是 `fail_count++` 并设冷却（`2^n` 分钟，上限 60），**不会**把账号打成 `dead`——
  一次网络抖动不该毁掉一条凭据。
- 选择规则是 `(last_used_at = '') DESC, last_used_at ASC`，即最久未用的 `ok` 账号，
  连续调用会自然摊开而不是榨干第一个。
- 转发拿到 `data:null` 时先标记该账号 `dead`，并在**同一次请求**里换下一个账号重试一次
  （最多 2 次尝试），调用方不必自己重试。

### 网关的真实目的是字幕调度

池子最终服务的是 YouTube AI 字幕那一个接口，它按「每日视频数」计费，
所以调度规则、缓存与额度账本单独记在
[字幕调度按每日额度分配](2026-11-02-trancy-caption-scheduler.md) 里。

通用转发（`/api/trancy/relay`）和「只有写权限才能看密码」的收口都已删除，
见 [收窄网关](../../simplification/2026-11-02-access-only-auth-and-drop-relay.md)：
鉴权只留在 Cloudflare Access，Worker 不再有 `ADMIN_TOKEN` 之类的自研开关。

### 密钥与视图

token 走 `src/secrets/crypto.js` 的 AES-256-GCM 信封，`aad = trancy:<行 id>`，跨行复制解不开；
换 `SECRETS_ENCRYPTION_KEY` 会让整批 token 失效（与 provider key 语义一致）。
浏览器视图只有 `tokenTail`（`••••` + 末 6 位）、邮箱、会员状态、时间戳和计数。

## Alternatives considered

- **保留手填备注名**：能让同一个邮箱的两个账号看起来不一样，但实际场景里一个邮箱就是一个账号，
  而 `label` 又与 token 一起成为「两个真相」；识别账号本来就有 `user_id` 和 `email` 两个稳定键。
- **密码也加密（和 token 同样信封）**：更安全，但页面就没法「显示密码」——而显示密码正是
  使用者要的可用性（同一密码复用到别处、手动去官网登录核对）。选择明文 + 读侧按写权限收口，
  而不是加密后到处解不开。真要收紧，改成加密只需改 `saveCredentialLogin` 与 `accountView` 两处。
- **用无头浏览器模拟登录拿 cookie**：能绕过任何未来的前端风控，但要在 Worker 里跑浏览器（不可行）
  或额外维护一台机器；而 `/1/login` 已经是纯 JSON 接口，直接调更短、更快、更稳。
- **cookie jar 方案（存整条 `Cookie:` 头 + 合并 `Set-Cookie`）**：这是 Microsoft playground 的老路。
  实测上游从不写 cookie，且 token 不绑 IP，做 cookie 管理等于给一个不存在的问题写代码。
- **塞进 `provider_config`**：一张表只有一个 `api_key_cipher`，多账号要么拼 JSON 要么加一组列，
  两种都会把「N 个凭据 + 各自状态」塞进按 provider 主键设计的行里；独立表更直白。
- **不做 cron，只在转发时顺手续期**：能工作，但一旦某账号几天没被轮到就可能过期，
  而失效信号又是 200 + `data:null`，故障会表现为「偶发的空结果」。每天一次的成本是 N 个 subrequest。
- **cron 里连带重试 `dead` 账号**：`dead` 意味着 token 被服务端拒绝，再用同一密文探测只是白烧
  一次调用并把 `fail_count` 抬高；人工重贴是唯一出路。
- **开放 `/trancy/*` 透明反代**：实现更省事，但那是把账号额度暴露成公网免费代理。
  收成单入口 + RPC 形态，顺带把「选号/重试/冷却」留在网关里而不是散到调用方。
- **把 token 放 KV 而不是 D1**：KV 最终一致，刚写入的 token 可能读不到旧值，
  轮换时要额外处理竞争；而这张表本来就要和 D1 里的其他状态一起查。

## Consequences

- 失效判定依赖 `data === null` 这一非标准契约。Trancy 哪天改成正常 401，网关会把 `data:null`
  之外的失败当成网络错误，表现是账号停在 `ok` 但转发持续 401——排查入口是
  `src/trancy/api.js` 顶部的注释和 `scripts/verify-trancy-gateway.mjs` 里的 `profileReply` 假响应。
- 密码是 D1 里的明文：拿到数据库或 `ADMIN_TOKEN` 的人等于拿到这些账号。这是有意接受的代价，
  部署必须是 Access 保护或仅自己可达；`GET` 的 `passwordsVisible` 字段就是这条边界的可观测信号。
- 注册接口对 Trancy 是公开的，网关只是转调；批量注册属于滥用，面板里没有批量入口，也没有代理池。
- 每天一次 cron 是链路的一部分：不部署 triggers（或非默认环境漏声明），账号会在未知窗口后变 `dead`。
  token 不续期到底能活多久仍未测出——只能在真实账号上等，`token_issued_at` 就是观察点。
- 多账号轮换会消耗同一服务商的多份免费额度，条款风险由使用者承担；封号在数据里表现为
  `status=banned`，网关不会尝试绕过。
- 新增两个面向公网的写接口（账号管理、转发）都挂在既有写权限后面，`locked` 环境下全部 403，
  与 Provider 配置的失败模式一致。
- 净增代码集中在 `src/trancy/`（token / api / store）、`src/routes/trancy.js`、一个迁移、
  一个前端 tab 与 `scripts/verify-trancy-gateway.mjs`；`src/utils/admin.js` 从 `routes/providers.js`
  抽出共用，provider 行为不变（`verify-provider-secrets.mjs` 仍通过）。

## Testing

`node scripts/verify-trancy-gateway.mjs`（假 D1 + 假 fetch）覆盖：token 形态归一化、载荷解码、
密文落库且 `aad` 绑定行 id、粘贴即探测、`data:null` → `dead`、重贴复活、网络失败只退避不判死、
`banned` 不派出、LRU 轮换、`refreshAll` 跳过 `dead` 与刚查过的账号、转发接口的 401/400/503 与
「同一次请求内换号重试」。

另有三组用例针对凭证登录：`200 + code 409` 的失败不会被当成成功且**不写行**、
密码明文落库而 token 仍是密文、`includePasswords` 默认关闭且 `locked` 环境永远为空、
`/:id/login` 真的被路由（这条曾因为 `segments.length === 5` 的分支漏判 404，现已回归覆盖）、
没有密码的账号返回 `trancy_no_credentials`。

注册成功后的形状是从一个一次性探测号上验出来的（`deepseek-probe-1@mailinator.com`，已用
`DELETE /1/user` 删除并确认：密码登录返回 `Incorrect password`、旧 token 的 profile 返回 `data:null`）。
顺带确认了 `DELETE /1/user` 只用 bearer token 就能注销账号——要加「删除 Trancy 账号」按钮时走这条，
不要自己在 D1 里删行就以为账号没了。

真机验证过两次：本地 `wrangler dev` 用自己的账号添加 → `status=ok`（token 立即被换新）、
`relay` 调 `/2/dictionary` 返回 200 并带 `X-Trancy-Email`、`--test-scheduled` 触发 cron
输出 `checked=1 ok=1`；换成邮箱密码登录同样一次成功，`Log in again` 能换出新 token，
错误密码返回 `400 trancy_login_failed: Incorrect password`。
