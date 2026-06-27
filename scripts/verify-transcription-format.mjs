import assert from "node:assert/strict";
import { handleAudioTranscription } from "../src/routes/transcriptions.js";

const whisperResult = {
  language: "zh",
  segments: [
    { id: 1, start: 0, end: 2.5, text: "第一句", compression_ratio: 1.1 },
    { id: 2, start: 2.5, end: 5, text: "第二句", compression_ratio: 1.2 },
    { id: 3, start: 5, end: 5.1, text: "重复 重复 重复 重复 重复 重复 重复 重复", compression_ratio: 12.0 },
  ],
  text: "第一句第二句重复 重复 重复 重复 重复 重复 重复 重复",
};

async function transcribeWithMockedWhisper(contentType) {
  const originalFetch = globalThis.fetch;
  let forwardedUrl;
  let forwardedFile;

  globalThis.fetch = async (url, init) => {
    forwardedUrl = String(url);
    forwardedFile = init.body.get("audio_file");
    return new Response(JSON.stringify(whisperResult), {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  };

  try {
    const formData = new FormData();
    formData.append("file", new File(["audio"], "sample.mp3", { type: "audio/mpeg" }));
    formData.append("endpoint", "https://whisper.example.com/");

    const request = new Request("https://voicecraft.example.com/v1/audio/transcriptions", {
      method: "POST",
      body: formData,
    });

    const response = await handleAudioTranscription(request);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.text, "第一句\n第二句");
    assert.equal(forwardedUrl, "https://whisper.example.com/asr?output=json&task=transcribe&encode=true");
    assert.equal(forwardedFile.name, "sample.mp3");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await transcribeWithMockedWhisper("application/json");
await transcribeWithMockedWhisper("text/plain; charset=utf-8");

console.log("Verified readable Whisper transcription formatting.");
