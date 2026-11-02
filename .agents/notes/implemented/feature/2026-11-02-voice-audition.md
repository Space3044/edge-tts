# Agent Note: 声音库支持点击试听

Status: implemented

## Problem

114 个音色只有名字、地区和一句描述，选之前没法听。要判断「温柔」「清朗」这种描述到底什么感觉，
只能先生成一次完整音频再看结果 —— 试听成本等于做一次正片。

## Decision

每个音色行加一个 ▶ 按钮，点一下用**该音色自己的语言**说一句话，音频来自现有的
`POST /v1/audio/speech`，不新增后端接口。

- **行与按钮分离**：行本身仍是 `role="option"` 的选择目标，试听按钮是行内的独立 `<button>`，
  点它 `stopPropagation`，**不改变当前选择**（试听是浏览行为，不该悄悄改掉选中项）。
  为此行元素从 `<button>` 改成 `<div>` —— button 不能嵌套 button。
- **示例文本按 locale 选**：`zh` / `en` / `ja` / `ko` / `es` / `fr` / `de` / `ru` 各一句
  （`VOICE_PREVIEW_TEXTS`），未知语言退回英文。让中文音色读英文会立刻失真，那不算试听。
- **固定参数**：语速 1.0、音高 0、风格 general。试听是为了横向比较音色，
  跟着滑块走会让两个音色的比较不可比；也因此缓存键只需要 `voiceId`。
- **缓存**：`Map<voiceId, blobURL>`，上限 24 条，超了 `revokeObjectURL` 掉最旧的。
- **单声道播放**：全局一个 `<audio>`、一个 `AbortController`。点下一个会中断上一个请求，
  连点三个只会播最后一个；再点同一个正在播的音色则停止。
- **状态**：请求中 `is-loading`（图标旋转 + `aria-busy`），播放中 `is-playing`（实心强调色），
  结束时由 `ended` 事件复位。

## Alternatives considered

- **点整行即试听**：会把「选择」和「试听」挤在同一个动作上，用户没法只挑不播；
  而且键盘导航（↑↓ 浏览）会变成连续播放。
- **预生成全部 114 条样本**：首屏就要 114 次 TTS 请求，且大部分永远不听；缓存到 R2 又要引入存储与失效策略。
- **试听跟随当前语速/音高/风格**：看起来更「真实」，但比较两个音色时参数不一致，
  反而降低了试听的判断力；真要按参数听，生成一次即可。
- **`<button>` 里嵌 `<button>`**：HTML 非法，浏览器会把嵌套按钮拆开，事件行为不可控。

## Consequences

- 试听会真实调用 TTS，占一次合成；靠缓存把「反复听同一个」压到 0 次。
- 每行多一个 28px 控件，行高从「只有文本」变成两列网格；`grid-template-columns:minmax(0,1fr) auto`
  保证长 voice id 仍然省略而不是把按钮顶出去。
- 试听不改变选中项，所以「听到喜欢的」仍需再点一次行来选中 —— 这是刻意的，避免浏览时误改。
- 移动端没有 hover，`is-playing` 的实心态是唯一的反馈来源，因此状态色必须足够明显。

## Testing

- `scripts/verify-frontend-redesign.mjs`：预览按钮的圆角样式、行内 `voice-preview` 标记、
  `previewVoice` 确实打 `/v1/audio/speech`、`VOICE_PREVIEW_TEXTS` 与 `voicePreview.cache` 存在。
- 浏览器实测（Chrome，本地 8899）：点 ▶ 后 `aria-busy=true` → 约 1 秒后 `is-playing` 且音频时长 2.8s；
  再点一次立刻 `paused`；连点三个不同音色后只有最后一个在播；试听期间
  `#selectedVoiceSummary` 未变化；缓存条数随试听过的音色增长。
