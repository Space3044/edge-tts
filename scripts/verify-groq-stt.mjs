import assert from "node:assert/strict";
import { handleAudioTranscription } from "../src/routes/transcriptions.js";

const originalFetch = globalThis.fetch;
const forwarded = { calls: 0, url: "", auth: "", fields: new Map() };

globalThis.fetch = async (url, init) => {
  forwarded.calls += 1;
  forwarded.url = String(url);
  forwarded.auth = init.headers.Authorization;
  forwarded.fields = new Map(init.body.entries());
  return new Response(JSON.stringify({
    text: "Hello Groq.",
    segments: [{ id: 0, start: 0, end: 1.2, text: "Hello Groq.", compression_ratio: 1.1 }],
    words: [
      { word: "Hello", start: 0, end: 0.6 },
      { word: "Groq.", start: 0.7, end: 1.2 }
    ]
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

try {
  const formData = new FormData();
  formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
  formData.append("engine", "groq");
  formData.append("apiKey", "gsk-test-key");
  formData.append("language", "EN");
  formData.append("prompt", "VoiceCraft");
  formData.append("temperature", "0.2");

  const response = await handleAudioTranscription(
    new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
      method: "POST",
      body: formData
    })
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(forwarded.url, "https://api.groq.com/openai/v1/audio/transcriptions");
  assert.equal(forwarded.auth, "Bearer gsk-test-key");
  assert.equal(forwarded.fields.get("model"), "whisper-large-v3-turbo");
  assert.equal(forwarded.fields.get("language"), "en");
  assert.equal(forwarded.fields.get("prompt"), "VoiceCraft");
  assert.equal(forwarded.fields.get("temperature"), "0.2");
  assert.equal(forwarded.fields.get("response_format"), "verbose_json");
  assert.equal(forwarded.fields.get("timestamp_granularities[]"), "word");
  assert.deepEqual(body.sentences, [
    { text: "Hello Groq.", start: 0, end: 1.2, duration: 1.2 }
  ]);
  assert.deepEqual(body.words.map(word => word.text), ["Hello", "Groq."]);
} finally {
  globalThis.fetch = originalFetch;
}

// Groq accepts a public URL directly. The Worker validates it but must not
// download it first; only the upstream Groq request should be observed.
{
  let calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ text: "URL transcription" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const formData = new FormData();
    formData.append("source_url", "https://cdn.example.com/audio.mp3?sig=abc");
    formData.append("engine", "groq");
    formData.append("apiKey", "gsk-test-key");
    formData.append("timestamps", "false");

    const response = await handleAudioTranscription(
      new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
        method: "POST",
        body: formData
      })
    );
    const body = await response.json();
    const upstreamBody = calls[0]?.init?.body;
    assert.equal(response.status, 200);
    assert.equal(body.text, "URL transcription");
    assert.equal(calls.length, 1, "Groq URL mode should not trigger a Worker-side download");
    assert.equal(calls[0].url, "https://api.groq.com/openai/v1/audio/transcriptions");
    assert.equal(upstreamBody.get("url"), "https://cdn.example.com/audio.mp3?sig=abc");
    assert.equal(upstreamBody.has("file"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Groq always requires an API key; fail before making an upstream request.
{
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("engine", "groq");

    const response = await handleAudioTranscription(
      new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
        method: "POST",
        body: formData
      })
    );
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.error.code, "groq_not_configured");
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log("Verified Groq Whisper transcription flow.");
