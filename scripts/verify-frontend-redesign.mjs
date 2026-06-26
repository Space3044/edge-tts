import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../index.js", import.meta.url), "utf8");

const requiredMarkup = [
  'class="app-shell"',
  'class="workspace-grid"',
  'class="input-panel"',
  'class="voice-panel"',
  'id="voiceSearch"',
  'id="voiceList"',
  'id="selectedVoiceId"',
  'id="voiceLanguageFilters"',
  'id="voiceGenderFilters"',
  'id="ttsForm"',
  'id="transcriptionForm"',
  'id="result"',
  'id="transcriptionResult"',
  'data-i18n="tts.title"',
  'data-i18n="input.method"',
  'data-i18n="voice.title"',
  'data-i18n="stt.title"',
  'data-i18n="token.title"',
  'data-i18n="action.generate"',
  'data-i18n="action.transcribe"',
];

for (const marker of requiredMarkup) {
  assert.ok(source.includes(marker), `missing required UI marker: ${marker}`);
}

const requiredFunctions = [
  "const VOICES = [",
  "function renderVoiceList(",
  "function filterVoices(",
  "function selectVoice(",
  "function initializeVoicePicker(",
  "function initializeVoiceKeyboard(",
  "function initializeTextCounter(",
  "function updateTextCounter(",
  "function showToast(",
  "function getSelectedVoiceId(",
  "const CONFIG =",
  "let voiceSearchTimer",
];

for (const marker of requiredFunctions) {
  assert.ok(source.includes(marker), `missing required function marker: ${marker}`);
}

const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 2, "page should include the theme script and the main interaction script");
for (const [index, script] of scripts.entries()) {
  assert.doesNotThrow(
    () => new Function(script[1]),
    `inline script ${index + 1} should parse successfully`,
  );
}

assert.match(
  source,
  /const voice = getSelectedVoiceId\(\);/,
  "TTS submit should read the selected voice through getSelectedVoiceId()",
);

assert.doesNotMatch(
  source,
  /<select class="form-select" id="voice">[\s\S]*?<option value=/,
  "the visible long voice select should be replaced by the new picker",
);

assert.ok(
  !source.includes('class="header"') || !source.includes('class="features"'),
  "the old large promotional header should not remain as the primary shell",
);

const translationsMatch = source.match(/const translations = (?<translations>\{[\s\S]*?\});/);
assert.ok(translationsMatch, "translations object should exist");

const translationsSource = translationsMatch.groups.translations;
for (const lang of ["en", "zh", "ja", "ko", "es", "fr", "de", "ru"]) {
  assert.match(
    translationsSource,
    new RegExp(`(^|[,{])\\s*${lang}\\s*:`),
    `translations should include ${lang}`,
  );
}

for (const key of [
  "tts.title",
  "input.method",
  "voice.title",
  "voice.search",
  "stt.title",
  "token.title",
  "action.generate",
  "action.transcribe",
]) {
  assert.ok(translationsSource.includes(`'${key}'`), `translations should include ${key}`);
}

console.log("Verified VoiceCraft redesign structure.");
