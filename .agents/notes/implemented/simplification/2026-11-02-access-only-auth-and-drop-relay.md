# Agent Note: 收窄网关：鉴权只留 Cloudflare Access，删掉 relay

Status: implemented

## Problem

Trancy 网关在几次迭代里长出了三样东西，事后看都该减掉：

1. **一套自研鉴权**：`ADMIN_TOKEN`（Bearer）、`CF_ACCESS_TRUSTED=1`（信任 Access 就开关）、
   `TRANCY_API_TOKEN`（给下游的窄钥匙），加上 `writeMode()` 三态判定和 `requireAdmin()`。
   实际上这个部署的鉴权**已经全部交给 Cloudflare Access**：`/api/*` 整个挂在 Access 后面，
   页面本来就要先过 Access 登录。再叠一层应用内口令只是多一处要配、多一处能配错。
2. **`/api/trancy/relay`**：一个「用池子里的 token 转发任意 api.trancy.org 路径」的通用代理。
   它最初用于排查（打印别人接口的原始响应），但下游真正需要的只有 YouTube 字幕那一个接口，
   留着等于多一个要防护、要限流、要解释的面。
3. **下游的窄钥匙**：为了「不要把运维钥匙给下游」而生的 `TRANCY_API_TOKEN`，
   Access Service Token（`CF-Access-Client-Id` / `CF-Access-Client-Secret`）本来就能干这件事，
   而且是在真正的那层做。

## Decision

**鉴权只剩一层：Cloudflare Access。** Worker 内不再有 `ADMIN_TOKEN`、`CF_ACCESS_TRUSTED`、
`TRANCY_API_TOKEN`、`writeMode`、`requireAdmin`、`requireTrancyClient`，`src/utils/admin.js` 删除。

由此带来的三条连带规则：

- `GET /api/trancy/accounts` **原样返回明文密码**（之前「只有通过写权限校验才回密码」的收口一并删掉），
  因为「能穿过 Access」现在已经等于「是运维本人」。
- `POST /api/trancy/captions` 与账号管理接口同样不做应用层校验；能穿过 Access 就放行。
- `src/routes/providers.js` 的 `PUT` 也不再校验，`GET /api/providers` 不再回 `writable` / `writeMode`，
  前端那套「只读提示」状态（`provider.readOnly` 文案）随之删除。

**relay 删除。** `handleRelay`、`relayTargetError`、`relayTrancyRequest`、路径白名单常量、
`X-Trancy-Email` 透传、`pickTrancyAccount`（只服务 relay 的 LRU 选择）全部移除。
git 里能找回，真需要调试某个 api.trancy.org 接口时，用 `wrangler tail` 或直接 curl 更快。

**下游只需要 videoId。** `POST /api/trancy/captions` 的 `target` 一直是可选的（默认 `en`），
这次把它在文档和测试里固定下来：`{"videoId":"npka43hwNo"}` 就够了。

## Alternatives considered

- **保留 `ADMIN_TOKEN` 作为 Access 之外的口令**：等于假设 Access 可能配错，于是把「配错时还能挡住」
  的责任放在应用里。但同一个口令也会泄漏在浏览器、README 示例和下游配置里，防护半径并不比 Access 小；
  而且两套凭证同时存在时，没人能说清哪次请求是谁放的。
- **保留 relay，但只允许字幕路径**：白名单要跟着上游改，一旦漏一条就变成「能花钱的代理」；
  而字幕已经有专用入口（额度、缓存、202、503 都调好了），通用代理没有存在理由。
- **保留 `TRANCY_API_TOKEN` 而不教大家用 Access Service Token**：多一个密钥要轮换、要和 Access 策略对齐；
  而 Service Token 是 Access 自带的能力，签发、吊销、审计都在同一处。
- **把密码改成「只有 GET 带特殊头才返回」**：在没有应用层鉴权的世界里，任何「特殊头」都不是秘密，
  只会制造「为什么这里能看那里不能看」的困惑；要收口就应该在 Access 层收（`/api/*` 的策略）。

## Consequences

- **部署前必须给 `/api/*` 配 Access 策略**，否则 Worker 会把明文密码、账号操作、额度消耗全部公开。
  README 和 `.dev.vars.example` 都把这条写成了前置条件；`wrangler dev --local` 没有 Access，
  本地一切可访问（仅自己机器，可接受）。
- 下游如果原本用 `Authorization: Bearer $TRANCY_API_TOKEN`，需要改成 Access Service Token 的两个头。
- 删掉 `writable` / `writeMode` / `provider.readOnly` 之后，页面不再有「只读模式」这种状态：
  访问不到就是 Access 挡在门口，而不是页面里显示一行提示。
- `pickTrancyAccount` 随 relay 一起消失，账号选择现在只有 `pickCaptionAccounts`
  （按每日额度排序），逻辑更单一。
- 净减：一个模块（`src/utils/admin.js`）、relay 全套（约 120 行）、两套 token 变量、
  一个前端状态分支和两条 i18n 文案。

## Testing

- `scripts/verify-provider-secrets.mjs`：删掉 401 / 403 / `write_not_configured` /
  `CF_ACCESS_TRUSTED` 的用例，改为断言「没有 `writable` / `writeMode` 字段」以及
  「不带任何凭据的 PUT 也返回 200」（本地/测试环境没有 Access）。
- `scripts/verify-trancy-gateway.mjs`：删掉 401 断言、relay 的 404/路径校验用例、
  下游窄钥匙用例；保留 202 待定契约，并新增「只传 videoId 也能通过校验」。
- `scripts/verify-code-hygiene.mjs`：从「前端必须体现 write mode」翻转为「前端不得再出现
  `writeMode` / `payload.writable` / `provider.readOnly`」。
- `scripts/verify-readme.mjs`：新增「README 不得出现 `ADMIN_TOKEN`」。
- 真机：`POST /api/trancy/accounts/login` 走 Access 之外的本地环境仍返回 201；
  `GET /api/trancy/accounts` 直接带出密码；`POST /api/trancy/captions {"videoId":...}`
  返回 108 句；`POST /api/trancy/relay` 现在 404。
