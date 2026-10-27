import assert from "node:assert/strict";
import { handleAudioTranscription } from "../src/routes/transcriptions.js";

const originalFetch = globalThis.fetch;
let calls = [];

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

globalThis.fetch = async (url, init) => {
  const href = String(url);
  calls.push({ url: href, init });

  if (href === "https://audio.example.com/episode.mp3") {
    return new Response(new Blob(["audio"], { type: "audio/mpeg" }), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" }
    });
  }
  if (href === "https://generativelanguage.googleapis.com/upload/v1beta/files") {
    return new Response(null, {
      status: 200,
      headers: { "x-goog-upload-url": "https://upload.example.com/files/1" }
    });
  }
  if (href === "https://upload.example.com/files/1") {
    return json({ file: { name: "files/abc", uri: "https://files.example.com/abc", mimeType: "audio/mpeg" } });
  }
  if (href === "https://generativelanguage.googleapis.com/v1beta/interactions") {
    return json({
      output_text: "Hello world.",
      steps: [
        {
          content: [
            {
              annotations: [
                { type: "word_info", text: "Hello", speaker: "spk_1", start_offset: "0.100s", end_offset: "0.400s" },
                { type: "word_info", text: "world", speaker: "spk_1", start_offset: "0.500s", end_offset: "0.900s" },
                { type: "word_info", text: ".", speaker: "spk_1", start_offset: "0.900s", end_offset: "0.950s" }
              ]
            }
          ]
        }
      ]
    });
  }
  return new Response("not found", { status: 404 });
};

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

function request(data) {
  return new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
    method: "POST",
    body: data
  });
}

try {
  let response = await handleAudioTranscription(
    request(form({ engine: "google", file: new File(["audio"], "sample.mp3", { type: "audio/mpeg" }) })),
    { GEMINI_API_KEY: "google-key" }
  );
  let body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.text, "Hello world.");
  assert.deepEqual(body.words.map((word) => [word.text, word.start, word.end, word.type]), [
    ["Hello", 0.1, 0.4, "word"],
    ["world", 0.5, 0.9, "word"],
    [".", 0.9, 0.95, "word"]
  ]);
  assert.equal(body.sentences[0].text, "Hello world.");

  const start = calls.find((call) => call.url.endsWith("/upload/v1beta/files"));
  assert.equal(start.init.headers["X-Goog-Upload-Protocol"], "resumable");
  assert.equal(start.init.headers["X-Goog-Upload-Command"], "start");
  assert.equal(start.init.headers["x-goog-api-key"], "google-key");
  assert.equal(start.init.headers["X-Goog-Upload-Header-Content-Length"], "5");

  const interaction = calls.find((call) => call.url.endsWith("/v1beta/interactions"));
  const interactionBody = JSON.parse(interaction.init.body);
  assert.equal(interactionBody.model, "gemini-3.5-transcribe");
  assert.equal(interactionBody.input[0].uri, "https://files.example.com/abc");
  assert.deepEqual(interactionBody.generation_config.transcription_config.mode, {
    type: "verbatim",
    timestamp_granularities: ["word"]
  });

  calls = [];
  response = await handleAudioTranscription(
    request(form({ engine: "google", source_url: "https://audio.example.com/episode.mp3" })),
    { GEMINI_API_KEY: "google-key" }
  );
  body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(calls.some((call) => call.url === "https://audio.example.com/episode.mp3"));
  assert.ok(calls.some((call) => call.url.endsWith("/upload/v1beta/files")));

  response = await handleAudioTranscription(
    request(form({ engine: "google", source_url: "https://audio.example.com/episode.mp3" })),
    {}
  );
  body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.error.code, "google_not_configured");

  console.log("Verified Google Gemini 3.5 Transcribe flow.");
} finally {
  globalThis.fetch = originalFetch;
}
