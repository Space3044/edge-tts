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
- 语音转文字：上传音频，可调用你部署的 Whisper ASR Webservice，也可使用 ElevenLabs Scribe 接口。
- AI 润色：调用 OpenAI 兼容接口润色输入文本。
- 浏览器本地保存：Whisper ASR 地址、AI 润色 Base URL、API Key、模型和润色指令只保存在当前浏览器本地。
- 多语言界面：支持中文、英文、日文、韩文、西班牙文、法文、德文、俄文。

## 项目结构

```text
.
├── index.js                         # Cloudflare Worker 入口
├── src/
│   ├── worker.js                    # 路由分发
│   ├── routes/                      # speech、transcriptions、polish、favicon
│   ├── edge/                        # Edge TTS 端点、签名、SSML、合成逻辑
│   ├── frontend/                    # 页面、样式、客户端脚本、声音库、多语言、favicon
│   └── utils/                       # CORS、文本切分等工具
├── scripts/                         # 验证脚本
├── docs/                            # 设计和实现说明
├── wrangler.toml                    # Cloudflare Workers 配置
├── LICENSE
└── README.md
```

## 本地运行

项目没有 `package.json`。本地调试需要 Node.js 和 Wrangler。

```bash
npx wrangler dev index.js --local --port 8787
```

启动后访问：

```text
http://127.0.0.1:8787
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

当前实现支持两种转录引擎。默认调用 Whisper ASR Webservice，前端会让用户填写 Whisper ASR 地址，后端再把音频转发到该地址。选择 ElevenLabs 时，后端会调用 ElevenLabs Scribe Speech-to-Text 接口。

Whisper ASR 请求示例：

```bash
curl -X POST "https://your-worker.example.com/v1/audio/transcriptions" \
  -F "file=@audio.mp3" \
  -F "engine=whisper" \
  -F "endpoint=https://your-whisper-asr.example.com"
```

ElevenLabs 请求示例：

```bash
curl -X POST "https://your-worker.example.com/v1/audio/transcriptions" \
  -F "file=@audio.mp3" \
  -F "engine=elevenlabs" \
  -F "language=auto" \
  -F "tagAudioEvents=false"
```

响应示例：

```json
{
  "text": "转录后的文本内容"
}
```

参数说明：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | File | 是 | 音频文件，最大 50MB |
| `engine` | string | 否 | `whisper` 或 `elevenlabs`，默认 `whisper` |
| `endpoint` | string | Whisper 必填 | Whisper ASR Webservice 基础地址 |
| `language` | string | ElevenLabs 可选 | ElevenLabs 官方语言代码，默认 `auto` 自动检测。常用值：`eng`、`zho`、`jpn`、`kor`、`spa`、`fra`、`deu`、`rus` |
| `tagAudioEvents` | string | ElevenLabs 可选 | 是否标记笑声、掌声等音频事件，传 `true` 或 `false` |

支持格式：

```text
mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp
```

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

文字转语音流程：

1. 选择输入方式：手动文本、上传 txt 或 SSML。
2. 在左侧声音库中搜索并选择 voice ID。
3. 调整语速、音调和风格。
4. 点击生成语音。
5. 在生成结果区域播放或下载 MP3。

语音转文字流程：

1. 切换到 Speech to Text。
2. 上传音频文件。
3. 选择 Whisper 时填写已部署的 Whisper ASR 地址；选择 ElevenLabs 时可设置语言和音频事件标记。
4. 点击转录。
5. 复制、编辑转录结果，或把文本送回 TTS。

AI 润色流程：

1. 在文字输入区域点击 AI 润色设置。
2. 填写 OpenAI 兼容接口 Base URL、API Key 和模型。
3. 输入文本后点击 AI 润色图标。

Whisper ASR 地址和 AI 润色设置会保存在浏览器本地 `localStorage`，不会写入仓库，也不会保存到 Worker 端。

## 验证

修改代码后建议执行：

```bash
node scripts/verify-readme.mjs
node scripts/verify-frontend-redesign.mjs
node scripts/verify-ai-polish.mjs
node scripts/verify-code-hygiene.mjs
node scripts/verify-voices.mjs
node scripts/verify-transcription-format.mjs
node -e "import('./index.js').then((m) => { if (!m.default || typeof m.default.fetch !== 'function') throw new Error('Worker fetch export missing'); console.log('Worker entry import ok'); })"
git diff --check
```

## 注意事项

- Edge TTS 依赖 Microsoft 服务可用性，网络环境会影响生成成功率。
- 长文本会自动拆分再合成，内容越长，生成时间越久。
- STT 文件大小限制为 50MB。
- 文本文件上传限制为 500KB。
- Whisper ASR 如果部署在非标准 HTTPS 端口，Cloudflare Workers 发布环境可能忽略自定义端口，建议使用标准 443 端口或反向代理到标准端口。
- 本项目不需要数据库、KV 或 D1。

## 开源协议

本项目使用 MIT License。详见 [LICENSE](LICENSE)。

Fork 后分发或二次开发时，需要保留 MIT License 的版权和许可文本。
