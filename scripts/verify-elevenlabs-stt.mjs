import assert from "node:assert/strict";
import { handleAudioTranscription } from "../src/routes/transcriptions.js";

const originalFetch = globalThis.fetch;
let capturedUrl;
let capturedBody;
let capturedHeaders;

globalThis.fetch = async (url, init) => {
  capturedUrl = String(url);
  capturedBody = init.body;
  capturedHeaders = init.headers;

  return new Response(JSON.stringify({
    text: "",
    words: [
      { text: "Hello" },
      { text: " " },
      { text: "world" },
    ],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

try {
  const formData = new FormData();
  formData.append("file", new File(["audio"], "sample.m4a", { type: "audio/mp4" }));
  formData.append("engine", "elevenlabs");
  formData.append("language", "zho");
  formData.append("tagAudioEvents", "false");

  const request = new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
    method: "POST",
    body: formData,
  });

  const response = await handleAudioTranscription(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.text, "Hello world");
  assert.equal(capturedUrl, "https://api.elevenlabs.io/v1/speech-to-text?allow_unauthenticated=1");
  assert.equal(capturedBody.get("model_id"), "scribe_v2");
  assert.equal(capturedBody.get("diarize"), "true");
  assert.equal(capturedBody.get("tag_audio_events"), "false");
  assert.equal(capturedBody.get("language_code"), "zho");
  assert.equal(capturedBody.get("file").name, "sample.m4a");
  assert.equal(capturedBody.get("file").type, "audio/mp4");
  assert.ok(capturedHeaders["user-agent"], "ElevenLabs request should include a browser-like user agent");
  assert.ok(capturedHeaders["accept-language"], "ElevenLabs request should include accept-language");
  assert.equal(capturedHeaders["accept-encoding"], "gzip, deflate, br, zstd");
  assert.ok(capturedHeaders["X-Forwarded-For"], "ElevenLabs request should include a forwarded IP signal");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Verified ElevenLabs STT transcription flow.");
