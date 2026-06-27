import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const workerSource = read("../src/worker.js");
const speechSource = read("../src/routes/speech.js");
const transcriptionSource = read("../src/routes/transcriptions.js");
const endpointSource = read("../src/edge/endpoint.js");
const synthesizeSource = read("../src/edge/synthesize.js");
const clientSource = read("../src/frontend/client.js");
const i18nSource = read("../src/frontend/i18n.js");

assert.ok(
  existsSync(new URL("../src/utils/response.js", import.meta.url)),
  "shared JSON/audio response helpers should exist",
);

assert.doesNotMatch(
  transcriptionSource,
  /sk-[a-z0-9]{20,}/i,
  "transcription route must not contain a hard-coded API token",
);

assert.match(
  transcriptionSource,
  /env\.SILICONFLOW_API_KEY/,
  "transcription route should read the default token from Cloudflare env",
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

for (const key of ["status.fileLabel", "error.copyFailed"]) {
  assert.ok(i18nSource.includes(`'${key}'`), `translations should include ${key}`);
}

console.log("Verified code hygiene and fallback cleanup.");
