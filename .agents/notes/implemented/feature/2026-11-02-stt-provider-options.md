# Agent Note: 转录接口补齐三家的可选参数

Status: implemented

## Problem

`POST /v1/audio/transcriptions` 只转发 `file` / `model` / `response_format=json`，
面板上也只有 ElevenLabs 有两个选项。结果是：

- **OpenAI 引擎拿不到任何时间戳**：`json` 格式没有 `segments`，所以前端的句子/词视图对它不可用，
  而 ElevenLabs / Google 都有；
- **OpenAI 没有 `language` 提示**（准确率和延迟都受影响）、没有 `prompt`（人名、术语、专有名词识别差）、
  没有 `temperature`；
- **ElevenLabs 的 `diarize` 被写死成 `true`**：单人播客也会被强行分说话人；
  说话人数（`num_speakers`）和时间戳粒度（`word` / `character`）完全没暴露。

## Decision

把三家真正有用、且我们确定契约的字段做成**可选 form 字段**，不传就是原来的行为，
面板上按引擎显示对应的一组控件，并记住上一次的选择。

### OpenAI

- `language`（ISO-639-1 两字母，校验后小写）、`prompt`（≤1000 字符）、`temperature`（0–1）。
- `timestamps`（默认 `true`）决定要不要词级时间戳。**格式按模型选**：
  模型名含 `whisper` 时发 `response_format=verbose_json` + `timestamp_granularities[]=word`，
  响应解析成 `{text, sentences, words}`（`segments` → sentences，`words` → 词项，
  形状与 ElevenLabs 一致，前端不用改渲染逻辑）；
  `gpt-4o-transcribe` 这类只支持 `json`/`text` 的模型自动退回 `json` 并只回 `text`。
  这条不能靠「先试 verbose_json，失败再退」——那会把一次真实转写变成两次计费。

### ElevenLabs

- `diarize`（默认 `true`，保持旧行为）、`numSpeakers`（1–32，留空自动）、
  `timestampsGranularity`（`word` 默认 / `character`），分别映射到
  `diarize` / `num_speakers` / `timestamps_granularity`。

### Google

这次不动。它的 `transcription_config` 是 Gemini 较新的接口，除了已经在用的
`timestamp_granularities: ["word"]` 之外，其它字段（`system_instruction`、`temperature`、
更细的 granularity）没有确认过的契约，宁可不发也不猜。

### 校验

非法值在 Worker 侧直接 400，不浪费一次上游请求：`invalid_language`、`invalid_prompt`、
`invalid_temperature`、`invalid_num_speakers`、`invalid_timestamp_granularity`。
`language=auto` 与空值等价（不发送）。

### 面板

- OpenAI：Language / Temperature / Prompt（跨两列）/ Word timestamps。
- ElevenLabs：Language / Keep sound cues / Speaker labels / Speakers / Timestamp granularity。
- 所有选项存 `localStorage`（`voicecraft-openai-*`、`voicecraft-elevenlabs-*`），
  与既有的引擎、语言记忆方式一致；第一次打开时 `timestamps` 与 `diarize` 默认勾选。

## Alternatives considered

- **OpenAI 一律 `verbose_json`**：`gpt-4o-transcribe` 会直接 400，等于把「换个更便宜的模型」变成故障。
- **`timestamps=true` 时先试 `verbose_json`，失败再退回 `json`**：一次转写成功一次失败，
  上游按两次计费，且失败那次可能已经产生了内容。
- **把 `prompt` 也发给 Google**：Gemini 的转写提示字段名与语义未确认，发了多半是被忽略或报错。
- **不暴露 `diarize`，只加 `numSpeakers`**：说话人数只在开启 diarize 时有意义，
  不给出开关就等于让「单人音频」永远被强行分段。
- **把选项做成 JSON body 而不是 form 字段**：接口是 `multipart/form-data`，
  多一个 `options` JSON 字段会让调用方多拼一层，校验也更绕。

## Consequences

- `response_format` 从恒为 `json` 变成按模型决定，`verify-transcription-url.mjs` 里那条断言随之更新。
- OpenAI 引擎的响应现在可能多出 `sentences` / `words`（只在 verbose_json 分支），
  前端三条视图对三家都可用；调用方如果只读 `text` 不受影响。
- 新增 5 个错误码，都是 400，且都在发请求之前返回。
- 面板多了 7 个控件、13 条 i18n 文案（8 种语言）。
- Google 仍然只有词级时间戳，没有 temperature/prompt——这是明确留的缺口，不是遗漏。

## Testing

- `scripts/verify-transcription-format.mjs`：`language` 小写转发、`prompt`/`temperature` 透传、
  `whisper-1` 得到 `verbose_json` + `timestamp_granularities[]=word` 并返回 `sentences`/`words`、
  `gpt-4o-transcribe` 退回 `json` 且只回 `text`、三个非法值各自 400 且**一次上游请求都没发**。
- `scripts/verify-elevenlabs-stt.mjs`：`diarize=false` / `numSpeakers=3` /
  `timestampsGranularity=character` 正确映射成 `diarize` / `num_speakers` / `timestamps_granularity`；
  越界值返回 400 且不发请求。
- `scripts/verify-transcription-url.mjs`：URL 模式的 OpenAI 请求同样带 `verbose_json`。
- 浏览器：OpenAI / ElevenLabs 两组控件按引擎切换显示，`prompt` 与 `temperature` 填完后刷新仍保留。
