import assert from "node:assert/strict";
import { handleAudioTranscription } from "../src/routes/transcriptions.js";

const AUDIO_BYTES = new Uint8Array([1, 2, 3, 4]);
const SOURCE_URL = "https://cdn.example.com/audio.mp3";
const REDIRECT_URL = "https://cdn2.example.com/real.mp3";
const WHISPER_ENDPOINT = "https://whisper.example.com";

const originalFetch = globalThis.fetch;
let calls = [];
let redirectSource = false;
let sourceTooLarge = false;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function audioResponse() {
  return new Response(new Blob([AUDIO_BYTES], { type: "audio/mpeg" }), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": sourceTooLarge ? String(51 * 1024 * 1024) : String(AUDIO_BYTES.length)
    }
  });
}

globalThis.fetch = async (url, init) => {
  const href = String(url);
  calls.push({ url: href, init });

  if (href === SOURCE_URL) {
    if (sourceTooLarge) return audioResponse();
    if (redirectSource) {
      return new Response(null, {
        status: 302,
        headers: { Location: REDIRECT_URL }
      });
    }
    return audioResponse();
  }
  if (href === REDIRECT_URL) return audioResponse();

  if (href.includes("api.elevenlabs.io/v1/speech-to-text")) {
    return json({
      text: "",
      words: [
        { text: "Hello", start: 0, end: 0.3, type: "word" },
        { text: " ", type: "spacing" },
        { text: "world", start: 0.35, end: 0.7, type: "word" },
        { text: ".", start: 0.7, end: 0.75, type: "punctuation" }
      ]
    });
  }

  if (href.includes("whisper.example.com/asr")) {
    return json({
      text: "Hello world.",
      segments: [{ start: 0, end: 1.2, text: "Hello world.", compression_ratio: 1.1 }]
    });
  }

  throw new Error(`unexpected fetch: ${href}`);
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

function reset() {
  calls = [];
  redirectSource = false;
  sourceTooLarge = false;
}

try {
  reset();
  let response = await handleAudioTranscription(
    request(form({ source_url: SOURCE_URL, engine: "elevenlabs" }))
  );
  let body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.text, "Hello world.");
  assert.equal(body.words.length, 4);
  const elevenLabsCall = calls.find((call) => call.url.includes("api.elevenlabs.io"));
  assert.ok(elevenLabsCall, "ElevenLabs should be called");
  const elevenLabsBody = elevenLabsCall.init.body;
  assert.equal(elevenLabsBody.get("source_url"), SOURCE_URL);
  assert.equal(elevenLabsBody.get("file"), null);
  assert.equal(calls.some((call) => call.url === SOURCE_URL), false, "ElevenLabs URL mode should not download the audio");

  reset();
  response = await handleAudioTranscription(
    request(form({ source_url: SOURCE_URL, engine: "whisper", endpoint: WHISPER_ENDPOINT }))
  );
  body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.text, "Hello world.");
  const sourceCall = calls.find((call) => call.url === SOURCE_URL);
  assert.ok(sourceCall, "Whisper URL mode should download the source");
  assert.equal(sourceCall.init.redirect, "manual");
  const whisperCall = calls.find((call) => call.url.includes("whisper.example.com/asr"));
  assert.ok(whisperCall, "Whisper ASR should be called");
  const whisperFile = whisperCall.init.body.get("audio_file");
  assert.equal(whisperFile.name, "audio.mp3");
  assert.equal(whisperFile.size, AUDIO_BYTES.length);

  reset();
  redirectSource = true;
  response = await handleAudioTranscription(
    request(form({ source_url: SOURCE_URL, engine: "whisper", endpoint: WHISPER_ENDPOINT }))
  );
  body = await response.json();
  assert.equal(response.status, 200);
  assert.ok(calls.some((call) => call.url === REDIRECT_URL), "manual redirects should be followed");

  for (const privateUrl of ["http://127.0.0.1/audio.mp3", "http://[::1]/audio.mp3", "http://[::ffff:7f00:1]/audio.mp3", "http://169.254.169.254/audio.mp3"]) {
    reset();
    response = await handleAudioTranscription(
      request(form({ source_url: privateUrl, engine: "whisper", endpoint: WHISPER_ENDPOINT }))
    );
    body = await response.json();
    assert.equal(response.status, 400, privateUrl);
    assert.equal(body.error.code, "invalid_source_url", privateUrl);
    assert.equal(calls.length, 0, `private URL should be rejected before fetching: ${privateUrl}`);
  }

  reset();
  response = await handleAudioTranscription(request(form({ engine: "whisper", endpoint: WHISPER_ENDPOINT })));
  body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "missing_audio");

  reset();
  sourceTooLarge = true;
  response = await handleAudioTranscription(
    request(form({ source_url: SOURCE_URL, engine: "whisper", endpoint: WHISPER_ENDPOINT }))
  );
  body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "source_too_large");

  console.log("Verified audio URL transcription for ElevenLabs and Whisper.");
} finally {
  globalThis.fetch = originalFetch;
}
