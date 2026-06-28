import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const workerSource = read("../src/worker.js");
const speechSource = read("../src/routes/speech.js");
const transcriptionSource = read("../src/routes/transcriptions.js");
const elevenLabsSttSource = read("../src/elevenlabs/stt.js");
const endpointSource = read("../src/edge/endpoint.js");
const synthesizeSource = read("../src/edge/synthesize.js");
const pageSource = read("../src/frontend/page.js");
const clientSource = read("../src/frontend/client.js");
const i18nSource = read("../src/frontend/i18n.js");
const transcriptionBundle = [transcriptionSource, pageSource, clientSource, i18nSource].join("\n");

assert.ok(
  existsSync(new URL("../src/utils/response.js", import.meta.url)),
  "shared JSON/audio response helpers should exist",
);

assert.doesNotMatch(
  transcriptionBundle,
  /siliconflow|SILICONFLOW|api\.siliconflow\.cn|FunAudioLLM|SenseVoiceSmall|sk-[a-z0-9]{20,}/i,
  "transcription flow must not contain SiliconFlow integration or token defaults",
);

assert.doesNotMatch(
  transcriptionBundle,
  /tokenInput|tokenOption|token\.title|token\.default|token\.custom|token\.placeholder|API Token|Bearer \$\{token\}/,
  "Whisper ASR transcription flow should not keep token UI or token forwarding",
);

assert.doesNotMatch(
  transcriptionSource,
  /env\.[A-Z0-9_]+|WHISPER_ASR_BASE_URL|SILICONFLOW_API_KEY/,
  "Whisper ASR endpoint should be supplied by the frontend, not Cloudflare env",
);

assert.match(
  transcriptionSource,
  /audio_file/,
  "Whisper ASR proxy should forward the file as audio_file",
);

assert.match(
  transcriptionSource,
  /\/asr/,
  "Whisper ASR proxy should call the /asr endpoint",
);

assert.match(
  transcriptionSource,
  /searchParams\.set\("output", "json"\)/,
  "Whisper ASR proxy should request JSON output",
);

assert.match(
  transcriptionSource,
  /endpoint|whisper/i,
  "transcription route should accept a frontend-supplied Whisper endpoint",
);

assert.match(
  pageSource + clientSource,
  /whisperEndpoint|WHISPER ASR|Whisper ASR/i,
  "frontend should expose a Whisper ASR endpoint input",
);

assert.match(
  transcriptionSource,
  /MAX_AUDIO_FILE_SIZE\s*=\s*50\s*\*\s*1024\s*\*\s*1024/,
  "transcription route should enforce a 50MB audio upload limit",
);

assert.match(
  clientSource,
  /file\.size\s*>\s*50\s*\*\s*1024\s*\*\s*1024/,
  "frontend audio upload guard should match the 50MB backend limit",
);

assert.match(
  i18nSource,
  /50MB|50 MB/,
  "frontend translations should tell users the 50MB audio upload limit",
);

assert.doesNotMatch(
  transcriptionBundle,
  /10MB|10 MB|10\s*\*\s*1024\s*\*\s*1024/,
  "transcription flow should not keep the previous 10MB audio upload limit",
);

assert.match(
  clientSource,
  /WHISPER_ENDPOINT_STORAGE_KEY|voicecraft-whisper-endpoint|loadWhisperEndpoint|saveWhisperEndpoint/,
  "frontend should persist the Whisper ASR endpoint in local browser storage",
);

assert.match(
  transcriptionSource,
  /engine === "elevenlabs"/,
  "transcription route should dispatch ElevenLabs requests by engine",
);

assert.match(
  elevenLabsSttSource,
  /api\.elevenlabs\.io\/v1\/speech-to-text/,
  "ElevenLabs STT client should target the speech-to-text API",
);

assert.match(
  elevenLabsSttSource,
  /allow_unauthenticated/,
  "ElevenLabs STT client should preserve the unauthenticated Scribe request parameter",
);

assert.doesNotMatch(
  transcriptionSource,
  /ELEVENLABS_LANGUAGE_CODE_MAP|normalizeElevenLabsLanguageCode|en:\s*"eng"|zh:\s*"zho"/,
  "ElevenLabs language handling should not keep legacy two-letter compatibility mapping",
);

assert.doesNotMatch(
  endpointSource,
  /使用过期的缓存token|return tokenInfo\.endpoint;\s*\}\s*throw error;/,
  "endpoint refresh failures should not silently fall back to expired cached tokens",
);

assert.doesNotMatch(
  workerSource,
  /path === "\/v1\/audio\/transcriptions"[\s\S]*?try\s*\{/,
  "worker should not wrap transcription errors that the route already handles",
);

assert.equal(
  (speechSource.match(/parseFloat\(speed\)/g) || []).length,
  1,
  "speech speed conversion should be centralized",
);

assert.match(
  speechSource,
  /formatSpeechOptions/,
  "speech route should use a shared formatter for rate, pitch, and volume",
);

assert.doesNotMatch(
  synthesizeSource,
  /return new Response\(JSON\.stringify/,
  "edge synthesis should not build HTTP error responses",
);

assert.doesNotMatch(
  synthesizeSource,
  /includes\(['"]fetch['"]\)|includes\(['"]network['"]\)/,
  "retry logic should not classify network errors through message string matching",
);

assert.doesNotMatch(
  synthesizeSource,
  /catch \(error\) \{\s*console\.error\([^}]*?throw error;/s,
  "synthesis should not log and rethrow the same error at multiple levels",
);

assert.doesNotMatch(
  clientSource,
  /currentMode/,
  "frontend should not keep unused currentMode state",
);

for (const key of ["status.fileLabel", "error.copyFailed", "stt.endpoint", "stt.endpointPlaceholder", "stt.endpointHint", "error.endpointRequired"]) {
  assert.ok(i18nSource.includes(`'${key}'`), `translations should include ${key}`);
}

console.log("Verified code hygiene and Whisper ASR transcription flow.");
