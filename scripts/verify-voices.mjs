import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../index.js", import.meta.url), "utf8");

const selectMatch = source.match(
  /<select class="form-select" id="voice">(?<options>[\s\S]*?)<\/select>/
);

assert.ok(selectMatch, "voice select should exist");

const optionMatches = [
  ...selectMatch.groups.options.matchAll(
    /<option value="(?<value>[^"]+Neural)"(?<attrs>[^>]*)>(?<label>[^<]+)<\/option>/g
  ),
];

const voices = optionMatches.map((match) => ({
  value: match.groups.value,
  label: match.groups.label.trim(),
  attrs: match.groups.attrs,
}));

const voiceIds = voices.map((voice) => voice.value);
const uniqueVoiceIds = new Set(voiceIds);

assert.equal(voices.length, 114, "voice select should include all upstream voices");
assert.equal(uniqueVoiceIds.size, voices.length, "voice values should be unique");

assert.deepEqual(voices[0], {
  value: "zh-CN-XiaoxiaoNeural",
  label: "晓晓 Xiaoxiao (女声·温柔)",
  attrs: " selected",
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

assert.match(source, /const voice = document\.getElementById\('voice'\)\.value;/);
assert.match(source, /voice:\s*voice,/);
assert.match(source, /formData\.append\('voice', voice\);/);
assert.match(source, /<voice name="\$\{voiceName\}">/);
assert.match(source, /90\+ Voice Options/);

console.log(`Verified ${voices.length} selectable Edge TTS voices.`);
