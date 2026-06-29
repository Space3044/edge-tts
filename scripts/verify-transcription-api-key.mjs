import assert from "node:assert/strict";
import { handleAudioTranscription } from "../src/routes/transcriptions.js";
import { handleOptions } from "../src/utils/cors.js";

const ENV = { TRANSCRIPTION_API_KEY: "worker-secret" };
const whisperResult = { text: "ok" };

function makeFormData() {
  const formData = new FormData();
  formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
  formData.append("engine", "whisper");
  formData.append("endpoint", "https://whisper.example.com");
  return formData;
}

function makeRequest(headers = {}) {
  return new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
    method: "POST",
    headers,
    body: makeFormData(),
  });
}

async function readErrorCode(response) {
  const body = await response.json();
  return body.error?.code;
}

const missingKeyResponse = await handleAudioTranscription(makeRequest(), ENV);
assert.equal(missingKeyResponse.status, 401);
assert.equal(await readErrorCode(missingKeyResponse), "invalid_api_key");

const wrongKeyResponse = await handleAudioTranscription(makeRequest({ "x-api-key": "wrong" }), ENV);
assert.equal(wrongKeyResponse.status, 401);
assert.equal(await readErrorCode(wrongKeyResponse), "invalid_api_key");

const originalFetch = globalThis.fetch;
let forwardedCount = 0;

globalThis.fetch = async () => {
  forwardedCount += 1;
  return new Response(JSON.stringify(whisperResult), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

try {
  const validKeyResponse = await handleAudioTranscription(makeRequest({ "x-api-key": "worker-secret" }), ENV);
  assert.equal(validKeyResponse.status, 200);
  assert.equal((await validKeyResponse.json()).text, "ok");

  const accessResponse = await handleAudioTranscription(makeRequest({
    "Cf-Access-Authenticated-User-Email": "user@example.com",
  }), ENV);
  assert.equal(accessResponse.status, 200);
  assert.equal((await accessResponse.json()).text, "ok");

  assert.equal(forwardedCount, 2);
} finally {
  globalThis.fetch = originalFetch;
}

const optionsResponse = await handleOptions(new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
  method: "OPTIONS",
  headers: { "Access-Control-Request-Headers": "content-type,x-api-key" },
}));
assert.equal(optionsResponse.headers.get("Access-Control-Allow-Headers"), "content-type,x-api-key");

const defaultOptionsResponse = await handleOptions(new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
  method: "OPTIONS",
}));
assert.equal(defaultOptionsResponse.headers.get("Access-Control-Allow-Headers"), "Content-Type, x-api-key");

console.log("Verified transcription API key authentication.");
