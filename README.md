# VoiceCraft

VoiceCraft 是一个运行在 Cloudflare Workers 上的语音工作台，提供文字转语音、SSML 生成、文件输入、语音转文字和文本 AI 润色。

在线示例：

```text
https://edge-tts.onfoyo.de5.net/
```

仓库地址：

```text
https://github.com/Space3044/edge-tts
```

## 功能

- 文字转语音：输入文本、上传 `.txt` 文件，或直接提交 SSML。
- 声音库：内置 114 个 Microsoft Edge TTS 声音，支持按语言、性别、名称、地区和 voice ID 搜索；每行右侧的播放按钮可以直接试听（用该音色自己的语言说一句，结果按音色缓存）。
- 参数调节：支持语速、音调和语音风格，语速和音调可双击恢复默认值。
- 生成结果：生成后的 MP3 可在线播放和下载。
- 语音转文字：上传音频或粘贴公开音频 URL，可使用 OpenAI 兼容转录接口、ElevenLabs Scribe 或 Google Gemini Transcribe；三家都能给出句子级时间戳，词级时间戳见各引擎说明。
- AI 润色：调用 OpenAI 兼容接口润色输入文本。
- 服务配置：转录服务的 endpoint、模型和 API Key 在页面里设置，API Key 用 `SECRETS_ENCRYPTION_KEY` 加密后存进 D1；页面只显示掩码尾巴，不回传明文。
- 浏览器本地保存：AI 润色的 Base URL、API Key、模型和润色指令只保存在当前浏览器本地。
- Trancy 多账号网关：单独一个 Gateway 标签页管理多个 Trancy 账号，支持**邮箱密码登录 / 注册 / 粘贴 token** 三种添加方式；token 和密码都加密存进 D1（密码只在你点「Show」或重新登录时才解密），Cloudflare cron 每天调 `/1/user/profile` 自动续期，转发接口按最近最少使用轮换账号并自动摘掉失效 token。
- YouTube 字幕调度：`POST /api/trancy/captions` 按账号的每日 AI 字幕额度（免费号 5 个视频/天）挑账号生成字幕并直接返回，额度耗尽的账号停泊到次日 UTC 零点；网关不保存结果。
- 多语言界面：支持中文、英文、日文、韩文、西班牙文、法文、德文、俄文。

## 项目结构

```text
.
├── index.js                         # Cloudflare Worker 入口
├── src/
│   ├── worker.js                    # 路由分发
│   ├── routes/                      # speech、transcriptions、polish、providers、trancy、favicon
│   ├── edge/                        # Edge TTS 端点、签名、SSML、合成逻辑
│   ├── secrets/                     # API Key 加解密（AES-GCM）与 D1 配置读写
│   ├── trancy/                      # Trancy token 解析、账号存取、字幕额度调度、上游调用
│   ├── frontend/                    # 页面、样式、客户端脚本、声音库、多语言、favicon
│   └── utils/                       # CORS、文本切分等工具
├── schema.sql                       # 从零建库的完整 DDL（等价于跑完所有迁移）
├── migrations/                      # D1 迁移（provider_config、trancy_account 两张表）
├── scripts/                         # 验证脚本
├── docs/                            # 设计和实现说明
├── wrangler.toml                    # Cloudflare Workers 配置
├── LICENSE
└── README.md
```

## 本地运行

项目没有 `package.json`。本地调试需要 Node.js 和 Wrangler。

首次运行前要先建本地 D1 并写好 `.dev.vars`：

```bash
cp .dev.vars.example .dev.vars        # 填入 SECRETS_ENCRYPTION_KEY
npx wrangler d1 migrations apply voicecraft --local
npx wrangler dev index.js --local --port 8787
```

`SECRETS_ENCRYPTION_KEY` 必须是 base64 的 32 字节随机值，可以这样生成：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

启动后访问：

```text
http://127.0.0.1:8787
http://127.0.0.1:8787/tts
http://127.0.0.1:8787/transcription
```

Windows 上如果 Wrangler 写入 npm 或配置目录遇到权限问题，可以临时指定缓存目录：

```powershell
$env:npm_config_cache="$env:TEMP/edge-tts-npm-cache"
$env:XDG_CONFIG_HOME="$env:TEMP/edge-tts-xdg-config"
npx --yes wrangler dev index.js --local --port 8787
```

## Cloudflare 控制台部署

适合手动部署。

1. 登录 Cloudflare 控制台。
2. 进入 `Workers & Pages`。
3. 创建 Worker。
4. 打开在线编辑器。
5. 将 `index.js` 作为入口文件，连同 `src/` 目录中的模块一起部署。
6. 保存并部署。

如果使用 Git 仓库导入，入口文件保持为：

```text
index.js
```

### D1 与密钥

转录服务的配置存放在 D1 的 `provider_config` 表，API Key 先用 AES-256-GCM 加密再落库：

```bash
npx wrangler d1 create voicecraft
# 把输出的 database_id 填进 wrangler.toml（默认、production、staging 三处）
npx wrangler d1 migrations apply voicecraft --remote
```

如果不想走迁移链，仓库根目录有一份合并好的完整建表语句 `schema.sql`（等价于跑完 `0001`..`0007`，无注释、无历史包袱），可以直接粘进 D1 控制台的 SQL 编辑器，或者：

```bash
npx wrangler d1 execute voicecraft --remote --file=schema.sql
```

它只建表，不写 `d1_migrations`，所以**两种方式只能选一种**：用 `schema.sql` 建好的库不要再对它跑 `wrangler d1 migrations apply`（`0007` 会报 `duplicate column name: quota_limit`）。若之后想切回 wrangler 管版本，先补上迁移账本：

```sql
CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0001_provider_config.sql'),('0002_microsoft_oauth.sql'),('0003_microsoft_access_token.sql'),('0004_microsoft_playground_cookie.sql'),('0005_drop_microsoft_columns.sql'),('0006_trancy_account.sql'),('0007_trancy_captions.sql');
```

已有数据的库不要跑 `schema.sql`，用 `migrations apply` 走增量。

npx wrangler secret put SECRETS_ENCRYPTION_KEY   # base64 的 32 字节
# 不需要任何鉴权密钥：/api/* 交给 Cloudflare Access
```

- `SECRETS_ENCRYPTION_KEY` 是唯一的 secret：只用于加解密，不参与鉴权；换掉它会导致已保存的密钥和 Trancy token 无法解密，需要重新填写。
- **鉴权全部交给 Cloudflare Access**：Worker 自己不校验任何 token。`/api/*` 必须挂 Access 策略（见下一节），因为 `GET /api/trancy/accounts/:id/password` 能解出密码、`POST /api/trancy/captions` 会花账号额度。裸部署到公网等于把这些直接暴露出去。
- 除密钥外的变量都不写入仓库，`wrangler.toml` 里也不出现明文。

## Cloudflare Access

**这是本项目唯一的鉴权层。** 在 Cloudflare Zero Trust 里为 Worker 域名添加 Access Application，路径至少覆盖全部 API：

```text
/api/*
```

再按需要收窄页面：如果只想公开文字转语音、把语音转文字藏起来，可以改成：

```text
/transcription*
/v1/audio/transcriptions*
```

这样文字转语音页面 `/tts` 可以公开访问，语音转文字页面和转录接口会先经过 Cloudflare Access 登录。若整个工具只给自己使用，也可以直接保护 `/*`。

## API

下游能用到的接口一览（`/api/*` 全部由 Cloudflare Access 保护，Worker 自身不校验 token）：

| 接口 | 用途 | 计费/成本 |
| --- | --- | --- |
| `POST /v1/audio/speech` | 文字转语音，返回 MP3 | Edge TTS 免费 |
| `POST /v1/audio/transcriptions` | 语音转文字，`engine=openai\|elevenlabs\|google` | 按各 provider 的 key 计费 |
| `POST /v1/text/polish` | 文本润色（透传 OpenAI 兼容接口） | 调用方自己的 key |
| `POST /api/trancy/captions` | 用账号池生成 YouTube AI 字幕 | **每天每账号 5 个视频额度**，见下文 |
| `GET /api/providers` | 读转录服务配置（只回掩码尾巴） | 无 |
| `PUT /api/providers/:provider` | 写转录服务配置 | 无 |
| `/api/trancy/accounts*` | 账号池管理（增删改、登录、刷新） | 无（面板用） |

页面路由：`/tts`、`/transcription`、`/trancy`。

### 文字转语音

接口：

```text
POST /v1/audio/speech
```

JSON 请求示例：

```bash
curl -X POST "https://your-worker.example.com/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "你好，这是一个语音生成测试。",
    "voice": "zh-CN-XiaoxiaoNeural",
    "speed": 1,
    "pitch": "0",
    "volume": "0",
    "style": "general"
  }' \
  --output speech.mp3
```

SSML 请求示例：

```bash
curl -X POST "https://your-worker.example.com/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -d '{
    "inputType": "ssml",
    "input": "<speak version=\"1.0\" xml:lang=\"zh-CN\"><voice name=\"zh-CN-XiaoxiaoNeural\">你好</voice></speak>"
  }' \
  --output speech.mp3
```

上传 `.txt` 文件：

```bash
curl -X POST "https://your-worker.example.com/v1/audio/speech" \
  -F "file=@input.txt" \
  -F "voice=zh-CN-XiaoxiaoNeural" \
  -F "speed=1" \
  -F "pitch=0" \
  -F "style=general" \
  --output speech.mp3
```

参数说明：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `input` | string | JSON 模式必填 | - | 要转换的文本或完整 SSML |
| `inputType` | string | 否 | `text` | 传 `ssml` 时按 SSML 处理 |
| `file` | File | 表单模式必填 | - | `.txt` 文本文件，最大 500KB |
| `voice` | string | 否 | `zh-CN-XiaoxiaoNeural` | Edge TTS voice ID |
| `speed` | number | 否 | `1` | 语速，前端范围为 `0.5` 到 `2` |
| `pitch` | string | 否 | `0` | 音调，前端范围为 `-50` 到 `50` |
| `volume` | string | 否 | `0` | 音量，API 保留参数 |
| `style` | string | 否 | `general` | 语音风格 |

常用中文声音：

```text
zh-CN-XiaoxiaoNeural
zh-CN-XiaoyiNeural
zh-CN-YunjianNeural
zh-CN-YunxiNeural
zh-CN-YunyangNeural
```

完整声音列表在前端 Voice Library 中选择，验证脚本会确认当前共有 114 个声音。

### 语音转文字

接口：

```text
POST /v1/audio/transcriptions
```

当前实现支持三种转录引擎：`openai`（OpenAI 兼容的 `/audio/transcriptions`）、`elevenlabs` 和 `google`。三个引擎的 endpoint、模型和 API Key 都在页面里的 Provider settings 中配置，保存在 D1 的 `provider_config` 表；API Key 用 `SECRETS_ENCRYPTION_KEY` 加密后落库，接口只会返回掩码尾巴。

解析顺序是「D1 里保存的值 → 内置默认值」：**密钥只有一个来源，就是 D1**（面板里保存，用 `SECRETS_ENCRYPTION_KEY` 加密）。没有环境变量兜底，所以「现在用的是哪把 key」永远只有一个答案。`engine=whisper` 仍然保留为 `openai` 的别名，老调用方不需要改。

ElevenLabs 调用的是 Scribe Speech-to-Text 接口：

```text
https://api.elevenlabs.io/v1/speech-to-text
```

ElevenLabs 默认模型是 `scribe_v2`（可在 Provider settings 里改）。配置了 API Key 时请求带 `xi-api-key`；没有配置时沿用匿名 Scribe 请求。词级时间戳来自 ElevenLabs 返回的 `words[]`；句子时间戳由后端按词级结果和句末标点聚合生成。

Google 的 endpoint、模型和密钥同样在 Provider settings 里配置：endpoint 默认 `https://generativelanguage.googleapis.com`，可以指向自建网关（例如 `https://gateway.example.com/gemini`，带 `/v1beta` 的写法也接受），Worker 会据此拼出 Files API（`{endpoint}/upload/v1beta/files`）和 Interactions API（`{endpoint}/v1beta/interactions`）。默认模型是 `gemini-3.5-transcribe`。音频由 Worker 下载（或接收上传）后传到 Gemini Files API，再调用 Interactions API；词级时间戳来自返回的 `word_info` 注解，句子时间戳同样在本地聚合。密钥只从 D1 读（面板里保存的那一份）：


ElevenLabs 调用的是 Scribe Speech-to-Text 接口：

```text
https://api.elevenlabs.io/v1/speech-to-text
```

ElevenLabs 默认模型是 `scribe_v2`（可在 Provider settings 里改）。配置了 API Key 时请求带 `xi-api-key`；没有配置时沿用匿名 Scribe 请求。词级时间戳来自 ElevenLabs 返回的 `words[]`；句子时间戳由后端按词级结果和句末标点聚合生成。

Google 的 endpoint、模型和密钥同样在 Provider settings 里配置：endpoint 默认 `https://generativelanguage.googleapis.com`，可以指向自建网关（例如 `https://gateway.example.com/gemini`，带 `/v1beta` 的写法也接受），Worker 会据此拼出 Files API（`{endpoint}/upload/v1beta/files`）和 Interactions API（`{endpoint}/v1beta/interactions`）。默认模型是 `gemini-3.5-transcribe`。音频由 Worker 下载（或接收上传）后传到 Gemini Files API，再调用 Interactions API；词级时间戳来自返回的 `word_info` 注解，句子时间戳同样在本地聚合。密钥只从 D1 读（面板里保存的那一份）：


ElevenLabs 请求示例：

```bash
curl -X POST "https://your-worker.example.com/v1/audio/transcriptions" \
  -F "file=@audio.mp3" \
  -F "engine=elevenlabs" \
  -F "language=auto" \
  -F "tagAudioEvents=false"
```

也可以不传文件，改传一个公开音频 URL。字段名用 `source_url`（也接受 `url` 别名）；`file` 与 URL 二选一，两者都传时以文件为准：

```bash
curl -X POST "https://your-worker.example.com/v1/audio/transcriptions" \
  -F "source_url=https://example.com/audio.mp3" \
  -F "engine=elevenlabs"
```

```bash
curl -X POST "https://your-worker.example.com/v1/audio/transcriptions" \
  -F "source_url=https://example.com/audio.mp3" \
  -F "engine=openai"
```

```bash
curl -X POST "https://your-worker.example.com/v1/audio/transcriptions" \
  -F "source_url=https://example.com/audio.mp3" \
  -F "engine=google"
```

URL 模式的行为：

- `engine=elevenlabs`：Worker 把 URL 原样交给 ElevenLabs 的 `source_url`，不在 Worker 端下载，ElevenLabs 的 2GB URL 上限生效。
- `engine=openai`（别名 `whisper`）：Worker 自己下载音频（跟随最多 5 次重定向，每一跳都重新校验），再按 OpenAI 的 `file` 字段转发到 `{endpoint}/audio/transcriptions`；沿用 50MB 上限。请求会带上 `language` / `prompt` / `temperature`（如果提供了），并默认要词级时间戳：用 `response_format=verbose_json` + `timestamp_granularities[]=word`，返回 `text` + `sentences` + `words`。按官方文档，`gpt-4o-transcribe` / `gpt-4o-mini-transcribe` 不支持 `verbose_json`（只有 `json`），`gpt-4o-transcribe-diarize` 只有 `json`/`text`/`diarized_json`，这三种自动退回纯文本；`whisper-1`、`gpt-transcribe`、`gpt-live-transcribe`、`gpt-realtime-whisper` 都有词级时间戳。碰到表里没有的新模型，如果上游拒绝 `verbose_json`，Worker 会自动重试一次 `json`（校验类 400 不计费），并在当前 isolate 内记住这个模型。
- `engine=google`：Worker 自己下载音频后上传到 Gemini Files API，再调用配置的模型；密钥来自 D1（面板里保存的那一份）。默认请求词级时间戳（`timestamp_granularities: ["word"]`），传 `timestamps=false` 就不再请求，只回文本。
- 只允许 `http://` / `https://` 的公开地址；本机、内网、云元数据地址会被拒绝。URL 里不能带用户名或密码。
- 文件上传仍是 50MB 上限；粘贴 URL 时前端不再要求先选文件。

OpenAI 兼容响应示例：

```json
{
  "text": "转录后的文本内容"
}
```

ElevenLabs 响应示例：

```json
{
  "text": "Hello world.",
  "sentences": [
    {
      "text": "Hello world.",
      "start": 0,
      "end": 0.75,
      "duration": 0.75
    }
  ],
  "words": [
    {
      "text": "Hello",
      "start": 0,
      "end": 0.3,
      "duration": 0.3,
      "type": "word"
    },
    {
      "text": " ",
      "start": null,
      "end": null,
      "duration": null,
      "type": "spacing"
    },
    {
      "text": "world",
      "start": 0.35,
      "end": 0.7,
      "duration": 0.35,
      "type": "word"
    },
    {
      "text": ".",
      "start": 0.7,
      "end": 0.75,
      "duration": 0.05,
      "type": "punctuation"
    }
  ]
}
```

时间字段说明：

| 字段 | 说明 |
| --- | --- |
| `start` | 片段开始时间，单位为秒。后端保留 ElevenLabs 返回的原始数值，不主动截断精度 |
| `end` | 片段结束时间，单位为秒。后端保留 ElevenLabs 返回的原始数值，不主动截断精度 |
| `duration` | `end - start`，单位为秒。后端四舍五入到 3 位小数；缺少有效时间时为 `null` |
| `type` | ElevenLabs 词项类型，例如 `word`、`spacing`、`punctuation` |

前端显示时间戳时使用 `mm:ss.SSS`，也就是毫秒级显示。JSON 里的 `start` 和 `end` 仍保留后端收到的数字精度。

参数说明：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | File | 是 | 音频文件，最大 50MB |
| `engine` | string | 否 | `openai`、`elevenlabs` 或 `google`，默认 `openai`（`whisper` 是 `openai` 的别名；其他值返回 400 `unknown_engine`） |
| `endpoint` | string | 否 | 该引擎的 endpoint 覆盖值，默认取 D1 / 内置默认；OpenAI 补 `/audio/transcriptions`，Google 用来拼 Files / Interactions 地址 |
| `model` | string | 否 | 该引擎的模型覆盖值，默认取 D1 配置 |
| `apiKey` | string | 否 | 仅 OpenAI 引擎支持单次覆盖；默认使用保存在 D1 的密钥 |
| `language` | string | OpenAI / ElevenLabs 可选 | OpenAI 用 ISO-639-1 两字母代码（`en`、`zh`、`ja`）；ElevenLabs 用官方三字母代码（`eng`、`zho`、`jpn`、`kor`、`spa`、`fra`、`deu`、`rus`）。留空或 `auto` 表示自动检测 |
| `tagAudioEvents` | string | ElevenLabs 可选 | 是否标记笑声、掌声等音频事件，传 `true` 或 `false`，默认 `false` |
| `prompt` | string | OpenAI 可选 | 词表/上下文提示，最长 1000 字符；对人名、专有名词、术语很有效。`gpt-4o-transcribe-diarize` 不支持该字段，会跳过 |
| `temperature` | string | OpenAI 可选 | 0 到 1 之间的采样温度，默认由上游决定 |
| `timestamps` | string | OpenAI / Google 可选 | 传 `false` 关闭词级时间戳，默认 `true`。OpenAI 侧只有支持 `verbose_json` 的模型会有词级时间戳（`whisper-1`、`gpt-transcribe`、`gpt-live-transcribe`、`gpt-realtime-whisper`），`gpt-4o-transcribe*` 会自动退回纯文本；Google 侧关掉就不再请求 `timestamp_granularities`，只回文本 |
| `diarize` | string | ElevenLabs 可选 | 是否标注说话人，默认 `true` |
| `numSpeakers` | string | ElevenLabs 可选 | 1–32 的说话人数量提示，配合 `diarize` 使用；留空表示自动 |
| `timestampsGranularity` | string | ElevenLabs 可选 | `word`（默认）、`character` 或 `none`（完全不返回时间戳）。ElevenLabs 原生的粒度只有 `none`/`word`/`character` 三档，**没有句级**——句子是我们按标点从词项聚合出来的 |

支持格式：

```text
mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp
```

### 服务配置（Provider settings）

接口：

```text
GET /api/providers              # 公开，只返回 endpoint、模型、是否已配置和掩码尾巴
PUT /api/providers/:provider    # 由 Cloudflare Access 保护（Worker 自身不校验 token）
```

`provider` 取值 `openai`、`elevenlabs`、`google`。请求示例：

```bash
curl -X PUT "https://your-worker.example.com/api/providers/openai" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://api.openai.com/v1","model":"whisper-1","apiKey":"sk-..."}'
```

- `apiKey` 留空表示保留已保存的密钥，传 `"clearApiKey": true` 才会清空。
- 响应只包含 `configured`、`keySource`（`db` / `none`）和 `keyTail`（例如 `••••a1b2`），不会回传明文。
- 写接口不做应用层校验：只要请求能穿过 Cloudflare Access 就被接受。Access 是唯一的一道门，务必确认 `/api/*` 已覆盖。

### Trancy 多账号网关

`/trancy` 页面把多个 Trancy 账号收进一个池子，对外只有一个转发入口。

鉴权方式（实测）：

- 一个账号就是一条 HS256 JWT，载荷只有 `{ name, id, iat }`，**没有 `exp`、没有 refresh token**。Trancy 网页端把它写进非 httpOnly 的 `trancy` cookie（`.trancy.org`，365 天）；网页和浏览器扩展调用 `api.trancy.org` 时都用 `Authorization: Bearer <token>`。
- **没有专门的刷新接口**：任何一次 `GET /1/user/profile` 都会返回一条 `iat` 被推到当前秒的新 token，这就是续期。
- **鉴权失败不返回 401**，而是 `200 {"data":null,"message":"ok"}`。网关判活看 `data` 字段，不看状态码。
- token 不绑定 IP 和设备指纹，数据中心出口也能用，所以 Worker 直接转发不需要浏览器。

三种添加方式（都返回可用的 token，不需要手动找 cookie）：

| 方式 | 走的接口 | 说明 |
| --- | --- | --- |
| 登录 | `POST /1/login` | 用账号邮箱密码登录，成功即拿到 token |
| 注册 | `POST /1/signup` | 直接注册新账号并落库，密码至少 6 位，无需邮箱验证 |
| 粘贴 | — | 手动粘 bearer token 或 `trancy=...` cookie，账号没有密码时用这条 |

数据与密钥：

- 存在 D1 的 `trancy_account` 表；**token 用 `SECRETS_ENCRYPTION_KEY` 做 AES-256-GCM 加密**，`aad` 绑定 `trancy:<行 id>`，密文跨行复制解不开。
- **密码加密保存**（`trancy_account.password_cipher`）：与 token 同一套 AES-256-GCM 信封，`aad` 用 `trancy-password:<行 id>`（与 token 的 `trancy:<行 id>` 不同，两个密文不能互换）。解密只发生在两处：`POST /api/trancy/accounts/:id/login` 真要登录时，以及点「Show」调用的 `GET /api/trancy/accounts/:id/password`。列表接口只回 `hasPassword`，不带明文。
- 页面用**邮箱**作为账号标识（还没探测过的账号退回 JWT 里的名字），并显示 token 尾巴（`••••a1b2c3`）、会员状态、最近检查时间和密码（点击可复制）。没有额外的备注名要填。
- 同一个 Trancy 用户重复添加只更新那一行（按 JWT 里的 `id` 判重），等同于「换 token 复活」。

接口：

```text
GET    /api/trancy/accounts              # 账号列表（浏览器安全视图）
POST   /api/trancy/accounts              # 粘贴 token 添加 {"token":"eyJ..."}
POST   /api/trancy/accounts/login        # 登录并添加 {"email":"...","password":"..."}
POST   /api/trancy/accounts/signup       # 注册并添加，字段同上
POST   /api/trancy/accounts/:id/login    # 用保存的密码重新登录（token 失效后的恢复手段）
GET    /api/trancy/accounts/:id/password # 按需解密出密码，供面板显示/复制（Cache-Control: no-store）
POST   /api/trancy/accounts/:id/refresh  # 立刻探测单个账号
POST   /api/trancy/accounts/refresh      # 立刻探测全部（默认跳过 10 分钟内查过的）
DELETE /api/trancy/accounts/:id          # 删除账号
```

这些接口都不做应用层鉴权，全部依赖 Cloudflare Access 覆盖 `/api/*`。

自动续期（每天一次）：

```toml
# wrangler.toml
[triggers]
crons = ["17 3 * * *"]
```

`src/worker.js` 的 `scheduled` 处理器逐个调 `/1/user/profile`，把新 token 加密写回，同时刷新 `premium` / `banned` 标记；`dead` 账号直接跳过（只有人工重贴 token 才能复活）。非默认环境不继承 triggers，所以 `env.production` 下也声明了一份。

手动跑一次：

```bash
npx wrangler dev index.js --local --test-scheduled
curl "http://127.0.0.1:8787/__scheduled?cron=17+3+*+*+*"
```

### YouTube 字幕调度（AI 字幕额度）

目标是这个接口，它决定了整个池子的调度方式：

```text
GET https://api.trancy.org/3/youtube/captions/{videoId}?target=en&source=audio
Authorization: Bearer {token}
```

实测契约：

- **同步**：一次请求直接返回整段字幕（`data` 是句子数组，带词级时间戳），没有 job id、不需要轮询。
- **额度**：免费号每个账号每天只能生成少量 AI 字幕（页面上写 5 个/天）。响应头带 `x-quota-limit` / `x-quota-remaining`。
- **额度用完不返回 429**：`200 {"code":403,"message":"You've reached the daily limit of 5 AI subtitles for free users..."}`，和鉴权失败一样靠 body 判定。
- 网关**不保存**生成结果：字幕直接回给调用方，同一个视频再请求就再生成一次（上游自己有缓存时不会重复扣额度，但那是对方的行为，不作保证）。

接口（只有一个）：

```text
POST /api/trancy/captions   # {"videoId":"npka43vhwNo"}，花额度；target 可省略，默认 en
```

`POST` 的返回体是 `{data:[...], account, quota:{limit,remaining}, usedToday, sentenceCount}`，同时把 `X-Trancy-Account` / `X-Quota-*` 放进响应头。调度规则：

1. **刚说过「没额度」的账号不再问**：`exhausted_until` 停在下一个 UTC 零点，token 和 `status=ok` 保持不变（cron 照常续期）。
2. **先花最空的账号**：本地 `day_used`（按 UTC 日）优先，其次上游 `x-quota-remaining`，最后 LRU。
3. **不存结果**：`trancy_caption` 表和「同视频只生成一次」的占位锁都已删除——重复请求会重复花额度，缓存在调用方那边做。

没有一个账号能用时返回 `503`：

```json
{"error":{"code":"no_caption_quota","message":"所有账号今天的 AI 字幕额度都用完了"},
 "resetAt":"2026-11-03T00:00:00.000Z",
 "tried":["acc@example.com: daily_limit"]}
```

`tried` 会写清每个被咨询账号的失败原因，`resetAt` 是下一个 UTC 零点。

给下游程序调用：

- 入口只有一个：`POST /api/trancy/captions`（生成并直接返回字幕）。
- 鉴权只有一层：Cloudflare Access。下游程序要么用 Access 的 Service Token
  （请求头 `CF-Access-Client-Id` / `CF-Access-Client-Secret`），要么把 Worker 放在自用域名后面。
  Worker 里不再有任何自己的 token 逻辑。
- **`target` 可以省略**，默认 `en`；下游只要知道 videoId。
- **同一视频并发会各花一次额度**：没有缓存也没有锁，两个并发请求就是两次生成。
  需要去重请在调用方做（这也是它「不需要缓存」的前提）。

下游调用示例：

```bash
curl -s -X POST "$GW/api/trancy/captions" \
  -H "CF-Access-Client-Id: $ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $ACCESS_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"videoId":"npka43vhwNo"}'
# 200 → {"data":[...],"account":{...},"quota":{...},"sentenceCount":108}
# 400 → {"error":{"code":"invalid_caption_request"}}
# 503 → {"error":{"code":"no_caption_quota"},"resetAt":"...","tried":[...]}
```

面板上的额度显示：

- 每个账号一行 `AI subtitles <剩余>/<每日上限> · today <今天已用>`；上限来自上游 `x-quota-limit`，账号还没请求过时按官方的 5 显示。
- 顶部 `AI subtitles <池子剩余> / <池子容量> left` 是整池汇总，直接回答「今天还能做几个视频」。
- 额度用完的账号会多一个 `QUOTA OUT` 徽章，并写出恢复时间（下一个 UTC 零点）。这种账号 `status` 仍是 `ok`，cron 照常续期。

### 文本 AI 润色

接口：

```text
POST /v1/text/polish
```

请求示例：

```bash
curl -X POST "https://your-worker.example.com/v1/text/polish" \
  -H "Content-Type: application/json" \
  -d '{
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "sk-...",
    "model": "gpt-4o-mini",
    "input": "需要润色的文本",
    "instruction": "润色文本，让它更适合语音朗读。只返回正文。"
  }'
```

参数说明：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `baseUrl` | string | 是 | OpenAI 兼容接口基础地址 |
| `apiKey` | string | 是 | API Key |
| `model` | string | 是 | 模型名称 |
| `input` | string | 是 | 要润色的文本 |
| `instruction` | string | 否 | 润色指令 |

## 前端使用

页面路径：

```text
/tts              文字转语音
/transcription    语音转文字
/trancy           Trancy 多账号网关
```

文字转语音流程：

1. 选择输入方式：手动文本、上传 txt 或 SSML。
2. 在左侧声音库中搜索并选择 voice ID；点行内的 ▶ 可以先试听（不改变当前选择，再点一次停止）。
3. 调整语速、音调和风格。
4. 点击生成语音。
5. 在生成结果区域播放或下载 MP3。

语音转文字流程：

1. 切换到 Speech to Text。
2. 上传音频文件，或在 `Audio URL` 里粘贴公开音频 URL。
3. 展开 Provider settings，为本机要用的引擎填好 endpoint、模型和 API Key（写接口由 Cloudflare Access 保护）；选择 ElevenLabs 时还可以设置语言和音频事件标记。
4. 点击转录。
5. ElevenLabs 结果可在纯文本、句子时间戳和词级时间戳之间切换。
6. 点击句子或词的时间戳会播放上传音频的对应片段。
7. 复制、编辑转录结果，或把文本送回 TTS。

Trancy 网关流程：

1. 切到 Gateway 标签页。
2. 选添加方式：`Log in` 填邮箱密码 → 点「登录并添加」；`Sign up` 直接注册新账号；`Token` 才需要自己粘贴 cookie / bearer token。
3. 添加时 Trancy 直接返回 token，网关一次性拿到 `ok` 状态、邮箱和会员信息，不用再手动刷新。
4. 之后靠 cron 每天自动续期；某天 token 失效（`dead`）时，点「Log in again」用保存的密码一键换新 token。
5. 密码点击即可复制。

AI 润色流程：

1. 在文字输入区域点击 AI 润色设置。
2. 填写 OpenAI 兼容接口 Base URL、API Key 和模型。
3. 输入文本后点击 AI 润色图标。

AI 润色的 Base URL、API Key、模型和润色指令会保存在浏览器本地 `localStorage`，不会写入仓库。转录服务的配置则相反：endpoint / 模型 / API Key 保存在 Worker 的 D1 里，其中 API Key 是加密后的密文，写接口靠 Cloudflare Access 挡外部访问。

## 验证

修改代码后建议执行：

```bash
node scripts/verify-readme.mjs
node scripts/verify-frontend-redesign.mjs
node scripts/verify-ai-polish.mjs
node scripts/verify-code-hygiene.mjs
node scripts/verify-voices.mjs
node scripts/verify-transcription-format.mjs
node scripts/verify-elevenlabs-stt.mjs
node scripts/verify-google-stt.mjs
node scripts/verify-transcription-url.mjs
node scripts/verify-provider-secrets.mjs
node scripts/verify-trancy-gateway.mjs
node -e "import('./index.js').then((m) => { if (!m.default || typeof m.default.fetch !== 'function') throw new Error('Worker fetch export missing'); console.log('Worker entry import ok'); })"
git diff --check
```

## 注意事项

- Edge TTS 依赖 Microsoft 服务可用性，网络环境会影响生成成功率。
- 长文本会自动拆分再合成，内容越长，生成时间越久。
- STT 文件上传限制为 50MB；OpenAI 引擎的 URL 模式同样限制 50MB，ElevenLabs 的 URL 模式由 ElevenLabs 自己限制（2GB），Google 的 URL 模式也受 Worker 50MB 上限约束。
- 三个引擎的密钥都只从 D1 读：在 Provider settings 里保存（加密），没有环境变量兜底，所以**部署只需要一个 secret：`SECRETS_ENCRYPTION_KEY`**。
- 文本文件上传限制为 500KB。
- URL 模式会跟随最多 5 次重定向，并拒绝本机/内网地址；Worker 不会把任意 URL 当作内网代理。
- 自建 OpenAI 兼容服务如果部署在非标准 HTTPS 端口，Cloudflare Workers 发布环境可能忽略自定义端口，建议使用标准 443 端口或反向代理到标准端口。
- 项目需要 D1 存服务配置；没有 D1 binding 时设置接口会返回明确错误，页面里的 Provider settings 不可写。
- 更换 `SECRETS_ENCRYPTION_KEY` 会让已保存的 API Key 无法解密，需要在页面里重新填写一次。
- Trancy token 没有 `exp`，不续期会在一个未测出的窗口后失效，所以 `wrangler.toml` 里的 cron 是这条链路的一部分：关掉 cron，账号迟早会变成 `dead`（有密码就点一次重新登录，没有密码只能重贴 token）。部署前记得执行 `npx wrangler d1 migrations apply voicecraft --remote`。
- Trancy 的密码在 D1 里是密文，但**解密只需要 `SECRETS_ENCRYPTION_KEY`**：同时拿到数据库和这个 secret 的人仍能还原密码，所以 `/api/*` 必须挂 Access。换掉 `SECRETS_ENCRYPTION_KEY` 会让已有密码和 token 一起失效，账号需要重新登录或重贴 token。
- 轮换多个账号等于把免费额度拆给不同账号，这类用法通常违反服务的服务条款；风控或封号在网关里表现为 `status=banned` 或上游 `data:null`，不要把它放在关键路径上。

## 开源协议

本项目使用 MIT License。详见 [LICENSE](LICENSE)。

Fork 后分发或二次开发时，需要保留 MIT License 的版权和许可文本。
