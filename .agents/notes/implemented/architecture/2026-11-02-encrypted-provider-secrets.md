# Agent Note: Encrypted provider secrets in D1

Status: implemented

## Problem

转录服务（OpenAI 兼容 / ElevenLabs / Google）的 endpoint、模型和密钥只有两种存放方式：写死在代码里，或者放在浏览器 `localStorage`。前者不灵活，后者意味着密钥跟着每个浏览器走，且自建 Whisper 只支持填地址、没有模型和密钥。需要一种「运维在页面里配置一次，所有设备共用，密钥不落明文」的做法。

## Decision

服务配置存进 D1 的 `provider_config` 表，API Key 用 `SECRETS_ENCRYPTION_KEY` 做 AES-256-GCM 加密后落库。

Schema（`migrations/0001_provider_config.sql`）：

```sql
CREATE TABLE provider_config (
    provider TEXT PRIMARY KEY,      -- 'openai' | 'elevenlabs' | 'google'
    endpoint TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    api_key_cipher TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
);
```

`endpoint` 和 `model` 明文存，因为界面要回显；只有 API Key 是敏感数据，存密文。空字符串表示「这一行没有密钥」，不用 NULL，避免三值判断扩散到每一层。

Microsoft 的接入让同一张表多了三列（`migrations/0002_microsoft_oauth.sql`）：`region`（拼 Azure 端点）、`refresh_token_cipher`（OAuth 刷新令牌，AAD 为 `microsoft:refresh_token`）、`token_updated_at`。复用 `api_key_cipher` 会造成两种语义混在一列，所以宁可加列。

加密信封格式是 `v1.<iv_b64>.<ciphertext_b64>`：

- 每次写入生成新的 12 字节 IV，不重用；
- AAD 使用 provider 名，密文被拷到别的 provider 行会解密失败；
- `v1` 前缀留给将来换算法，换算法不需要数据迁移；
- 解密只在 Worker 内发生，`GET /api/providers` 只返回 `configured`、`keySource`（`db` / `env` / `none`）和 `keyTail`（`••••a1b2`）。密钥是只写的：留空表示保留，`clearApiKey: true` 才清空。

解析顺序固定为 **D1 行 → 环境变量 → 内置默认**（`src/secrets/store.js` 的 `resolveProvider`）。环境变量名字是 `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` / `GEMINI_API_KEY`|`GOOGLE_API_KEY`。这样已有的线上部署（只配了 `GEMINI_API_KEY`）不需要任何迁移就能继续跑，而页面里配置过的值总是赢。

写接口的鉴权模型后来按环境重做过，见 [provider writes are gated by environment](2026-11-02-provider-write-access.md)：本地开发直接放行，`CF_ACCESS_TRUSTED=1` 表示信任 Cloudflare Access，其余情况才需要 `Authorization: Bearer $ADMIN_TOKEN`。

第四个引擎 `microsoft`（Azure AI Speech）不用 API Key，而用 **Entra ID 授权码流程**：`POST /api/providers/microsoft/login` 返回 authorize URL（scope `https://cognitiveservices.azure.com/.default offline_access`，PKCE + state 放在 HttpOnly cookie 里），`GET /api/microsoft/callback` 用 code 换 token，只把 refresh token 用 `microsoft:refresh_token` 作为 AAD 加密存进 D1；access token 每次转录时现换、不落库，轮换回来的新 refresh token 会覆盖旧的。转录调 Azure Fast transcription（`/speechtotext/transcriptions:transcribe?api-version=2024-11-15`），音频仍是普通 multipart，没有 base64、没有会话。

之所以选 OAuth 而不是订阅密钥：凭据可以随时在页面上断开（清掉 D1 里的 refresh token），不产生长期有效的静态密钥；代价是依赖 Entra 应用注册和 Speech 资源的 RBAC 角色，refresh token 过期（confidential client 90 天滑动）时要重新登录一次，接口用 `microsoft_login_required` 明示。

引擎层面把 `whisper` 改名为 `openai`，走标准 OpenAI 兼容协议：`{endpoint}/audio/transcriptions`，multipart 传 `file`、`model`、`response_format=json`，配了密钥就带 `Authorization: Bearer`。base 不带 `/audio/transcriptions` 时自动补全，因此 `https://api.openai.com/v1` 和自建 `https://asr.example.com/v1` 都能用。`engine=whisper` 保留为 `openai` 的别名，老调用方不用改。

三个引擎的 endpoint 都是可配置的：OpenAI 补 `/audio/transcriptions`，Google 用它拼出 Files API（`{endpoint}/upload/v1beta/files`）和 Interactions API（`{endpoint}/v1beta/interactions`），带 `/v1beta` 的 base 会被归一化，所以指向自建网关也能用。

单次请求仍可覆盖 `endpoint` / `model` / `apiKey`（`apiKey` 仅 OpenAI 引擎），供 API 用户临时测试。

## Alternatives considered

- **通用 KV 表 `settings(key, value_cipher)`**：扩展性更好，但读一次要拼装、类型全靠字符串约定，且 UI 回显 endpoint/model 时要先解密。三列固定结构换来的是「哪些字段可用」一目了然。
- **整行加密**：安全收益接近零（endpoint/model 本来就不是机密），代价是界面每次回显都要解密、状态接口也要放宽到返回明文才能编辑。
- **管理员可读回明文（"查看密钥"按钮）**：实现简单，但把「只写」变成「可读」，XSS 或代理日志都能拿到明文；用掩码尾巴足以确认是哪把密钥。
- **只依赖 Cloudflare Access 保护 `/api/*`**：Access 是可选部署项，本地开发和小规模自托管经常不开；`ADMIN_TOKEN` 是应用内的一道独立防线，两者可以叠加。
- **保留 `whisper-asr-webservice` 的 `/asr?output=json&task=transcribe` 协议，只改名字**：能少写一个适配器，但就没有模型和密钥的位置，等于没解决需求。该项目的 OpenAI 兼容端点同样可用，所以统一到 `/audio/transcriptions`。
- **更换 `SECRETS_ENCRYPTION_KEY` 时自动重加密**：需要在同一个请求里枚举并重写所有行，还要处理并发与失败回滚，收益不抵复杂度。现在的做法是解密失败时返回 `keyError`，界面提示重新保存。
- **把密钥放进 `wrangler.toml` 的 `[vars]`**：会进 git；`wrangler secret` 是部署侧的事，但「页面里改一次、多设备生效」这个需求它满足不了。

## Consequences

- 项目从「无状态、不需要存储」变成「依赖 D1 binding」。没有 `DB` binding 时读写都失败，但请求路径仍然工作（`hasDatabase` 返回空行，`resolveProvider` 退回环境变量/默认值），所以只配环境变量的旧部署不会挂。
- `SECRETS_ENCRYPTION_KEY` 丢失或更换会让已保存的密钥不可解密；`provider_config.api_key_cipher` 保留旧密文，`listProviderStatus` 通过 `keyError` 暴露这件事，运维在页面上重填即可。
- `ADMIN_TOKEN` 一旦泄露等于可以覆写所有 provider 的密钥。它和 `SECRETS_ENCRYPTION_KEY` 必须是两个独立的值：前者鉴权，后者加解密，泄露前者拿不到已存的明文（需要 D1 读权限才能试）。
- 前端多了一次 `GET /api/providers` 拉取和一段 `prompt()` 交互；换来的是密钥不再跟浏览器绑定，换设备/清缓存都不影响。
- 密钥是只写的，所以「我上次填的是哪把 key」只能靠 `keyTail` 4 位判断。这个限制是有意的。
- 私网/本机地址仍然被 `normalizeSourceUrl` 拒绝，但 `endpoint` 覆盖参数允许指向任意公网地址——与改动前一致（改前由前端填 endpoint），不是这次引入的新面。回滚点：把 `engine` 分发改回 `whisper` 分支、删掉 `src/secrets/` 与 `/api/providers` 路由即可，D1 表留着不影响旧代码。

## Testing

`node scripts/verify-provider-secrets.mjs` 覆盖：加密信封往返、AAD 与换密钥导致的解密失败、掩码、写入后 D1 行内无明文、状态接口不泄露明文、空 key 保留/`clearApiKey` 清空、环境变量回落与 D1 优先级、缺失 `SECRETS_ENCRYPTION_KEY` 时写失败、损坏密文降级为 `keyError`、路由鉴权（匿名 401 / 错误 token 401 / 未配 `ADMIN_TOKEN` 403 / 正确 token 200）、非法 endpoint 与未知 provider。

`scripts/verify-microsoft-stt.mjs` 覆盖 OAuth 授权 URL、code/refresh 交换、endpoint 推导、Fast transcription 的请求形状与毫秒→秒映射、refresh token 轮换落库、login/logout 的鉴权与未配置分支。`scripts/verify-transcription-format.mjs` 覆盖 OpenAI 引擎的字段转发、`engine=whisper` 别名和 base URL 补全；`verify-transcription-url.mjs` 覆盖三个引擎的 URL 模式；`verify-code-hygiene.mjs` 额外断言「注入的客户端脚本必须能通过语法解析」——之前一次性改坏 `client.js` 的括号时，只有浏览器控制台能发现。
