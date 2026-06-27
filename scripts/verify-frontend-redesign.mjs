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
  'href="https://github.com/Space3044/edge-tts"',
  'class="repo-link"',
  'target="_blank" rel="noopener noreferrer"',
  'type="module" id="devAnnotationScript"',
  'agent-ui-annotation@0.7.0/dist/adapters/vanilla/index.js',
  'voicecraft-dev-annotation',
  'class="workspace-grid"',
  'class="tts-production-panel"',
  'class="input-panel tts-parameter-panel"',
  'class="result-panel tts-result-panel"',
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
  'class="field-label-main"',
  'id="textCounter"',
  'class="panel-header-actions input-method-control"',
  'class="inline-action-group"',
  'class="inline-action icon-action icon-action-plain"',
  'class="btn-primary inline-generate-action" id="generateBtn"',
  'class="icon-action-label"',
  'aria-label="AI polish"',
  'aria-label="AI polish settings"',
  'data-i18n-aria-label="action.polish"',
  'data-i18n-aria-label="polish.config"',
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
  'data-i18n="tts.result"',
  'data-i18n="input.method"',
  'data-i18n="voice.title"',
  'data-i18n="stt.title"',
  'id="whisperEndpoint"',
  'data-i18n="stt.endpoint"',
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

const scripts = [...HTML_PAGE.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 3, "page should include the theme script, dev annotation script, and the main interaction script");
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
  /localhost[\s\S]*127\.0\.0\.1[\s\S]*annotate[\s\S]*voicecraft-dev-annotation/,
  "agent-ui-annotation should be guarded to local development or explicit opt-in",
);

assert.match(
  source,
  /import\('https:\/\/unpkg\.com\/agent-ui-annotation@0\.7\.0\/dist\/adapters\/vanilla\/index\.js'\)/,
  "development annotation toolbar should be loaded from the vanilla adapter CDN entry",
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

assert.ok(
  HTML_PAGE.indexOf('class="voice-panel"') < HTML_PAGE.indexOf('class="tts-production-panel"'),
  "voice library should be placed before the TTS production panel so it sits on the left",
);

assert.ok(
  HTML_PAGE.indexOf('class="input-panel tts-parameter-panel"') < HTML_PAGE.indexOf('class="result-panel tts-result-panel"'),
  "TTS parameters should be above the generated result panel",
);

assert.ok(
  HTML_PAGE.indexOf('class="panel-header-actions input-method-control"') < HTML_PAGE.indexOf('id="textInputArea"'),
  "input method controls should live in the TTS panel header before the text input area",
);

assert.match(
  HTML_PAGE,
  /class="panel-header-actions input-method-control"><label class="form-label"[\s\S]*?<\/label><div class="input-method-tabs">/,
  "input method label should sit directly before the three input method buttons",
);

assert.match(
  HTML_PAGE,
  /class="inline-action-group"><button type="button" class="inline-action icon-action icon-action-plain" id="polishBtn"[\s\S]*?<details class="polish-config" id="polishConfig">/,
  "AI polish settings should sit next to the AI polish icon action",
);

assert.match(
  HTML_PAGE,
  /<summary class="inline-action icon-action icon-action-plain" aria-label="AI polish settings"/,
  "AI polish settings should use an icon button summary with an accessible label",
);

assert.match(
  HTML_PAGE,
  /class="field-label-main"><label class="form-label" for="text" data-i18n="input\.text">[\s\S]*?<span id="textCounter" class="char-counter"[\s\S]*?<\/span><\/div><div class="inline-action-group"[\s\S]*?id="generateBtn"[\s\S]*?<\/div><\/div><textarea class="form-textarea" id="text"/,
  "generate action should live on the input text row before the textarea",
);

assert.doesNotMatch(
  HTML_PAGE,
  /<div class="text-tool-row"><span id="textCounter"/,
  "text counter should move next to the input text label instead of below the textarea",
);

assert.doesNotMatch(
  HTML_PAGE,
  /<\/div><\/div>\s*<textarea class="form-textarea" id="text"[\s\S]*?<\/div>\s*<div class="controls-grid"[\s\S]*?<\/div><\/div>\s*<button type="submit" class="btn-primary" id="generateBtn"/,
  "generate action should not remain below the controls grid",
);

assert.doesNotMatch(
  HTML_PAGE,
  /<div class="text-tool-row"><span id="textCounter"[\s\S]*?<details class="polish-config" id="polishConfig">/,
  "AI polish settings should not remain below the textarea",
);

assert.match(
  source,
  /\.tts-production-panel\s*\{\s*height:100%;\s*min-height:0;\s*display:grid;\s*grid-template-rows:minmax\(0,1fr\) 220px;/,
  "TTS production panel should split the right side into parameter and result rows",
);

assert.doesNotMatch(
  HTML_PAGE,
  /<p data-i18n="tts\.resultHint">/,
  "generated result panel should not show the redundant hint paragraph",
);

assert.doesNotMatch(
  source,
  /tts\.resultHint/,
  "unused generated result hint translation should be removed",
);

assert.match(
  source,
  /\.tts-result-container\s*\{\s*display:flex;\s*align-items:center;\s*min-height:126px;\s*height:auto;\s*margin-top:0;\s*overflow:hidden;/,
  "generated result container should reserve reasonable height without its own scrollbar",
);

assert.match(
  source,
  /\.app-shell\s*\{[\s\S]*?padding:28px 0 44px;/,
  "desktop shell should avoid page-level scrolling at the annotated viewport height",
);

assert.match(
  source,
  /<a class="repo-link" href="https:\/\/github\.com\/Space3044\/edge-tts"[\s\S]*?<svg[\s\S]*?<\/svg><span class="icon-action-label">GitHub<\/span><\/a>/,
  "repository link should be an icon action with an accessible text label",
);

assert.match(
  source,
  /\.repo-link\s*\{[\s\S]*?display:inline-flex;[\s\S]*?border:0;[\s\S]*?background:transparent;/,
  "repository link should be integrated as a compact topbar action",
);

assert.match(
  source,
  /\.repo-link\s+svg\s*\{\s*width:18px;\s*height:18px;/,
  "repository link should include a stable icon size",
);

assert.match(
  source,
  /\.theme-btn\s*\{[\s\S]*?border:0;[\s\S]*?background:transparent;/,
  "theme toggle should be a borderless topbar icon action",
);

assert.match(
  source,
  /\.language-btn\s*\{[\s\S]*?border:0;[\s\S]*?background:transparent;/,
  "language selector should be a borderless topbar action",
);

assert.match(
  source,
  /\.input-method-control\s*\{\s*display:flex;\s*align-items:center;/,
  "input method controls should be one horizontal row",
);

assert.match(
  source,
  /\.tts-parameter-panel\s*>\s*\.panel-header\s*\{\s*align-items:center;/,
  "TTS parameter header should vertically align both sides",
);

assert.match(
  source,
  /\.field-label-row\s*\{[\s\S]*?min-height:38px;/,
  "text input label row should reserve one stable control height",
);

assert.match(
  source,
  /\.icon-action\s*\{\s*width:38px;\s*height:38px;/,
  "AI polish actions should use equal-size icon buttons",
);

assert.match(
  source,
  /\.icon-action-plain\s*\{\s*border:0;\s*background:transparent;\s*box-shadow:none;/,
  "AI polish icon buttons should not have an outer frame",
);

assert.match(
  source,
  /\.field-label-main\s+\.form-label\s*\{[\s\S]*?font-size:1rem;/,
  "input text label should be sized closer to the icon controls",
);

assert.match(
  source,
  /\.field-label-main\s*\{\s*display:flex;\s*align-items:center;/,
  "input text label and counter should share the left side of the field label row",
);

assert.match(
  source,
  /\.tts-parameter-panel\s*\{\s*overflow:hidden;/,
  "TTS parameter panel should not show its own scrollbar on desktop",
);

assert.match(
  source,
  /\.form-textarea\s*\{\s*height:236px;\s*min-height:236px;/,
  "text input area should use available vertical space while controls fit without panel scrolling",
);

assert.match(
  source,
  /\.file-drop-zone,\.audio-upload-zone\s*\{\s*min-height:236px;/,
  "upload input areas should keep the same vertical rhythm as the text input area",
);

assert.match(
  source,
  /\.inline-generate-action\s*\{[\s\S]*?width:auto;/,
  "inline generate action should use compact width on the input text row",
);

assert.match(
  source,
  /\[data-i18n-aria-label\]/,
  "icon-only action labels should be localized through data-i18n-aria-label",
);

assert.doesNotMatch(
  source,
  /polishBtn\.textContent\s*=/,
  "AI polish busy state should not replace icon button contents",
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
  "stt.endpoint",
  "stt.endpointPlaceholder",
  "stt.endpointHint",
  "error.endpointRequired",
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
