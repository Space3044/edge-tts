# VoiceCraft

VoiceCraft 是一个运行在 Cloudflare Workers 上的语音处理工具，提供文字转语音和语音转文字两个工作流。

当前版本使用 Microsoft Edge TTS 生成语音，内置 114 个可选声音；语音转文字通过 SiliconFlow 的 `FunAudioLLM/SenseVoiceSmall` 模型完成。前端是单文件原生 HTML/CSS/JavaScript，不依赖前端构建工具。

在线示例：

```text
https://tts.wangwangit.com
```

## 功能

- 文字转语音：输入文本或上传 `.txt` 文件，生成 MP3 音频
- 声音选择：支持 114 个 Edge TTS 声音，可按语言、性别、名称、地区和 voice ID 搜索
- 参数调节：支持语速、音调、音量和语音风格
- 语音转文字：上传音频文件并返回转录文本
- 多语言界面：支持中文、英文、日文、韩文、西班牙文、法文、德文、俄文
- API 调用：提供兼容 OpenAI 风格的 `/v1/audio/speech` 接口
- 单文件部署：核心代码集中在 `index.js`，适合 Cloudflare Workers 手动部署

## 项目结构

```text
.
├── index.js                         # Worker 入口、前端页面和 API 逻辑
├── wrangler.toml                    # Cloudflare Workers 配置
├── scripts/
│   ├── verify-voices.mjs            # 校验声音列表
│   └── verify-frontend-redesign.mjs # 校验前端结构和多语言标记
├── LICENSE
└── README.md
```

## Cloudflare 控制台部署

适合不想在本地安装 Wrangler 的情况。

1. 登录 Cloudflare 控制台
2. 进入 `Workers & Pages`
3. 创建 Worker
4. 打开在线编辑器
5. 将 `index.js` 的内容完整粘贴进去
6. 保存并部署

如果使用控制台导入 Git 仓库，入口文件保持为：

```text
index.js
```

`wrangler.toml` 当前配置：

```toml
name = "tts-voice-magic"
main = "index.js"
compatibility_date = "2024-01-15"
compatibility_flags = ["nodejs_compat"]
```

## 本地运行

项目没有 `package.json`，本地运行只需要 Node.js 和 Wrangler。

```bash
npx wrangler dev index.js --local --port 8787
```

启动后访问：

```text
http://127.0.0.1:8787
```

如果已经全局安装 Wrangler，也可以运行：

```bash
wrangler dev index.js --local --port 8787
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

也支持 `multipart/form-data` 上传 `.txt` 文件：

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
| `input` | string | JSON 模式必填 | - | 要转换的文本 |
| `file` | File | 表单模式必填 | - | `.txt` 文本文件，最大 500KB |
| `voice` | string | 否 | `zh-CN-XiaoxiaoNeural` | Edge TTS voice ID |
| `speed` | number | 否 | `1` | 语速 |
| `pitch` | string | 否 | `0` | 音调 |
| `volume` | string | 否 | `0` | 音量 |
| `style` | string | 否 | `general` | 语音风格 |

常用中文声音：

```text
zh-CN-XiaoxiaoNeural
zh-CN-XiaoyiNeural
zh-CN-YunjianNeural
zh-CN-YunxiNeural
zh-CN-YunyangNeural
```

完整声音列表在前端的 Voice Library 中选择，当前验证脚本确认共有 114 个声音。

### 语音转文字

接口：

```text
POST /v1/audio/transcriptions
```

请求示例：

```bash
curl -X POST "https://your-worker.example.com/v1/audio/transcriptions" \
  -F "file=@audio.mp3" \
  -F "token=your-siliconflow-token"
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
| `file` | File | 是 | 音频文件，最大 10MB |
| `token` | string | 否 | SiliconFlow API Token。不传时使用代码内置默认 Token |

支持格式：

```text
mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp
```

公开部署时建议改成自己的 SiliconFlow Token，并避免把私有 Token 暴露在公开仓库里。

## 前端使用

打开 Worker 首页后，默认进入文字转语音模式。

文字转语音流程：

1. 输入文本，或上传 `.txt` 文件
2. 在右侧声音库中搜索并选择 voice ID
3. 调整语速、音调和风格
4. 点击生成语音
5. 播放或下载生成的 MP3

语音转文字流程：

1. 切换到 Speech to Text
2. 上传音频文件
3. 选择默认 Token 或输入自己的 SiliconFlow Token
4. 点击转录
5. 复制、编辑转录结果，或把文本送回 TTS

## 验证

修改代码后建议执行：

```bash
node --check index.js
node scripts/verify-voices.mjs
node scripts/verify-frontend-redesign.mjs
git diff --check
```

`verify-voices.mjs` 用来确认声音列表数量和结构。`verify-frontend-redesign.mjs` 用来确认新版前端的关键结构、多语言 key 和声音选择入口没有被破坏。

## 注意事项

- Edge TTS 依赖 Microsoft 服务的可用性，网络环境会影响生成成功率
- 长文本会自动拆分再合成，过长内容生成时间会更久
- STT 文件大小限制为 10MB
- 文本文件上传限制为 500KB
- 本项目不需要数据库、KV 或 D1

## 开源协议

本项目使用 MIT License。详见 [LICENSE](LICENSE)。

原版权声明保留在许可证文件中。Fork 后分发或二次开发时，需要保留 MIT License 的版权和许可文本。
