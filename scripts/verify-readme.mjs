import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

assert.match(readme, /https:\/\/edge-tts\.onfoyo\.de5\.net\/?/, "README should show the current online demo URL");
assert.doesNotMatch(readme, /https:\/\/tts\.wangwangit\.com/, "README should not point to the previous online demo URL");
assert.match(readme, /https:\/\/github\.com\/Space3044\/edge-tts/, "README should include the project repository URL");
assert.match(readme, /Whisper ASR/, "README should describe the current Whisper ASR transcription flow");
assert.match(readme, /ElevenLabs/, "README should describe the ElevenLabs transcription flow");
assert.match(readme, /engine=elevenlabs/, "README should include an ElevenLabs transcription request example");
assert.match(readme, /浏览器本地保存/, "README should state that user-entered service settings are stored locally in the browser");
assert.match(readme, /最大 50MB|50MB/, "README should document the 50MB speech-to-text upload limit");
assert.doesNotMatch(readme, /最大 10MB|10MB/, "README should not document the previous 10MB speech-to-text upload limit");
assert.doesNotMatch(readme, /SiliconFlow|SenseVoiceSmall|token=your-siliconflow-token/, "README should not document the removed SiliconFlow transcription flow");
assert.doesNotMatch(readme, /wrangler\.toml` 当前配置|compatibility_flags = \["nodejs_compat"\]/, "manual deployment docs should not include local wrangler.toml configuration blocks");

console.log("Verified README documentation.");
