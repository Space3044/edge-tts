import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const workerSource = read("../src/worker.js");
const speechSource = read("../src/routes/speech.js");
const transcriptionSource = read("../src/routes/transcriptions.js");
const elevenLabsSttSource = read("../src/elevenlabs/stt.js");
const googleSttSource = read("../src/google/stt.js");
const endpointSource = read("../src/edge/endpoint.js");
const synthesizeSource = read("../src/edge/synthesize.js");
const pageSource = read("../src/frontend/page.js");
const clientSource = read("../src/frontend/client.js");
const i18nSource = read("../src/frontend/i18n.js");
const transcriptionBundle = [transcriptionSource, pageSource, clientSource, i18nSource].join("\n");

// A syntax error in the injected client script breaks every DOM handler at
// once, and the failure only shows up in the browser console.
const { CLIENT_SCRIPT } = await import("../src/frontend/client.js");
assert.doesNotThrow(() => new Function(CLIENT_SCRIPT), "the browser client script must parse");


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

assert.match(
  transcriptionSource,
  /resolveProvider\(env, providerName\)/,
  "OpenAI-compatible engines should read endpoint/model/key from the provider store",
);

assert.match(
  transcriptionSource,
  /\/audio\/transcriptions/,
  "the OpenAI engine should call the OpenAI-compatible /audio/transcriptions endpoint",
);

assert.match(
  transcriptionSource,
  /apiFormData\.append\("file", audioBlob, audioName\)/,
  "the OpenAI engine should forward the audio as the OpenAI `file` field",
);

assert.match(
  transcriptionSource,
  /apiFormData\.append\("model", model\)/,
  "the OpenAI engine should forward the configured model",
);

assert.match(
  transcriptionSource,
  /requested === "whisper" \? "openai" : requested/,
  "`engine=whisper` should stay a supported alias for the renamed openai engine",
);

assert.doesNotMatch(
  transcriptionSource,
  /console\.(log|error)\([^)]*(accessToken|apiKey|refreshToken)\b/,
  "provider logs must never include token or key values",
);

assert.match(
  pageSource + clientSource,
  /providerConfig|provider-card|PROVIDER_API_URL/,
  "frontend should expose the provider settings panel",
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

assert.doesNotMatch(
  clientSource,
  /ADMIN_TOKEN_STORAGE_KEY|voicecraft-admin-token|readAdminToken/,
  "the frontend must not hold provider-write credentials; Cloudflare Access decides access",
);

assert.doesNotMatch(
  clientSource,
  /writeMode|payload\.writable|provider\.readOnly/,
  "no client-side write-mode state: Access owns authorisation end to end",
);

assert.doesNotMatch(
  clientSource,
  /voicecraft-whisper-endpoint|WHISPER_ENDPOINT_STORAGE_KEY/,
  "the old browser-stored Whisper endpoint should be gone",
);

assert.doesNotMatch(
  clientSource + pageSource,
  /apiKey:\s*readAdminToken|localStorage\.setItem\([^)]*apiKey/i,
  "API keys must never be persisted in browser storage",
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

// The D1 binding name is a contract with the code: everything reads `env.DB`.
{
  const wranglerToml = read("../wrangler.toml");
  const bindings = [...wranglerToml.matchAll(/^binding\s*=\s*"([^"]+)"/gm)].map(match => match[1]);
  assert.ok(bindings.length > 0, "wrangler.toml should declare a D1 binding");
  for (const binding of bindings) {
    assert.equal(binding, "DB", "the D1 binding must be named DB: the code reads env.DB");
  }
}

assert.doesNotMatch(
  clientSource,
  /currentMode/,
  "frontend should not keep unused currentMode state",
);

for (const key of ["status.fileLabel", "error.copyFailed", "stt.endpoint", "stt.endpointPlaceholder", "stt.endpointHint", "error.endpointRequired", "stt.sourceUrl", "stt.sourceUrlPlaceholder", "stt.sourceUrlHint", "error.audioSourceRequired", "stt.engineOpenai", "stt.engineGoogle", "stt.engineGroq", "provider.title", "provider.hint", "provider.apiKey", "provider.model", "provider.save", "provider.statusDb", "provider.statusNone"]) {
  assert.ok(i18nSource.includes(`'${key}'`), `translations should include ${key}`);
}

assert.match(
  transcriptionSource,
  /source_url|readSourceUrl/,
  "transcription route should accept a source_url for URL-based transcription",
);

assert.match(
  transcriptionSource,
  /missing_audio/,
  "transcription route should distinguish a missing file/URL from an empty upload",
);

assert.match(
  pageSource,
  /audioSourceUrl/,
  "frontend should expose an audio URL input",
);

assert.match(
  clientSource,
  /audioSourceUrl/,
  "frontend should send the audio URL as source_url",
);

assert.match(
  transcriptionSource,
  /engine === "google"/,
  "transcription route should dispatch Google requests by engine",
);

assert.match(
  transcriptionSource,
  /engine === "groq"/,
  "transcription route should dispatch Groq requests by engine",
);

assert.match(
  transcriptionSource,
  /MAX_GROQ_AUDIO_FILE_SIZE\s*=\s*25\s*\*\s*1024\s*\*\s*1024/,
  "Groq transcription should enforce its 25MB upload limit",
);

assert.doesNotMatch(
  transcriptionSource,
  /GEMINI_API_KEY|OPENAI_API_KEY|ELEVENLABS_API_KEY/,
  "provider keys come from D1 only; there is no environment fallback",
);

assert.match(
  googleSttSource,
  /gemini-3\.5-transcribe/,
  "Google STT client should target Gemini 3.5 Transcribe",
);

assert.match(
  pageSource,
  /engineGoogle/,
  "frontend should expose the Google transcription engine",
);

assert.match(
  pageSource,
  /engineGroq/,
  "frontend should expose the Groq transcription engine",
);

console.log("Verified code hygiene and transcription provider flow.");
