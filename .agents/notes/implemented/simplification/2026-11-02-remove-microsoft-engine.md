# Agent Note: Remove the Microsoft transcription engine

Status: implemented

## Problem

Microsoft（Azure AI Speech）这条渠道一直没找到可持续的落点，试过的三条路都不成立：

1. **订阅密钥 / access token**：功能已经写完并跑通（Fast transcription，词级时间戳、说话人都在），但需要 Azure 订阅并绑定银行卡。这条对当前使用者直接不可行。
2. **Entra ID 授权码回调**：需要注册自己的应用、配 redirect URI、给应用加 Speech 权限；个人账号走 proxy 时微软还直接拒绝。成本远高于收益，先被换成了「粘贴 token」。
3. **Playground cookie**（模仿 mai2srt）：免费、可用，实测也能正确转出中文词级时间戳，但会话是短命的 `AppServiceAuthSession`，续期只能靠微软域/`live.com` 的长期身份 cookie + 一串 JS 跳转。个人账号（hotmail/outlook）实测在 `login.microsoftonline.com` 的 `prompt=none` 上直接返回 `Redirecting → /error.aspx?err=504`，服务端无法完成静默续期，只能人工重贴。

结论：为了让这个渠道「能用」，需要使用者定期手工维护凭据，成本落在用户身上，而收益只是多一个引擎。

## Decision

把 Microsoft 引擎整个摘掉：

- 删除 `src/microsoft/`（playground、cookies、oauth、stt 四个模块）与 `scripts/verify-microsoft-stt.mjs`、`scripts/check-microsoft-oauth.mjs`。
- `PROVIDERS` 回到 `openai` / `elevenlabs` / `google`；provider 设置面板回到三个卡片，引擎切换条回到 2×2 之前的布局（3 个引擎）。
- `migrations/0005_drop_microsoft_columns.sql` 删除只为它存在的六列：`region`、`refresh_token_cipher`、`token_updated_at`、`access_token_cipher`、`access_token_expires_at`、`cookie_cipher`。
- 删除 `scheduled` 处理器（它只是微软会话的探活）与对应的 cron 注释。
- 转录接口对未知引擎返回 `400 unknown_engine`：**这是本次新增的行为**。摘掉 `microsoft` 分支后，如果不加这道判断，`engine=microsoft` 会落到默认分支被当成 OpenAI 处理，等于把音频发给错误的服务。

## Alternatives considered

- **保留 Azure 路线并默认隐藏**：代码已经能跑，只是当前使用者没有订阅。留着的话面板里会出现一个永远填不了的卡片，还要维护 token/续期/audience 判断这一整套逻辑和一个专门的验证脚本；等真有需求时按这篇的 diff 反向恢复即可，成本不比维护低。
- **保留 Playground 路线 + 手动重贴**：能满足「免费」，但每次会话过期都要人去登录、复制 cookie，等于把一个持续的人工步骤塞进产品里；而且它依赖对方的内部协议，随时可能失效。
- **只留订阅密钥、删掉 token/playground**：仍然需要 Azure 订阅和绑卡，对当前使用者没有区别，只是少删一些代码。
- **保留列不删（只删代码）**：数据层干净一点能省掉一个迁移，但六列死字段会让后来的人以为还有 Microsoft 支持，减法的收益不抵一次 `DROP COLUMN`。

## Consequences

- 引擎从四个回到三个；`engine=microsoft` 从「能用」变成 `400 unknown_engine`，明确失败而不是静默走 OpenAI。
- 已存过的 Microsoft 凭据随迁移一起删除（本地与远端都会在下一次 `d1 migrations apply` 时执行）。如果哪天真要恢复，凭据需要重新录入。
- 少了一个会持续需要人工介入的维护面：不再有「cookie 过期了怎么办」这个问题。
- 代码量净减：四个模块 + 两个脚本 + 面板字段 + 一组翻译 key + 一个迁移新增的列。
- 恢复路径很明确：`git revert` 这一批改动 + 新增一个把列加回来的迁移；架构笔记
  [加密的 provider 配置](2026-11-02-encrypted-provider-secrets.md) 里保留了当时 Microsoft 接入的设计描述（含被否决的方案），可以作为参考。

## Testing

`scripts/verify-transcription-format.mjs` 现在断言 `engine=microsoft` 返回 `400 unknown_engine`；`verify-provider-secrets.mjs` 断言 `/api/providers` 只返回三个 provider 且保存语句仍绑定五个参数；`verify-frontend-redesign.mjs` 不再要求 Microsoft 的标签/卡片标记。
