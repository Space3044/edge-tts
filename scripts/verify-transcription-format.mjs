import assert from "node:assert/strict";
import { handleAudioTranscription } from "../src/routes/transcriptions.js";

const openAiResult = {
  task: "transcribe",
  language: "zh",
  segments: [
    { id: 1, start: 0, end: 2.5, text: "第一句", compression_ratio: 1.1 },
    { id: 2, start: 2.5, end: 5, text: "第二句", compression_ratio: 1.2 },
    { id: 3, start: 5, end: 5.1, text: "重复 重复 重复 重复 重复 重复 重复 重复", compression_ratio: 12.0 },
  ],
  text: "第一句第二句重复 重复 重复 重复 重复 重复 重复 重复",
};

async function transcribeWithMockedOpenAi(contentType) {
  const originalFetch = globalThis.fetch;
  let forwardedUrl;
  let forwardedFile;
  let forwardedModel;
  let forwardedAuth;

  globalThis.fetch = async (url, init) => {
    forwardedUrl = String(url);
    forwardedFile = init.body.get("file");
    forwardedModel = init.body.get("model");
    forwardedAuth = init.headers.Authorization;
    return new Response(JSON.stringify(openAiResult), {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  };

  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("endpoint", "https://asr.example.com/v1/");
    formData.append("model", "whisper-1");
    formData.append("apiKey", "sk-test");

    const request = new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
      method: "POST",
      body: formData,
    });

    const response = await handleAudioTranscription(request);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.text, "第一句\n第二句");
    assert.equal(forwardedUrl, "https://asr.example.com/v1/audio/transcriptions");
    assert.equal(forwardedFile.name, "sample.mp3");
    assert.equal(forwardedModel, "whisper-1");
    assert.equal(forwardedAuth, "Bearer sk-test");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await transcribeWithMockedOpenAi("application/json");
await transcribeWithMockedOpenAi("text/plain; charset=utf-8");

// `engine=whisper` must keep working as an alias for the renamed openai engine.
{
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response(JSON.stringify({ text: "alias ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("engine", "whisper");
    formData.append("endpoint", "https://asr.example.com/v1");

    const response = await handleAudioTranscription(
      new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
        method: "POST",
        body: formData,
      })
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.text, "alias ok");
    assert.ok(called, "engine=whisper should route to the openai handler");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// A base URL without a path must not produce a double slash.
{
  const originalFetch = globalThis.fetch;
  let forwardedUrl;
  globalThis.fetch = async (url) => {
    forwardedUrl = String(url);
    return new Response(JSON.stringify({ text: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("endpoint", "https://asr.example.com");

    await handleAudioTranscription(
      new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
        method: "POST",
        body: formData,
      })
    );
    assert.equal(forwardedUrl, "https://asr.example.com/audio/transcriptions");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Removed/unknown engines are refused instead of silently running OpenAI.
{
  const formData = new FormData();
  formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
  formData.append("engine", "microsoft");

  const response = await handleAudioTranscription(
    new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
      method: "POST",
      body: formData,
    })
  );
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "unknown_engine");
}

// OpenAI advanced options: language / prompt / temperature, and the
// verbose_json contract that finally gives this engine word timings.
{
  const originalFetch = globalThis.fetch;
  const sent = new Map();
  globalThis.fetch = async (url, init) => {
    for (const [key, value] of init.body.entries()) sent.set(key, value);
    return new Response(JSON.stringify({
      text: "Hello world.",
      segments: [{ id: 1, start: 0, end: 1.5, text: "Hello world.", compression_ratio: 1.1 }],
      words: [
        { word: "Hello", start: 0, end: 0.6 },
        { word: "world.", start: 0.7, end: 1.5 }
      ]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("endpoint", "https://asr.example.com/v1");
    formData.append("model", "whisper-1");
    formData.append("language", "EN");
    formData.append("prompt", "Trancy, VoiceCraft");
    formData.append("temperature", "0.2");
    formData.append("timestamps", "true");

    const response = await handleAudioTranscription(
      new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData })
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(sent.get("language"), "en", "language is lowercased and forwarded");
    assert.equal(sent.get("prompt"), "Trancy, VoiceCraft");
    assert.equal(sent.get("temperature"), "0.2");
    assert.equal(sent.get("response_format"), "verbose_json", "whisper gets verbose_json for timings");
    assert.equal(sent.get("timestamp_granularities[]"), "word");
    assert.deepEqual(body.sentences, [
      { text: "Hello world.", start: 0, end: 1.5, duration: 1.5 }
    ]);
    assert.deepEqual(body.words.map(word => word.text), ["Hello", "world."]);
    assert.equal(body.words[0].type, "word");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// The gpt-4o-transcribe family does not accept verbose_json, so the handler must
// fall back to `json` and return text only.
{
  const originalFetch = globalThis.fetch;
  const sent = new Map();
  globalThis.fetch = async (url, init) => {
    for (const [key, value] of init.body.entries()) sent.set(key, value);
    return new Response(JSON.stringify({ text: "plain" }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("endpoint", "https://asr.example.com/v1");
    formData.append("model", "gpt-4o-transcribe");

    const response = await handleAudioTranscription(
      new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData })
    );
    const body = await response.json();

    assert.equal(sent.get("response_format"), "json");
    assert.equal(sent.has("timestamp_granularities[]"), false);
    assert.deepEqual(body, { text: "plain" });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Out-of-range options are rejected before the request leaves the Worker.
{
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const cases = [
      { field: "temperature", value: "1.5", code: "invalid_temperature" },
      { field: "language", value: "english", code: "invalid_language" },
      { field: "prompt", value: "x".repeat(1001), code: "invalid_prompt" },
    ];
    for (const testCase of cases) {
      const formData = new FormData();
      formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
      formData.append("endpoint", "https://asr.example.com/v1");
      formData.append("model", "whisper-1");
      formData.append(testCase.field, testCase.value);
      const response = await handleAudioTranscription(
        new Request("https://voicecraft.example.com/v1/audio/transcriptions", { method: "POST", body: formData })
      );
      assert.equal(response.status, 400, `${testCase.field}=${testCase.value} must be rejected`);
      assert.equal((await response.json()).error.code, testCase.code);
    }
    assert.equal(called, false, "invalid options must not reach the provider");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log("Verified readable OpenAI transcription formatting.");
