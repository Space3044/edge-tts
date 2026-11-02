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
- 声音库：内置 114 个 Microsoft Edge TTS 声音，支持按语言、性别、名称、地区和 voice ID 搜索。
- 参数调节：支持语速、音调和语音风格，语速和音调可双击恢复默认值。
- 生成结果：生成后的 MP3 可在线播放和下载。
- 语音转文字：上传音频或粘贴公开音频 URL，可使用 OpenAI 兼容转录接口、ElevenLabs Scribe、Google Gemini Transcribe 或 Microsoft Azure AI Speech；后三个都支持句子时间戳和词级时间戳查看。
- AI 润色：调用 OpenAI 兼容接口润色输入文本。
- 服务配置：转录服务的 endpoint、模型和 API Key 在页面里设置，API Key 用 `SECRETS_ENCRYPTION_KEY` 加密后存进 D1；页面只显示掩码尾巴，不回传明文。
- 浏览器本地保存：AI 润色的 Base URL、API Key、模型和润色指令只保存在当前浏览器本地。
- 多语言界面：支持中文、英文、日文、韩文、西班牙文、法文、德文、俄文。

## 项目结构

```text
.
├── index.js                         # Cloudflare Worker 入口
├── src/
│   ├── worker.js                    # 路由分发
│   ├── routes/                      # speech、transcriptions、polish、providers、favicon
│   ├── edge/                        # Edge TTS 端点、签名、SSML、合成逻辑
│   ├── secrets/                     # API Key 加解密（AES-GCM）与 D1 配置读写
│   ├── frontend/                    # 页面、样式、客户端脚本、声音库、多语言、favicon
│   └── utils/                       # CORS、文本切分等工具
├── migrations/                      # D1 迁移（provider_config 表）
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
cp .dev.vars.example .dev.vars        # 填入 SECRETS_ENCRYPTION_KEY 和 ADMIN_TOKEN
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

npx wrangler secret put SECRETS_ENCRYPTION_KEY   # base64 的 32 字节
npx wrangler secret put ADMIN_TOKEN              # 可选：不用 Access 时才需要
```

- `SECRETS_ENCRYPTION_KEY` 只用于加解密，不参与鉴权；换掉它会导致已保存的密钥无法解密，需要重新填写。
- 谁能写 Provider 配置由环境决定：本地 `localhost` / `127.0.0.1` / `*.local` 直接放行；线上如果 `/api/*` 已由 Cloudflare Access 保护，设置 `CF_ACCESS_TRUSTED=1` 即可；其他情况设置 `ADMIN_TOKEN` 并用 `Authorization: Bearer` 发送（配置了 `ADMIN_TOKEN` 时它以最高优先级生效）。三种都不满足时写接口返回 `403 write_not_configured`，不会默默放开。
- 除密钥外的变量都不写入仓库，`wrangler.toml` 里也不出现明文。

## Cloudflare Access

如果需要只保护语音转文字功能，可以在 Cloudflare Zero Trust 里为同一个 Worker 域名添加 Access Application，并把策略路径限制到：

```text
/transcription*
/v1/audio/transcriptions*
```

这样文字转语音页面 `/tts` 可以公开访问，语音转文字页面和转录接口会先经过 Cloudflare Access 登录。若整个工具只给自己使用，也可以直接保护 `/*`。

## API

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

当前实现支持四种转录引擎：`openai`（OpenAI 兼容的 `/audio/transcriptions`）、`elevenlabs`、`google` 和 `microsoft`（Azure AI Speech）。三个引擎的 endpoint、模型和 API Key 都在页面里的 Provider settings 中配置，保存在 D1 的 `provider_config` 表；API Key 用 `SECRETS_ENCRYPTION_KEY` 加密后落库，接口只会返回掩码尾巴。

解析顺序是「D1 里保存的值 → 环境变量 → 内置默认值」：D1 没配时回落到 `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` / `GEMINI_API_KEY`（或 `GOOGLE_API_KEY`），都没有就用默认地址和模型。`engine=whisper` 仍然保留为 `openai` 的别名，老调用方不需要改。

ElevenLabs 调用的是 Scribe Speech-to-Text 接口：

```text
https://api.elevenlabs.io/v1/speech-to-text
```

ElevenLabs 默认模型是 `scribe_v2`（可在 Provider settings 里改）。配置了 API Key 时请求带 `xi-api-key`；没有配置时沿用匿名 Scribe 请求。词级时间戳来自 ElevenLabs 返回的 `words[]`；句子时间戳由后端按词级结果和句末标点聚合生成。

Google 的 endpoint、模型和密钥同样在 Provider settings 里配置：endpoint 默认 `https://generativelanguage.googleapis.com`，可以指向自建网关（例如 `https://gateway.example.com/gemini`，带 `/v1beta` 的写法也接受），Worker 会据此拼出 Files API（`{endpoint}/upload/v1beta/files`）和 Interactions API（`{endpoint}/v1beta/interactions`）。默认模型是 `gemini-3.5-transcribe`。音频由 Worker 下载（或接收上传）后传到 Gemini Files API，再调用 Interactions API；词级时间戳来自返回的 `word_info` 注解，句子时间戳同样在本地聚合。密钥优先读 D1，没有时回落到环境变量：

```bash
npx wrangler secret put GEMINI_API_KEY   # 可选，D1 里保存过密钥就不需要
```

Microsoft 用的是 **access token**（不是 API Key，也没有登录回调）：在 Provider settings 里把令牌粘进来，Worker 用 `SECRETS_ENCRYPTION_KEY` 加密后存进 D1。转录走 Azure 的 Fast transcription 接口：

```text
POST https://{region}.api.cognitive.microsoft.com
     /speechtotext/transcriptions:transcribe?api-version=2024-11-15
```

需要的凭据（二选一，**推荐订阅密钥**）：

| 字段 | 说明 |
| --- | --- |
| `Region` | 必填，Azure 区域，例如 `eastasia`，用来拼 `https://{region}.api.cognitive.microsoft.com` |
| `Subscription key` | 推荐。Speech 资源 →「密钥和终结点」里的 `KEY 1`，永不过期，请求带 `Ocp-Apim-Subscription-Key` |
| `Access token` | 可选。订阅密钥的替代品，audience 必须是 `https://cognitiveservices.azure.com`；Worker 读 JWT 的 `exp` 判断过期，audience 不对直接拒绝 |
| `Refresh token` | 可选，配合 access token 自动续期；轮换后的新值会存回 D1 |

填了订阅密钥就完全不走 token/续期逻辑；两者都填时订阅密钥优先。

只有走 access token + 自动续期时，才需要发起续期的应用 id：

```bash
npx wrangler secret put MICROSOFT_CLIENT_ID    # 签发这批 token 的应用
npx wrangler secret put MICROSOFT_CLIENT_SECRET  # 公共客户端/纯 PKCE 可留空
npx wrangler secret put MICROSOFT_TENANT       # 默认 common
```

两种方式都需要 Azure 里的 **Speech 资源**（免费层 F0 每月 5 小时）。用订阅密钥时不需要任何额外角色；用 token 时，签发令牌的账号要在该资源上有 `Cognitive Services Speech User` 角色。**不要**复用 Thunderbird / Office / Azure CLI 这类第三方公开 client id——它们的应用没有声明 Speech 权限，续期会失败（AADSTS65001），而且是冒用别人的应用身份。

配了 `MICROSOFT_CLIENT_ID` 的话可以先自检续期凭据：

```bash
node scripts/check-microsoft-oauth.mjs
```

之后在 Provider settings 里填 region 和令牌，点「保存」即可；状态会显示「有效期至 …」。令牌泄漏或失效时点「清除令牌」，再粘贴新的。refresh token 失效时页面会显示「未连接」，转录接口返回 `microsoft_login_required`，重新登录一次就好。

没有可用密钥时，Google 引擎会返回明确的 `google_not_configured` 错误。

OpenAI 兼容请求示例（endpoint / 模型 / 密钥默认取 D1 配置）：

```bash
curl -X POST "https://your-worker.example.com/v1/audio/transcriptions" \
  -F "file=@audio.mp3" \
  -F "engine=openai"
```

调用方也可以在单次请求里覆盖，适合用不同的模型或临时密钥测试：

```bash
curl -X POST "https://your-worker.example.com/v1/audio/transcriptions" \
  -F "file=@audio.mp3" \
  -F "engine=openai" \
  -F "endpoint=https://your-asr.example.com/v1" \
  -F "model=whisper-1" \
  -F "apiKey=sk-..."
```

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
- `engine=openai`（别名 `whisper`）：Worker 自己下载音频（跟随最多 5 次重定向，每一跳都重新校验），再按 OpenAI 的 `file` 字段转发到 `{endpoint}/audio/transcriptions`；沿用 50MB 上限。
- `engine=google`：Worker 自己下载音频后上传到 Gemini Files API，再调用配置的模型；密钥来自 D1 或 `GEMINI_API_KEY`。
- `engine=microsoft`：Worker 自己下载音频后以 multipart 传给 Azure Fast transcription；凭据是 Provider settings 里保存的 access token（过期且配了 refresh token 时自动续期）。
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
| `engine` | string | 否 | `openai`、`elevenlabs`、`google` 或 `microsoft`，默认 `openai`（`whisper` 是 `openai` 的别名） |
| `endpoint` | string | 否 | 该引擎的 endpoint 覆盖值，默认取 D1 / 环境变量 / 内置默认；OpenAI 补 `/audio/transcriptions`，Google 用来拼 Files / Interactions 地址 |
| `model` | string | 否 | 该引擎的模型覆盖值，默认取 D1 配置 |
| `apiKey` | string | 否 | 仅 OpenAI 引擎支持单次覆盖；默认使用保存在 D1 的密钥 |
| `region` | string | Microsoft 必填 | Azure 区域，例如 `eastasia`；默认取 Provider settings 里保存的值 |
| `locale` | string | Microsoft 可选 | BCP-47 语言提示，例如 `zh-CN`；留空由服务自动识别 |
| `language` | string | ElevenLabs 可选 | ElevenLabs 官方语言代码，默认 `auto` 自动检测。常用值：`eng`、`zho`、`jpn`、`kor`、`spa`、`fra`、`deu`、`rus` |
| `tagAudioEvents` | string | ElevenLabs 可选 | 是否标记笑声、掌声等音频事件，传 `true` 或 `false` |

支持格式：

```text
mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp
```

### 服务配置（Provider settings）

接口：

```text
GET /api/providers              # 公开，只返回 endpoint、模型、是否已配置和掩码尾巴
PUT /api/providers/:provider    # 需要 Authorization: Bearer $ADMIN_TOKEN
```

`provider` 取值 `openai`、`elevenlabs`、`google`。请求示例：

```bash
curl -X PUT "https://your-worker.example.com/api/providers/openai" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://api.openai.com/v1","model":"whisper-1","apiKey":"sk-..."}'
```

- `apiKey` 留空表示保留已保存的密钥，传 `"clearApiKey": true` 才会清空。
- 响应只包含 `configured`、`keySource`（`db` / `env` / `none`）和 `keyTail`（例如 `••••a1b2`），不会回传明文。
- 写权限按环境判定：本地开发直接放行；`CF_ACCESS_TRUSTED=1` 表示 `/api/*` 由 Cloudflare Access 保护；否则需要 `ADMIN_TOKEN`。都不满足时返回 `write_not_configured`，页面里的设置面板变成只读。

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
```

文字转语音流程：

1. 选择输入方式：手动文本、上传 txt 或 SSML。
2. 在左侧声音库中搜索并选择 voice ID。
3. 调整语速、音调和风格。
4. 点击生成语音。
5. 在生成结果区域播放或下载 MP3。

语音转文字流程：

1. 切换到 Speech to Text。
2. 上传音频文件，或在 `Audio URL` 里粘贴公开音频 URL。
3. 展开 Provider settings，为本机要用的引擎填好 endpoint、模型和 API Key（首次保存时输入 `ADMIN_TOKEN`，只存在 sessionStorage）；选择 ElevenLabs 时还可以设置语言和音频事件标记。
4. 点击转录。
5. ElevenLabs 结果可在纯文本、句子时间戳和词级时间戳之间切换。
6. 点击句子或词的时间戳会播放上传音频的对应片段。
7. 复制、编辑转录结果，或把文本送回 TTS。

AI 润色流程：

1. 在文字输入区域点击 AI 润色设置。
2. 填写 OpenAI 兼容接口 Base URL、API Key 和模型。
3. 输入文本后点击 AI 润色图标。

AI 润色的 Base URL、API Key、模型和润色指令会保存在浏览器本地 `localStorage`，不会写入仓库。转录服务的配置则相反：endpoint / 模型 / API Key 保存在 Worker 的 D1 里，其中 API Key 是加密后的密文，`ADMIN_TOKEN` 只留在当前标签页的 `sessionStorage`。

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
node scripts/verify-microsoft-stt.mjs
node -e "import('./index.js').then((m) => { if (!m.default || typeof m.default.fetch !== 'function') throw new Error('Worker fetch export missing'); console.log('Worker entry import ok'); })"
git diff --check
```

## 注意事项

- Edge TTS 依赖 Microsoft 服务可用性，网络环境会影响生成成功率。
- 长文本会自动拆分再合成，内容越长，生成时间越久。
- STT 文件上传限制为 50MB；OpenAI 引擎的 URL 模式同样限制 50MB，ElevenLabs 的 URL 模式由 ElevenLabs 自己限制（2GB），Google 的 URL 模式也受 Worker 50MB 上限约束。
- OpenAI / ElevenLabs / Google 需要可用的密钥：优先用 Provider settings 保存到 D1 的那一份，缺失时回落到 `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` / `GEMINI_API_KEY`。Microsoft 用 OAuth，没有密钥，只有 refresh token（同样加密存在 D1）。
- 文本文件上传限制为 500KB。
- URL 模式会跟随最多 5 次重定向，并拒绝本机/内网地址；Worker 不会把任意 URL 当作内网代理。
- 自建 OpenAI 兼容服务如果部署在非标准 HTTPS 端口，Cloudflare Workers 发布环境可能忽略自定义端口，建议使用标准 443 端口或反向代理到标准端口。
- 项目需要 D1 存服务配置；没有 D1 binding 时设置接口会返回明确错误，页面里的 Provider settings 不可写。
- 更换 `SECRETS_ENCRYPTION_KEY` 会让已保存的 API Key 无法解密，需要在页面里重新填写一次。

## 开源协议

本项目使用 MIT License。详见 [LICENSE](LICENSE)。

Fork 后分发或二次开发时，需要保留 MIT License 的版权和许可文本。
