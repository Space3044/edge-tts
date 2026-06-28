import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { CLIENT_SCRIPT } from "../src/frontend/client.js";
import { HTML_PAGE } from "../src/frontend/page.js";

const sourceFiles = [
  "../index.js",
  "../src/worker.js",
  "../src/routes/speech.js",
  "../src/routes/transcriptions.js",
  "../src/elevenlabs/stt.js",
  "../src/edge/synthesize.js",
  "../src/edge/ssml.js",
  "../src/frontend/page.js",
  "../src/frontend/accessAuth.js",
  "../src/frontend/routeMode.js",
  "../src/frontend/styles.js",
  "../src/frontend/transcriptionStyles.js",
  "../src/frontend/client.js",
  "../src/frontend/voices.js",
  "../src/frontend/i18n.js",
  "../src/frontend/favicon.js",
];

const source = [
  HTML_PAGE,
  CLIENT_SCRIPT,
  ...sourceFiles
    .filter((file) => existsSync(new URL(file, import.meta.url)))
    .map((file) => readFileSync(new URL(file, import.meta.url), "utf8")),
].join("\n");

const expectedModuleFiles = [
  "../src/worker.js",
  "../src/routes/speech.js",
  "../src/routes/transcriptions.js",
  "../src/elevenlabs/stt.js",
  "../src/edge/endpoint.js",
  "../src/edge/ssml.js",
  "../src/edge/synthesize.js",
  "../src/edge/signing.js",
  "../src/frontend/page.js",
  "../src/frontend/accessAuth.js",
  "../src/frontend/routeMode.js",
  "../src/frontend/styles.js",
  "../src/frontend/transcriptionStyles.js",
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
  'id="accessAuthBtn"',
  'class="access-auth-btn"',
  'data-i18n-aria-label="access.login"',
  'data-access-login-icon',
  'data-access-logout-icon',
  'type="module" id="devAnnotationScript"',
  'agent-ui-annotation@0.7.0/dist/adapters/vanilla/index.js',
  'voicecraft-dev-annotation',
  'class="workspace-grid"',
  'class="tts-production-panel"',
  'class="input-panel tts-parameter-panel"',
  'class="settings-panel"',
  'class="result-panel tts-result-panel"',
  'class="voice-panel"',
  'id="voiceSearch"',
  'id="voiceList"',
  'id="selectedVoiceId"',
  'id="voiceLanguageFilters"',
  'id="voiceGenderFilters"',
  'id="speedValue"',
  'id="pitchValue"',
  'class="style-options"',
  'class="style-option active"',
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
  'data-i18n="control.title"',
  'data-i18n="voice.title"',
  'data-i18n="stt.title"',
  'id="whisperEndpoint"',
  'id="engineWhisper"',
  'id="engineElevenLabs"',
  'id="elevenlabsLanguage"',
  'id="elevenlabsTagAudioEvents"',
  'data-i18n="stt.endpoint"',
  'data-i18n="stt.engine"',
  'data-i18n="stt.engineElevenLabs"',
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
  "function initializeStyleOptions(",
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

for (const appPath of ['path === "/"', 'path === "/index.html"', 'path === "/tts"', 'path === "/transcription"']) {
  assert.ok(
    source.includes(appPath),
    `Worker should serve the app shell for ${appPath}`,
  );
}

assert.match(
  source,
  /function getModeFromPath\(\)[\s\S]*?\/transcription[\s\S]*?return 'transcription'/,
  "frontend should infer transcription mode from the /transcription path",
);

assert.match(
  source,
  /window\.location\.assign\('\/tts'\)[\s\S]*?window\.location\.assign\('\/transcription'\)/,
  "mode switcher should navigate to real TTS and transcription paths so Cloudflare Access can protect page loads",
);

assert.match(
  source,
  /import\s+\{\s*ACCESS_AUTH_SCRIPT[\s\S]*?ACCESS_AUTH_STYLES\s*\}\s+from\s+["']\.\/accessAuth\.js["'];|import\s+\{\s*ACCESS_AUTH_STYLES[\s\S]*?ACCESS_AUTH_SCRIPT\s*\}\s+from\s+["']\.\/accessAuth\.js["'];/,
  "page should import the Cloudflare Access auth interaction script",
);

assert.match(
  source,
  /CLIENT_SCRIPT\s+\+\s+ROUTE_MODE_SCRIPT\s+\+\s+ACCESS_AUTH_SCRIPT/,
  "main interaction script should append Access auth behavior after the route mode behavior",
);

assert.ok(
  HTML_PAGE.indexOf('class="language-switcher"') < HTML_PAGE.indexOf('id="accessAuthBtn"'),
  "Access auth button should sit at the far right after the language switcher",
);

assert.match(
  source,
  /\/cdn-cgi\/access\/get-identity/,
  "Access auth button should check Cloudflare Access identity when the page loads",
);

assert.match(
  source,
  /\/cdn-cgi\/access\/logout\?returnTo=/,
  "Access auth button should use the Cloudflare Access logout endpoint",
);

assert.match(
  source,
  /const ACCESS_LOGIN_PATH = '\/transcription'/,
  "Access auth login should navigate to the protected transcription path",
);

assert.match(
  source,
  /classList\.toggle\('authenticated'/,
  "Access auth button should visibly switch into an authenticated logout state",
);

assert.match(
  source,
  /addEventListener\('click'[\s\S]*?true\)/,
  "mode switcher should intercept mode clicks before the SPA toggle when navigation is required",
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

assert.match(
  source,
  /\.voice-name\s*\{\s*font-size:\.88rem;\s*display:block;\s*min-width:0;\s*line-height:1\.45;\s*padding-bottom:3px;\s*margin-bottom:-3px;\s*white-space:nowrap;\s*overflow:hidden;\s*text-overflow:ellipsis;\s*\}/,
  "compact voice names should keep ellipsis without clipping descenders like Jenny",
);

assert.match(
  source,
  /\.voice-meta\s*\{\s*font-size:\.75rem;\s*display:block;\s*min-width:0;\s*line-height:1\.45;\s*padding-bottom:3px;\s*margin-bottom:-3px;\s*white-space:nowrap;\s*overflow:hidden;\s*text-overflow:ellipsis;\s*\}/,
  "compact voice metadata should keep ellipsis without clipping English text",
);

assert.ok(
  HTML_PAGE.indexOf('class="voice-panel"') < HTML_PAGE.indexOf('class="tts-production-panel"'),
  "voice library should be placed before the TTS production panel so it sits on the left",
);

assert.ok(
  HTML_PAGE.indexOf('class="result-panel tts-result-panel"') < HTML_PAGE.indexOf('class="settings-panel"'),
  "settings panel should be a top-level column after the TTS production panel",
);

assert.ok(
  HTML_PAGE.indexOf('class="settings-panel"') < HTML_PAGE.indexOf('class="transcription-panel"'),
  "settings panel should remain inside the TTS workspace instead of the transcription view",
);

assert.ok(
  HTML_PAGE.includes('</section>\n        <aside class="settings-panel">'),
  "settings panel should be a direct TTS workspace child like the voice library",
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

assert.ok(
  HTML_PAGE.indexOf('<div class="controls-grid">') > HTML_PAGE.indexOf('</form>\n          <aside class="settings-panel">'),
  "settings controls should not remain inside the text-to-speech input panel",
);

assert.match(
  HTML_PAGE,
  /<aside class="settings-panel">[\s\S]*?<div class="panel-header">[\s\S]*?data-i18n="control\.title"[\s\S]*?<div class="controls-grid">/,
  "settings controls should live inside an independent panel with its own header",
);

assert.doesNotMatch(
  HTML_PAGE,
  /data-i18n="control\.subtitle"|调整语速、音调和风格。|Adjust speed, pitch, and style\./,
  "settings panel should not show the redundant subtitle paragraph",
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
  /\.app-shell\s*\{\s*width:min\(1440px,calc\(100% - 40px\)\);[\s\S]*?padding:28px 0 44px;/,
  "desktop shell should be wide enough for the three-block workspace",
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
  /\.access-auth-btn\s*\{[\s\S]*?display:inline-flex;[\s\S]*?border:0;[\s\S]*?background:transparent;/,
  "Access auth button should be integrated as a compact topbar icon action",
);

assert.match(
  source,
  /\.access-auth-btn\.authenticated\s*\{[\s\S]*?background:var\(--accent-soft\);/,
  "Access auth button should use a restrained active state after login",
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
  /\.workspace-grid\s*\{[\s\S]*?grid-template-columns:320px minmax\(0,1fr\) 260px;/,
  "TTS workspace should use three independent columns for voices, input, and settings",
);

assert.match(
  source,
  /\.settings-panel\s*\{\s*height:100%;\s*min-height:0;\s*overflow:hidden;\s*display:grid;\s*grid-template-rows:auto minmax\(0,1fr\);/,
  "settings panel should behave like an independent desktop column",
);

assert.match(
  source,
  /\.controls-grid\s*\{\s*display:grid;\s*grid-template-columns:1fr;[\s\S]*?padding:12px;[\s\S]*?background:var\(--surface-2\);[\s\S]*?border:1px solid var\(--border\);/,
  "controls grid should read as a vertical settings stack inside the settings panel",
);

assert.match(
  source,
  /\.controls-grid\s*>\s*\.form-group\s*\{[\s\S]*?min-height:84px;[\s\S]*?padding:10px;[\s\S]*?background:var\(--surface\);/,
  "speed and pitch controls should use a compact stable panel height",
);

assert.match(
  source,
  /\.style-options\s*\{\s*display:grid;\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/,
  "style options should be directly visible as a two-column option grid",
);

assert.match(
  source,
  /\.style-option\s*\{[\s\S]*?min-height:30px;[\s\S]*?font-size:\.72rem;/,
  "style option buttons should stay compact enough for the settings column",
);

assert.match(
  source,
  /\.range-value\s*\{[\s\S]*?min-width:60px;[\s\S]*?background:var\(--accent-soft\);[\s\S]*?color:var\(--accent\);/,
  "range values should be clear compact value badges",
);

assert.match(
  source,
  /\.form-range\s*\{[\s\S]*?height:6px;[\s\S]*?background:linear-gradient\(90deg,var\(--accent-soft\),var\(--surface-3\)\);/,
  "range inputs should have a custom quiet track",
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
  /@media \(max-width:880px\)[\s\S]*?\.tts-parameter-panel\s*\{\s*display:block;/,
  "mobile layout should collapse the two-column TTS panel back to one column",
);

assert.match(
  source,
  /@media \(max-width:880px\)[\s\S]*?\.settings-panel\s*\{\s*height:auto;\s*overflow:visible;/,
  "mobile layout should collapse the independent settings panel into the normal flow",
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
  /<select class="form-select" id="style">/,
  "style should be shown directly instead of using a select dropdown",
);

assert.match(
  source,
  /<input type="hidden" id="style" value="general">/,
  "style option buttons should keep the existing hidden style value for submit compatibility",
);

assert.match(
  source,
  /document\.querySelectorAll\('\.style-option'\)[\s\S]*?classList\.toggle\('active'/,
  "style option buttons should update their active state and hidden value",
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
  "stt.engine",
  "stt.engineWhisper",
  "stt.engineElevenLabs",
  "stt.language",
  "stt.languageAuto",
  "stt.tagAudioEvents",
  "stt.tagAudioEventsHint",
  "access.login",
  "access.logout",
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

assert.ok(
  source.includes("'stt.tagAudioEvents': '保留音效提示'"),
  "Chinese ElevenLabs audio-event option should use plain product wording",
);

assert.ok(
  source.includes("'stt.tagAudioEventsHint': '转写文本里可能出现 [笑声]、[掌声] 这类提示。'"),
  "Chinese ElevenLabs audio-event hint should keep the short sound-cue explanation",
);

assert.doesNotMatch(
  source,
  /SRT 字幕文件|No SRT file is generated/,
  "ElevenLabs audio-event hint should not mention SRT output",
);

assert.doesNotMatch(
  source,
  /'stt\.tagAudioEvents': '标记音频事件'/,
  "Chinese ElevenLabs audio-event option should not use unclear API wording",
);

assert.doesNotMatch(
  HTML_PAGE,
  /<label><span data-i18n="stt\.language">/,
  "ElevenLabs language selector should not show a separate language label",
);

assert.ok(
  HTML_PAGE.includes('id="elevenlabsLanguage" autocomplete="off" aria-label="Language"'),
  "ElevenLabs language selector should keep an accessible label without visible text",
);

[
  "#transcriptionForm > .form-group:nth-of-type(3)",
  ".engine-tabs",
  ".engine-btn.active",
  "#whisperOptions",
  "#elevenlabsOptions",
  ".elevenlabs-grid",
  "grid-template-columns:repeat(2,minmax(0,1fr))",
  "grid-template-columns:auto max-content minmax(0,1fr)",
  "white-space:nowrap",
].forEach((selector) => {
  assert.ok(
    source.includes(selector),
    `transcription engine controls should include styled selector ${selector}`,
  );
});

for (const languageCode of ["eng", "zho", "jpn", "kor", "spa", "fra", "deu", "rus"]) {
  assert.ok(
    source.includes(`<option value="${languageCode}">`),
    `ElevenLabs language selector should use official ${languageCode} language code`,
  );
}

assert.doesNotMatch(
  source,
  /<option value="(?:en|zh|ja|ko|es|fr|de|ru)">/,
  "ElevenLabs language selector should not use legacy two-letter language codes",
);

console.log("Verified VoiceCraft redesign structure.");
