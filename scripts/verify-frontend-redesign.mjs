import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { CLIENT_SCRIPT } from "../src/frontend/client.js";
import { HTML_PAGE } from "../src/frontend/page.js";

const sourceFiles = [
  "../index.js",
  "../src/worker.js",
  "../src/routes/speech.js",
  "../src/routes/transcriptions.js",
  "../src/edge/synthesize.js",
  "../src/edge/ssml.js",
  "../src/frontend/page.js",
  "../src/frontend/styles.js",
  "../src/frontend/client.js",
  "../src/frontend/voices.js",
  "../src/frontend/i18n.js",
  "../src/frontend/favicon.js",
];

const source = [
  HTML_PAGE,
  CLIENT_SCRIPT,
  ...sourceFiles.map((file) => readFileSync(new URL(file, import.meta.url), "utf8")),
].join("\n");

const expectedModuleFiles = [
  "../src/worker.js",
  "../src/routes/speech.js",
  "../src/routes/transcriptions.js",
  "../src/edge/endpoint.js",
  "../src/edge/ssml.js",
  "../src/edge/synthesize.js",
  "../src/edge/signing.js",
  "../src/frontend/page.js",
  "../src/frontend/styles.js",
  "../src/frontend/client.js",
  "../src/frontend/voices.js",
  "../src/frontend/i18n.js",
  "../src/frontend/favicon.js",
  "../src/utils/cors.js",
  "../src/utils/text.js",
];

for (const modulePath of expectedModuleFiles) {
  assert.ok(existsSync(new URL(modulePath, import.meta.url)), `missing module file: ${modulePath}`);
}

assert.match(source, /import\s+worker\s+from\s+["']\.\/src\/worker\.js["'];/);
assert.match(source, /export\s+default\s+worker;/);

const requiredMarkup = [
  'class="app-shell"',
  'rel="icon" href="/favicon.ico?v=voicecraft-20260627"',
  'class="workspace-grid"',
  'class="input-panel"',
  'class="voice-panel"',
  'id="voiceSearch"',
  'id="voiceList"',
  'id="selectedVoiceId"',
  'id="voiceLanguageFilters"',
  'id="voiceGenderFilters"',
  'id="speedValue"',
  'id="pitchValue"',
  'id="ssmlInputTab"',
  'id="ssmlInputArea"',
  'id="ssml"',
  'id="ssmlTextareaShell"',
  'id="ssmlExampleCode"',
  'id="useSsmlExampleBtn"',
  'class="ssml-ghost-example"',
  'class="field-label-row"',
  'class="btn-secondary inline-action"',
  'data-i18n="input.ssml"',
  'data-i18n="input.useSsmlExample"',
  'data-i18n="input.ssmlHint"',
  'type="range" min="0.5" max="2" step="0.05"',
  'type="range" min="-50" max="50" step="1"',
  'data-i18n="style.general"',
  'data-i18n="style.customerservice"',
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
  "function resetRangeControl(",
  "function initializeRangeControls(",
  "function initializeSsmlExample(",
  "function updateRangeValues(",
  "function formatSpeedValue(",
  "function formatPitchValue(",
  "function showToast(",
  "function getSelectedVoiceId(",
  "function getAudioFromSsml(",
  "const CONFIG =",
  "const FAVICON_ICO_BASE64 =",
  "const SSML_EXAMPLE =",
  "let voiceSearchTimer",
];

for (const marker of requiredFunctions) {
  assert.ok(source.includes(marker), `missing required function marker: ${marker}`);
}

const scripts = [...HTML_PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)];
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
assert.match(
  source,
  /path === "\/favicon\.ico"/,
  "Worker should serve favicon.ico directly",
);

assert.match(
  source,
  /"Content-Type": "image\/x-icon"/,
  "favicon route should return image/x-icon",
);
assert.ok(
  source.includes("height:clamp(640px,calc(100dvh - 112px),760px)"),
  "workspace should use a stable desktop height",
);

assert.ok(
  source.includes(".voice-panel { display:grid; grid-template-rows:auto auto auto auto auto minmax(0,1fr) auto"),
  "voice panel should use a fixed internal grid with a scrollable list area",
);

assert.ok(
  source.includes(".voice-list { max-height:none; min-height:0; height:100%;"),
  "voice list should fill the available panel space instead of growing the page",
);

assert.ok(
  source.includes(".voice-panel .filter-group { flex-wrap:nowrap; overflow-x:auto"),
  "voice filters should stay in a compact horizontal row on desktop",
);

assert.doesNotMatch(
  source,
  /<select class="form-select" id="voice">[\s\S]*?<option value=/,
  "the visible long voice select should be replaced by the new picker",
);

assert.doesNotMatch(
  source,
  /<select class="form-select" id="speed">/,
  "speed should use a range slider instead of a select",
);

assert.doesNotMatch(
  source,
  /<select class="form-select" id="pitch">/,
  "pitch should use a range slider instead of a select",
);
assert.doesNotMatch(
  source,
  /getAudioChunk\(input,[\s\S]*?getSsml\(/,
  "SSML mode should not route user SSML through getSsml() again",
);

assert.match(
  source,
  /pointer-events:none/,
  "SSML ghost example should not intercept text input",
);

assert.match(
  source,
  /addEventListener\('dblclick'/,
  "speed and pitch sliders should reset on double-click",
);

assert.match(
  source,
  /ssmlInput\.value\s*=\s*SSML_EXAMPLE/,
  "SSML example button should fill the textarea with SSML_EXAMPLE",
);

assert.match(
  source,
  /inputType:\s*'ssml'/,
  "TTS submit should send inputType='ssml' for SSML mode",
);

assert.match(
  source,
  /requestBody\.inputType\s*===\s*['"]ssml['"]/,
  "backend should branch on requestBody.inputType === 'ssml'",
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
    new RegExp(`(^|[,{])\\s*["']?${lang}["']?\\s*:`),
    `translations should include ${lang}`,
  );
}

for (const key of [
  "tts.title",
  "input.method",
  "input.ssml",
  "input.ssmlText",
  "input.ssmlPlaceholder",
  "input.ssmlHint",
  "input.useSsmlExample",
  "voice.title",
  "voice.search",
  "stt.title",
  "token.title",
  "action.generate",
  "action.transcribe",
  "control.speedMin",
  "control.speedMax",
  "control.pitchMin",
  "control.pitchMax",
  "style.general",
  "style.assistant",
  "style.chat",
  "style.customerservice",
  "style.newscast",
  "style.affectionate",
  "style.calm",
  "style.cheerful",
  "style.gentle",
  "style.lyrical",
  "style.serious",
]) {
  assert.ok(source.includes(`'${key}'`), `translations should include ${key}`);
}

console.log("Verified VoiceCraft redesign structure.");
