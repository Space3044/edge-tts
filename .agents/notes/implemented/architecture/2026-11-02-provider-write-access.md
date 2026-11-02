# Agent Note: Provider writes are gated by environment, not by one password

Status: implemented

> 已被 [收窄网关：鉴权只留 Cloudflare Access](../../simplification/2026-11-02-access-only-auth-and-drop-relay.md)
> 取代：`ADMIN_TOKEN` / `CF_ACCESS_TRUSTED` / `writeMode` 全部删除，鉴权只在 Access 那一层。
> 本文保留的是当时为什么需要这些开关的推理（含被否决的方案）。

## Problem

[加密的 provider 配置](2026-11-02-encrypted-provider-secrets.md) 最初规定：写 `/api/providers/*` 必须带 `ADMIN_TOKEN`，没配就一律 403。落到实际运维上是错的：

- 开发环境（`wrangler dev`）本来就不该再配一个口令、再在页面里手输一次；
- 生产环境已经用 Cloudflare Access 保护 `/api/*`，再叠一层应用内口令是重复劳动，而且口令还是得在浏览器里敲一遍。

## Decision

写权限按环境判定，三种来源，优先级从高到低：

1. **`ADMIN_TOKEN` 已配置** → 任何主机都要求 `Authorization: Bearer <ADMIN_TOKEN>`（常量时间比较），401 `invalid_admin_token`。这是没有 Access 时的兜底方案。
2. **`CF_ACCESS_TRUSTED=1`** → 信任边缘鉴权：Worker 不再校验口令，靠 Cloudflare Access 挡在 `/api/*` 前面。
3. **请求来自本地开发主机**（`localhost`、`127.0.0.1`、`*.localhost`、`*.local`、`127.0.0.0/8`）→ 直接放行。

三者都不满足 → `403 write_not_configured`，并提示两种解决办法。**不会**因为「没配置」就默认放开：未保护的公网部署仍然不可写。

`GET /api/providers` 返回 `writeMode`（`admin-token` / `cloudflare-access` / `local-dev` / `locked`）和 `writable`，设置面板据此显示只读提示。

前端不再保存任何写权限凭据：删掉了 `sessionStorage` 里的 `voicecraft-admin-token` 和保存时的 `window.prompt`，只按服务器返回的状态渲染。

## Alternatives considered

- **保持 `ADMIN_TOKEN` 必填**：最省事的实现，但开发环境每次都要手输，生产环境叠在 Access 上没有任何安全增益。
- **直接删除校验、完全交给 Access**：只对「已经用 Access 保护、且 Worker 没有别的入口」成立。`*.workers.dev` 之类的直连入口若没被策略覆盖，任何人都能改密钥。判断请求是否真的经过了 Access 需要验证 `Cf-Access-Jwt-Assertion` 的签名，成本远高于设置一个 `CF_ACCESS_TRUSTED=1` 开关。
- **只用本地主机名判断，不提供 Access 开关**：生产环境就只能回到 `ADMIN_TOKEN`，与运维现状冲突。
- **用微软 OAuth 的身份当管理员**：把 OpenAI/Google 的配置写权限绑到微软账号上，语义混乱（还没接微软引擎的人根本不需要登录），也把两个功能的生命周期耦合在一起。

## Consequences

- 开发环境零配置：`wrangler dev` 起来就能保存配置，页面不再弹口令。
- 生产环境必须显式二选一（`CF_ACCESS_TRUSTED=1` 或 `ADMIN_TOKEN`），否则写接口 403 且面板只读——把「忘了保护」变成可见的失败，而不是静默敞开。
- `CF_ACCESS_TRUSTED=1` 的语义是「我相信 `/api/*` 只有 Access 之后才能到达」。如果 Worker 有未被策略覆盖的入口（`workers.dev` 子域、自定义域名、`pages.dev` preview），必须先在 Access 里补上，否则等于没有防护。这条约束写进了 README。
- 主机名判断依赖请求 URL；Workers 里 `request.url` 就是客户端访问的地址，`Host` 头被改写的场景（例如某些代理）会把本地判定打偏，但只会更严格地要求口令，不会误放行。
- 前端少了一个交互和一个存储项，`provider.readOnly` 文案改为说明两种解锁方式。

## Testing

`scripts/verify-provider-secrets.mjs` 覆盖四种模式：`ADMIN_TOKEN` 下匿名 401、错误 token 401、正确 token 200；无配置的公网主机 403 `write_not_configured` 且不写 D1；`http://127.0.0.1` 主机直接 200 且 `writeMode=local-dev`；`CF_ACCESS_TRUSTED=1` 时公网主机 200。`scripts/verify-code-hygiene.mjs` 反查前端不得再出现 `ADMIN_TOKEN` / `readAdminToken`，避免口令存储偷偷回归。
