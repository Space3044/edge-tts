# Agent Note: 接入 Groq Whisper 转录引擎

Status: implemented

## Problem

语音转文字已经有 OpenAI 兼容、ElevenLabs 和 Google 三个引擎，但希望增加 Groq 托管的 Whisper 服务。Groq 的转录接口使用 OpenAI 兼容的 multipart `/audio/transcriptions` 协议，不过它有独立的 endpoint、模型、API Key 和 25MB 单文件上限，不能只在前端加一个按钮后把请求继续当作 OpenAI 默认配置处理。

## Decision

把 Groq 作为独立的 `groq` engine/provider 暴露给页面和 API，但复用现有 OpenAI 兼容转录适配器：

- 默认 endpoint 为 `https://api.groq.com/openai/v1`，默认模型为 `whisper-large-v3-turbo`。
- API Key 与其他 provider 一样由 D1 的 `provider_config` 保存，使用现有 `SECRETS_ENCRYPTION_KEY` 加密；Groq 没有密钥时在 Worker 发出上游请求前返回 `groq_not_configured`。
- `POST /v1/audio/transcriptions` 接受 `engine=groq`；上传文件时 Worker 转发文件，URL 模式只做公开地址校验，并将 URL 作为 Groq multipart 的 `url` 字段直接转发。
- Groq 复用 OpenAI 的 `language`、`prompt`、`temperature` 和 `timestamps` 字段，并默认请求 `response_format=verbose_json` 与词级时间戳，响应统一为 `{text, sentences, words}`。
- Groq 的上游限制在 Worker 侧收窄为 25MB；OpenAI / Google 保持原有 50MB，ElevenLabs URL 模式仍由 ElevenLabs 自己处理大小限制。
- 页面新增 Groq engine tab、Provider settings 卡片和八种语言的标签；Groq 与 OpenAI 共享兼容参数控件，但使用各自的 provider 配置和 API Key。
- 不新增数据库迁移：`provider_config.provider` 是文本主键，新增默认配置和 provider 枚举即可让现有 D1 直接支持新行。

## Alternatives considered

- **只让用户把 Groq endpoint 填进 OpenAI provider**：接口层面可工作，但无法在 UI 中区分密钥、模型和额度限制，也不能在 Groq 缺 Key 时给出准确错误；因此保留独立 provider。
- **新建一个完全独立的 Groq STT 模块**：可把 Groq 名称隔离得更清楚，但会复制文件下载、参数校验、verbose JSON 解析和时间戳归一化；Groq 当前遵循同一协议，复用适配器能避免两套行为漂移。
- **继续接受 50MB 并交给 Groq 返回 413**：实现更少，但用户只能看到泛化的上游错误，也会浪费一次请求；因此在 Worker 入口按 provider 使用 25MB 上限。
- **把 Groq 的 API Key 放到环境变量**：部署侧简单，但与现有多设备 Provider settings 和 D1 加密契约不一致；继续只从 D1 读取。

## Consequences

- API 新增 `engine=groq`，旧的 `openai` / `whisper`、ElevenLabs 和 Google 请求行为不变。
- Provider settings GET 现在返回四个 provider，旧 D1 不需要迁移；首次使用 Groq 时在页面保存 endpoint、模型和 `gsk_...` API Key 即可。
- Groq 和 OpenAI 共享兼容参数的 localStorage 控件，所以两者的语言、提示词、温度和时间戳开关会使用同一组浏览器偏好；密钥不会进入浏览器存储。
- Groq 上游拒绝 `verbose_json` 时仍使用现有一次性 `json` fallback，缓存键改为 provider + model，避免 OpenAI 和 Groq 使用同名模型时互相污染能力探测结果。
- 前端引擎 tab 从三列扩为四列，窄屏降为两列；Provider 卡片改用自适应列布局。

## Testing

- `scripts/verify-groq-stt.mjs` 验证默认 Groq URL、Bearer API Key、默认模型、语言/提示词/温度、verbose JSON、词级时间戳归一化、URL 直接转发且 Worker 不下载，以及缺少 API Key 时不上游。
- `scripts/verify-provider-secrets.mjs` 验证 provider 列表现在包含 Groq 和默认 endpoint/model。
- `scripts/verify-code-hygiene.mjs`、`scripts/verify-frontend-redesign.mjs` 和 `scripts/verify-readme.mjs` 验证路由、UI、翻译和文档契约。
- 既有 `verify-transcription-format.mjs`、`verify-transcription-url.mjs`、`verify-elevenlabs-stt.mjs`、`verify-google-stt.mjs` 继续通过，确认共享适配器改动没有破坏现有引擎。
