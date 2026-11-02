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

// The reserved Microsoft (Azure AI Speech) engine must answer with a clear
// placeholder error instead of silently running the OpenAI path.
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
  assert.equal(response.status, 501);
  assert.equal(body.error.code, "engine_not_implemented");
  assert.equal(body.error.param, "engine");
}

console.log("Verified readable OpenAI transcription formatting.");
