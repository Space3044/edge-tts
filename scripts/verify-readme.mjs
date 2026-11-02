import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

assert.match(readme, /https:\/\/edge-tts\.onfoyo\.de5\.net\/?/, "README should show the current online demo URL");
assert.doesNotMatch(readme, /https:\/\/tts\.wangwangit\.com/, "README should not point to the previous online demo URL");
assert.match(readme, /https:\/\/github\.com\/Space3044\/edge-tts/, "README should include the project repository URL");
assert.match(readme, /OpenAI 兼容/, "README should describe the OpenAI-compatible transcription flow");
assert.doesNotMatch(readme, /Whisper ASR 地址/, "README should not describe the removed browser-stored Whisper endpoint");
assert.match(readme, /SECRETS_ENCRYPTION_KEY/, "README should document the API key encryption secret");
assert.match(readme, /ADMIN_TOKEN/, "README should document the admin token guarding provider writes");
assert.match(readme, /provider_config/, "README should document where provider config is stored");
assert.match(readme, /\/api\/providers/, "README should document the provider settings API");
assert.match(readme, /ElevenLabs/, "README should describe the ElevenLabs transcription flow");
assert.match(readme, /engine=elevenlabs/, "README should include an ElevenLabs transcription request example");
assert.match(readme, /gemini-3\.5-transcribe/, "README should describe the Google transcription model");
assert.match(readme, /engine=google/, "README should include a Google transcription request example");
assert.match(readme, /GEMINI_API_KEY/, "README should document the Google API key fallback");
assert.match(readme, /\/tts\b/, "README should document the dedicated text-to-speech page path");
assert.match(readme, /\/transcription\b/, "README should document the dedicated speech-to-text page path");
assert.match(readme, /Cloudflare Access[\s\S]*\/transcription\*[\s\S]*\/v1\/audio\/transcriptions\*/, "README should document protecting transcription with Cloudflare Access");
assert.match(readme, /浏览器本地保存/, "README should state that AI polish settings stay in the browser");
assert.match(readme, /Provider settings/, "README should document the provider settings panel");
assert.match(readme, /最大 50MB|50MB/, "README should document the 50MB speech-to-text upload limit");
assert.doesNotMatch(readme, /最大 10MB|10MB/, "README should not document the previous 10MB speech-to-text upload limit");
assert.doesNotMatch(readme, /SiliconFlow|SenseVoiceSmall|token=your-siliconflow-token/, "README should not document the removed SiliconFlow transcription flow");
assert.doesNotMatch(readme, /wrangler\.toml` 当前配置|compatibility_flags = \["nodejs_compat"\]/, "manual deployment docs should not include local wrangler.toml configuration blocks");

console.log("Verified README documentation.");
