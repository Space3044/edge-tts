import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../index.js", import.meta.url), "utf8");

const voiceBlockMatch = source.match(/const VOICES = (?<voices>\[[\s\S]*?\]);/);
assert.ok(voiceBlockMatch, "VOICES data should exist");

const voiceMatches = [
  ...voiceBlockMatch.groups.voices.matchAll(
    /\{\s*id: "([^"]+Neural)",\s*name: "([^"]+)",\s*locale: "([^"]+)",\s*language: "([^"]+)",\s*gender: "([^"]+)",\s*description: "([^"]*)"\s*\}/g,
  ),
];

const voices = voiceMatches.map((match) => ({
  id: match[1],
  name: match[2],
  locale: match[3],
  language: match[4],
  gender: match[5],
  description: match[6],
}));

const voiceIds = voices.map((voice) => voice.id);
const uniqueVoiceIds = new Set(voiceIds);

assert.equal(voices.length, 114, "VOICES should include all upstream voices");
assert.equal(uniqueVoiceIds.size, voices.length, "voice IDs should be unique");

assert.deepEqual(voices[0], {
  id: "zh-CN-XiaoxiaoNeural",
  name: "晓晓 Xiaoxiao",
  locale: "zh-CN",
  language: "Chinese",
  gender: "Female",
  description: "温柔",
});

for (const voiceId of [
  "en-US-JennyNeural",
  "en-GB-SoniaNeural",
  "ja-JP-NanamiNeural",
  "ko-KR-SunHiNeural",
  "fr-FR-DeniseNeural",
  "de-DE-KatjaNeural",
  "es-MX-DaliaNeural",
  "ru-RU-DariyaNeural",
]) {
  assert.ok(uniqueVoiceIds.has(voiceId), `${voiceId} should be selectable`);
}

assert.match(source, /const voice = getSelectedVoiceId\(\);/);
assert.match(source, /voice:\s*voice,/);
assert.match(source, /formData\.append\('voice', voice\);/);
assert.match(source, /<voice name="\$\{voiceName\}">/);
assert.match(source, /114 Voice Options|114 voices/);

console.log(`Verified ${voices.length} selectable Edge TTS voices.`);