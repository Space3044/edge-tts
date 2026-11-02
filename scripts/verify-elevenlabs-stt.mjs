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
      { text: "Hello", start: 0, end: 0.3, type: "word" },
      { text: " ", type: "spacing" },
      { text: "world", start: 0.35, end: 0.7, type: "word" },
      { text: ".", start: 0.7, end: 0.75, type: "punctuation" },
      { text: " ", type: "spacing" },
      { text: "Next", start: 1.2, end: 1.5, type: "word" },
      { text: " line", start: 1.55, end: 1.9, type: "word" },
      { text: ".", start: 1.9, end: 1.95, type: "punctuation" },
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
  formData.append("diarize", "false");
  formData.append("numSpeakers", "3");
  formData.append("timestampsGranularity", "character");

  const request = new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
    method: "POST",
    body: formData,
  });

  const response = await handleAudioTranscription(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.text, "Hello world. Next line.");
  assert.deepEqual(body.sentences, [
    { text: "Hello world.", start: 0, end: 0.75, duration: 0.75 },
    { text: "Next line.", start: 1.2, end: 1.95, duration: 0.75 },
  ]);
  assert.deepEqual(body.words, [
    { text: "Hello", start: 0, end: 0.3, duration: 0.3, type: "word" },
    { text: " ", start: null, end: null, duration: null, type: "spacing" },
    { text: "world", start: 0.35, end: 0.7, duration: 0.35, type: "word" },
    { text: ".", start: 0.7, end: 0.75, duration: 0.05, type: "punctuation" },
    { text: " ", start: null, end: null, duration: null, type: "spacing" },
    { text: "Next", start: 1.2, end: 1.5, duration: 0.3, type: "word" },
    { text: " line", start: 1.55, end: 1.9, duration: 0.35, type: "word" },
    { text: ".", start: 1.9, end: 1.95, duration: 0.05, type: "punctuation" },
  ]);
  assert.equal(capturedUrl, "https://api.elevenlabs.io/v1/speech-to-text?allow_unauthenticated=1");
  assert.equal(capturedBody.get("model_id"), "scribe_v2");
  assert.equal(capturedBody.get("diarize"), "false", "diarize is now a switch, not a hardcoded true");
  assert.equal(capturedBody.get("num_speakers"), "3");
  assert.equal(capturedBody.get("timestamps_granularity"), "character");
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

// Invalid option values are rejected before anything is sent upstream.
{
  const originalFetch2 = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const cases = [
      { field: "numSpeakers", value: "0", code: "invalid_num_speakers" },
      { field: "numSpeakers", value: "99", code: "invalid_num_speakers" },
      { field: "timestampsGranularity", value: "sentence", code: "invalid_timestamp_granularity" },
    ];
    for (const testCase of cases) {
      const formData = new FormData();
      formData.append("file", new File(["audio"], "sample.m4a", { type: "audio/mp4" }));
      formData.append("engine", "elevenlabs");
      formData.append(testCase.field, testCase.value);
      const response = await handleAudioTranscription(
        new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData })
      );
      assert.equal(response.status, 400, `${testCase.field}=${testCase.value} must be rejected`);
      assert.equal((await response.json()).error.code, testCase.code);
    }
    assert.equal(called, false, "an invalid option must not reach ElevenLabs");
  } finally {
    globalThis.fetch = originalFetch2;
  }
}

console.log("Verified ElevenLabs STT transcription flow.");
