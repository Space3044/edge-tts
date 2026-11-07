import { translations } from "./i18n.js";
import { VOICES } from "./voices.js";

const CLIENT_SCRIPT_TEMPLATE = `\n    const VOICES = __VOICECRAFT_VOICES__;\n    let selectedFile = null;\n    let currentInputMethod = 'text';\n    let selectedAudioFile = null;\n    let currentLanguage = 'en';\n    let selectedVoiceId = 'zh-CN-XiaoxiaoNeural';\n    let activeLanguageFilter = 'All';\n    let activeGenderFilter = 'All';\n    let voiceSearchTimer = null;
    // Auditioning: one shared <audio>, one in-flight request, and a small cache
    // so clicking the same voice twice does not synthesize it twice.
    const voicePreview = { audio: null, cache: new Map(), pending: null, currentId: '' };
    const VOICE_PREVIEW_LIMIT = 24;
    const VOICE_PREVIEW_TEXTS = {
      zh: '\u4f60\u597d\uff0c\u8fd9\u662f\u6211\u7684\u58f0\u97f3\u8bd5\u542c\u3002',
      en: 'Hi, this is how I sound.',
      ja: '\u3053\u3093\u306b\u3061\u306f\u3001\u79c1\u306e\u58f0\u3067\u3059\u3002',
      ko: '\uc548\ub155\ud558\uc138\uc694. \uc81c \ubaa9\uc18c\ub9ac\uc785\ub2c8\ub2e4.',
      es: 'Hola, así suena mi voz.',
      fr: 'Bonjour, voici ma voix.',
      de: 'Hallo, so klinge ich.',
      ru: '\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435, \u044d\u0442\u043e \u043c\u043e\u0439 \u0433\u043e\u043b\u043e\u0441.'
    };\n    const CONFIG = { SEARCH_DEBOUNCE: 120, COPY_FEEDBACK: 1500, MAX_TEXT_LENGTH: 10000 };\n    const POLISH_STORAGE_KEYS = { openAiBaseUrl: 'voicecraft-polish-base-url', openAiApiKey: 'voicecraft-polish-api-key', openAiModel: 'voicecraft-polish-model', polishInstruction: 'voicecraft-polish-instruction' };\n    const PROVIDER_API_URL = '/api/providers';
    const STT_ENGINE_STORAGE_KEY = 'voicecraft-stt-engine';
    const ELEVENLABS_LANGUAGE_STORAGE_KEY = 'voicecraft-elevenlabs-language';
    // Options that only exist for one engine. Kept in localStorage so a reload
    // does not silently drop a prompt or a speaker count.
    const STT_OPTION_STORAGE_KEYS = {
      openaiLanguage: 'voicecraft-openai-language',
      openaiPrompt: 'voicecraft-openai-prompt',
      openaiTemperature: 'voicecraft-openai-temperature',
      openaiTimestamps: 'voicecraft-openai-timestamps',
      elevenlabsDiarize: 'voicecraft-elevenlabs-diarize',
      elevenlabsNumSpeakers: 'voicecraft-elevenlabs-num-speakers',
      elevenlabsGranularity: 'voicecraft-elevenlabs-granularity',
      googleTimestamps: 'voicecraft-google-timestamps'
    };
    let currentSttEngine = 'openai';
    let currentTranscriptionResult = { text: '', sentences: [], words: [] };
    let currentTranscriptionView = 'plain';
    let activeTranscriptionSegmentStop = null;\n    const SSML_EXAMPLE = [\n      '<speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xmlns:mstts=\"https://www.w3.org/2001/mstts\" xml:lang=\"zh-CN\">',\n      '  <voice name=\"zh-CN-XiaoxiaoNeural\">',\n      '    <mstts:express-as style=\"cheerful\">',\n      '      <prosody rate=\"+10%\" pitch=\"+2Hz\">你好，这是一个 SSML 示例。</prosody>',\n      '    </mstts:express-as>',\n      '  </voice>',\n      '</speak>'\n    ].join('\\\\n');\n    const translations = __VOICECRAFT_TRANSLATIONS__;\n    const languageNames = { en:'English', zh:'中文', ja:'日本語', ko:'한국어', es:'Español', fr:'Français', de:'Deutsch', ru:'Русский' };\n    document.addEventListener('DOMContentLoaded', function() { initializeTheme(); initializeI18n(); initializeInputMethodTabs(); initializeFileUpload(); initializeModeSwitcher(); initializeAudioUpload(); initializeProviderSettings(); initializeTranscriptionEngine(); initializeTranscriptionResultViews(); initializeLanguageSwitcher(); initializeVoicePicker(); initializeTextCounter(); initializeRangeControls(); initializeStyleOptions(); initializeSsmlExample(); initializeTextPolish(); initializeTrancyAccounts(); });\n    function applyTheme(theme) { document.documentElement.setAttribute('data-theme', theme); }\n    function initializeTheme() { const themeBtn = document.getElementById('themeBtn'); if (themeBtn) themeBtn.addEventListener('click', function() { const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; localStorage.setItem('voicecraft-theme', next); applyTheme(next); }); if (window.matchMedia) { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(event) { if (!localStorage.getItem('voicecraft-theme')) applyTheme(event.matches ? 'dark' : 'light'); }); } }\n    function detectLanguage() { const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase(); if (browserLang.startsWith('zh')) return 'zh'; if (browserLang.startsWith('ja')) return 'ja'; if (browserLang.startsWith('ko')) return 'ko'; if (browserLang.startsWith('es')) return 'es'; if (browserLang.startsWith('fr')) return 'fr'; if (browserLang.startsWith('de')) return 'de'; if (browserLang.startsWith('ru')) return 'ru'; return 'en'; }\n    function setLanguage(lang) { currentLanguage = translations[lang] ? lang : 'en'; localStorage.setItem('voicecraft-language', currentLanguage); applyTranslations(); updateLanguageSwitcher(); updateTextCounter(); };\n    function t(key) { const dict = translations[currentLanguage] || translations.en; return dict[key] || translations.en[key] || key; }\n    function applyTranslations() { document.querySelectorAll('[data-i18n]').forEach(function(element) { element.textContent = t(element.getAttribute('data-i18n')); }); document.querySelectorAll('[data-i18n-content]').forEach(function(element) { element.setAttribute('content', t(element.getAttribute('data-i18n-content'))); }); document.querySelectorAll('[data-i18n-placeholder]').forEach(function(element) { element.setAttribute('placeholder', t(element.getAttribute('data-i18n-placeholder'))); }); document.querySelectorAll('[data-i18n-aria-label]').forEach(function(element) { element.setAttribute('aria-label', t(element.getAttribute('data-i18n-aria-label'))); }); document.querySelectorAll('[data-i18n-title]').forEach(function(element) { element.setAttribute('title', t(element.getAttribute('data-i18n-title'))); }); document.title = t('page.title'); if (document.getElementById('voiceList')) renderVoiceList(); }\n    function updateLanguageSwitcher() { document.getElementById('currentLangName').textContent = languageNames[currentLanguage] || 'English'; document.querySelectorAll('.language-option').forEach(function(option) { option.classList.toggle('active', option.dataset.lang === currentLanguage); }); }\n    function initializeI18n() { setLanguage(localStorage.getItem('voicecraft-language') || detectLanguage()); }\n    function initializeLanguageSwitcher() { const languageBtn = document.getElementById('languageBtn'); const languageDropdown = document.getElementById('languageDropdown'); languageBtn.addEventListener('click', function(event) { event.stopPropagation(); const open = languageDropdown.classList.toggle('show'); languageBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }); document.addEventListener('click', function() { languageDropdown.classList.remove('show'); languageBtn.setAttribute('aria-expanded', 'false'); }); document.querySelectorAll('.language-option').forEach(function(option) { option.addEventListener('click', function(event) { event.stopPropagation(); setLanguage(option.dataset.lang); languageDropdown.classList.remove('show'); languageBtn.setAttribute('aria-expanded', 'false'); }); }); }\n    function getSelectedVoiceId() { return selectedVoiceId; }\n    function previewTextFor(voice) {
      const language = String((voice && voice.locale) || 'en').split('-')[0].toLowerCase();
      return VOICE_PREVIEW_TEXTS[language] || VOICE_PREVIEW_TEXTS.en;
    }
    function setVoicePreviewState(voiceId, state) {
      const list = document.getElementById('voiceList');
      if (!list) return;
      list.querySelectorAll('.voice-preview').forEach(function(button) {
        const active = button.dataset.previewId === voiceId;
        button.classList.toggle('is-loading', active && state === 'loading');
        button.classList.toggle('is-playing', active && state === 'playing');
        button.setAttribute('aria-busy', active && state === 'loading' ? 'true' : 'false');
      });
      voicePreview.currentId = state ? voiceId : '';
    }
    function stopVoicePreview() {
      if (voicePreview.audio) voicePreview.audio.pause();
      setVoicePreviewState('', '');
    }
    async function previewVoice(voiceId) {
      const voice = getVoiceById(voiceId);
      if (!voice) return;
      // Clicking the row that is already playing stops it.
      if (voicePreview.currentId === voiceId && voicePreview.audio && !voicePreview.audio.paused) {
        stopVoicePreview();
        return;
      }
      if (voicePreview.pending) voicePreview.pending.abort();
      if (!voicePreview.audio) voicePreview.audio = new Audio();
      const audio = voicePreview.audio;

      const cached = voicePreview.cache.get(voiceId);
      if (cached) {
        audio.src = cached;
        setVoicePreviewState(voiceId, 'playing');
        audio.play().catch(function() { setVoicePreviewState('', ''); });
        return;
      }

      const controller = new AbortController();
      voicePreview.pending = controller;
      setVoicePreviewState(voiceId, 'loading');
      try {
        const response = await fetch('/v1/audio/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ input: previewTextFor(voice), voice: voice.id, speed: 1, pitch: '0', style: 'general' })
        });
        if (!response.ok) throw new Error(await readJsonError(response, t('voice.previewFailed')));
        const url = URL.createObjectURL(await response.blob());
        // Keep the cache small: drop the oldest sample and free its blob.
        if (voicePreview.cache.size >= VOICE_PREVIEW_LIMIT) {
          const oldestKey = voicePreview.cache.keys().next().value;
          URL.revokeObjectURL(voicePreview.cache.get(oldestKey));
          voicePreview.cache.delete(oldestKey);
        }
        voicePreview.cache.set(voiceId, url);
        if (controller.signal.aborted) return;
        audio.src = url;
        setVoicePreviewState(voiceId, 'playing');
        audio.play().catch(function() { setVoicePreviewState('', ''); });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        setVoicePreviewState('', '');
        showToast(t('voice.previewFailed') + ': ' + (err && err.message ? err.message : ''));
      } finally {
        if (voicePreview.pending === controller) voicePreview.pending = null;
      }
    }
    function initializeVoicePreview() {
      const audio = new Audio();
      audio.addEventListener('ended', stopVoicePreview);
      audio.addEventListener('error', function() { setVoicePreviewState('', ''); });
      voicePreview.audio = audio;
    }
    function getVoiceById(voiceId) { return VOICES.find(function(voice) { return voice.id === voiceId; }) || VOICES[0]; }\n    function getUniqueVoiceValues(key) { return ['All'].concat(Array.from(new Set(VOICES.map(function(voice) { return voice[key]; }))).sort()); }\n    function filterVoices() { const query = document.getElementById('voiceSearch').value.trim().toLowerCase(); return VOICES.filter(function(voice) { const matchesLanguage = activeLanguageFilter === 'All' || voice.language === activeLanguageFilter; const matchesGender = activeGenderFilter === 'All' || voice.gender === activeGenderFilter; const searchText = [voice.id, voice.name, voice.locale, voice.language, voice.gender, voice.description].join(' ').toLowerCase(); return matchesLanguage && matchesGender && (!query || searchText.includes(query)); }); }\n    function renderFilterGroup(containerId, values, activeValue, onSelect) { const container = document.getElementById(containerId); container.innerHTML = values.map(function(value) { const active = value === activeValue ? ' active' : ''; return '<button type=\"button\" class=\"filter-chip' + active + '\" data-value=\"' + value + '\">' + value + '</button>'; }).join(''); container.querySelectorAll('.filter-chip').forEach(function(button) { button.addEventListener('click', function() { onSelect(button.dataset.value); }); }); }\n    function renderVoiceList() { const voices = filterVoices(); const list = document.getElementById('voiceList'); const emptyState = document.getElementById('voiceEmptyState'); const selectedVoice = getVoiceById(selectedVoiceId); updateSelectedVoiceSummary(); document.getElementById('voiceCount').textContent = voices.length + ' of ' + VOICES.length + ' voices'; emptyState.style.display = voices.length ? 'none' : 'block'; list.innerHTML = voices.map(function(voice) { const active = voice.id === selectedVoice.id ? ' active' : ''; const description = voice.description ? ' · ' + voice.description : ''; const label = t('voice.preview') + ': ' + voice.name; return '<div class=\"voice-item' + active + '\" data-voice-id=\"' + voice.id + '\" role=\"option\" tabindex=\"' + (voice.id === selectedVoice.id ? '0' : '-1') + '\" aria-selected=\"' + (voice.id === selectedVoice.id) + '\"><span class=\"voice-text\"><span class=\"voice-name\">' + voice.name + '</span><span class=\"voice-meta\">' + voice.locale + ' · ' + voice.gender + description + '</span><span class=\"voice-id\">' + voice.id + '</span></span><button type=\"button\" class=\"voice-preview\" data-preview-id=\"' + voice.id + '\" aria-label=\"' + label + '\" title=\"' + label + '\" aria-busy=\"false\"><svg class=\"voice-preview-icon\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M8 5v14l11-7z\"/></svg></button></div>'; }).join(''); }\n    function updateSelectedVoiceSummary() { const v = getVoiceById(selectedVoiceId); document.getElementById('selectedVoiceId').value = v.id; document.getElementById('selectedVoiceSummary').textContent = t('voice.selected') + ': ' + v.name + ' · ' + v.id; }\n    function selectVoice(voiceId) { selectedVoiceId = voiceId; const list = document.getElementById('voiceList'); list.querySelectorAll('.voice-item').forEach(function(item) { const active = item.dataset.voiceId === voiceId; item.classList.toggle('active', active); item.setAttribute('aria-selected', active); item.setAttribute('tabindex', active ? '0' : '-1'); }); updateSelectedVoiceSummary(); }\n    function handleLanguageFilterSelect(value) { activeLanguageFilter = value; renderFilterGroup('voiceLanguageFilters', getUniqueVoiceValues('language'), activeLanguageFilter, handleLanguageFilterSelect); renderVoiceList(); }\n    function handleGenderFilterSelect(value) { activeGenderFilter = value; renderFilterGroup('voiceGenderFilters', getUniqueVoiceValues('gender'), activeGenderFilter, handleGenderFilterSelect); renderVoiceList(); }\n    function initializeVoicePicker() { initializeVoicePreview(); renderFilterGroup('voiceLanguageFilters', getUniqueVoiceValues('language'), activeLanguageFilter, handleLanguageFilterSelect); renderFilterGroup('voiceGenderFilters', getUniqueVoiceValues('gender'), activeGenderFilter, handleGenderFilterSelect); document.getElementById('voiceSearch').addEventListener('input', function() { clearTimeout(voiceSearchTimer); voiceSearchTimer = setTimeout(renderVoiceList, CONFIG.SEARCH_DEBOUNCE); }); initializeVoiceKeyboard(); document.getElementById('voiceList').addEventListener('click', function(event) { const previewButton = event.target.closest('.voice-preview'); if (previewButton) { event.stopPropagation(); previewVoice(previewButton.dataset.previewId); return; } const item = event.target.closest('.voice-item'); if (item) selectVoice(item.dataset.voiceId); }); renderVoiceList(); }\n    function initializeVoiceKeyboard() { const list = document.getElementById('voiceList'); list.addEventListener('keydown', function(event) { const items = Array.from(list.querySelectorAll('.voice-item')); if (!items.length) return; const currentIndex = Math.max(0, items.findIndex(function(item) { return item.dataset.voiceId === selectedVoiceId; })); let nextIndex = currentIndex; if (event.key === 'ArrowDown') nextIndex = Math.min(items.length - 1, currentIndex + 1); else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1); else if (event.key === 'Home') nextIndex = 0; else if (event.key === 'End') nextIndex = items.length - 1; else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectVoice(items[currentIndex].dataset.voiceId); return; } else return; event.preventDefault(); selectVoice(items[nextIndex].dataset.voiceId); items[nextIndex].focus(); }); }\n    function updateTextCounter() { const textInput = document.getElementById('text'); const counter = document.getElementById('textCounter'); if (!textInput || !counter) return; const length = textInput.value.length; counter.textContent = length ? length + ' / ' + CONFIG.MAX_TEXT_LENGTH : ''; counter.classList.toggle('warning', length > CONFIG.MAX_TEXT_LENGTH); }\n    function initializeTextCounter() { const textInput = document.getElementById('text'); if (!textInput) return; textInput.addEventListener('input', updateTextCounter); updateTextCounter(); }\n    function formatSpeedValue(value) { return Number(value).toFixed(2) + 'x'; }\n    function formatPitchValue(value) { const number = Number(value); return (number >= 0 ? '+' : '') + number; }\n    function updateRangeValues() { const speed = document.getElementById('speed'); const pitch = document.getElementById('pitch'); const speedValue = document.getElementById('speedValue'); const pitchValue = document.getElementById('pitchValue'); if (speed && speedValue) speedValue.textContent = formatSpeedValue(speed.value); if (pitch && pitchValue) pitchValue.textContent = formatPitchValue(pitch.value); }\n    function resetRangeControl(id) { const input = document.getElementById(id); if (!input) return; input.value = id === 'speed' ? '1' : '0'; updateRangeValues(); }\n    function initializeRangeControls() { ['speed', 'pitch'].forEach(function(id) { const input = document.getElementById(id); if (input) { input.addEventListener('input', updateRangeValues); input.addEventListener('dblclick', function() { resetRangeControl(id); }); } }); updateRangeValues(); }\n    function initializeStyleOptions() { const styleInput = document.getElementById('style'); if (!styleInput) return; document.querySelectorAll('.style-option').forEach(function(button) { button.addEventListener('click', function() { styleInput.value = button.dataset.style || 'general'; document.querySelectorAll('.style-option').forEach(function(option) { option.classList.toggle('active', option === button); option.setAttribute('aria-pressed', option === button ? 'true' : 'false'); }); }); button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false'); }); }\n    function initializeSsmlExample() { const code = document.getElementById('ssmlExampleCode'); const shell = document.getElementById('ssmlTextareaShell'); const ssmlInput = document.getElementById('ssml'); const button = document.getElementById('useSsmlExampleBtn'); if (!code || !shell || !ssmlInput) return; code.textContent = SSML_EXAMPLE; function syncGhostExample() { shell.classList.toggle('has-value', Boolean(ssmlInput.value.trim())); } ssmlInput.addEventListener('input', syncGhostExample); if (button) button.addEventListener('click', function() { ssmlInput.value = SSML_EXAMPLE; ssmlInput.dispatchEvent(new Event('input', { bubbles: true })); ssmlInput.focus(); }); syncGhostExample(); }\n\n    function getInputValue(id) { const element = document.getElementById(id); return element ? element.value.trim() : ''; }\n    async function readJsonError(response, fallback) { try { const data = await response.json(); return data.error && data.error.message ? data.error.message : fallback; } catch (error) { return fallback; } }\n    function setPolishButtonBusy(button, busy) { if (!button) return; button.disabled = busy; button.classList.toggle('is-loading', busy); button.setAttribute('aria-busy', busy ? 'true' : 'false'); button.setAttribute('aria-label', busy ? t('status.polishing') : t('action.polish')); button.setAttribute('title', busy ? t('status.polishing') : t('action.polish')); }\n    async function handleTextPolishClick() { const textInput = document.getElementById('text'); const polishConfig = document.getElementById('polishConfig'); const polishBtn = document.getElementById('polishBtn'); const input = textInput.value.trim(); if (!input) { alert(t('error.polishInputRequired')); return; } const baseUrl = getInputValue('openAiBaseUrl'); const apiKey = getInputValue('openAiApiKey'); const model = getInputValue('openAiModel'); const instruction = getInputValue('polishInstruction'); if (!baseUrl || !apiKey || !model) { if (polishConfig) polishConfig.open = true; alert(t('error.polishConfigRequired')); return; } setPolishButtonBusy(polishBtn, true); try { const response = await fetch('/v1/text/polish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: baseUrl, apiKey: apiKey, model: model, input: input, instruction: instruction }) }); if (!response.ok) { throw new Error(await readJsonError(response, t('error.polishFailed'))); } const result = await response.json(); if (!result.text || !result.text.trim()) { throw new Error(t('error.polishEmpty')); } textInput.value = result.text.trim(); textInput.dispatchEvent(new Event('input', { bubbles: true })); textInput.focus(); } catch (err) { alert(t('error.prefix') + err.message); } finally { setPolishButtonBusy(polishBtn, false); } }\n    function readStoredPolishSetting(id) { try { return localStorage.getItem(POLISH_STORAGE_KEYS[id]); } catch (err) { return null; } }\n    function saveTextPolishSetting(element) { try { const key = POLISH_STORAGE_KEYS[element.id]; if (key) localStorage.setItem(key, element.value); } catch (err) {} }\n    function loadTextPolishSettings() { Object.keys(POLISH_STORAGE_KEYS).forEach(function(id) { const element = document.getElementById(id); const storedValue = readStoredPolishSetting(id); if (element && storedValue !== null) element.value = storedValue; }); }\n    function initializeTextPolish() { loadTextPolishSettings(); Object.keys(POLISH_STORAGE_KEYS).forEach(function(id) { const element = document.getElementById(id); if (element) element.addEventListener('input', function() { saveTextPolishSetting(element); }); }); const polishBtn = document.getElementById('polishBtn'); if (polishBtn) polishBtn.addEventListener('click', handleTextPolishClick); }\n    function showToast(message) { if (!message) return; window.alert(message); }\n    function initializeInputMethodTabs() { const textInputTab = document.getElementById('textInputTab'); const fileUploadTab = document.getElementById('fileUploadTab'); const ssmlInputTab = document.getElementById('ssmlInputTab'); const textInputArea = document.getElementById('textInputArea'); const fileUploadArea = document.getElementById('fileUploadArea'); const ssmlInputArea = document.getElementById('ssmlInputArea'); const textInput = document.getElementById('text'); const ssmlInput = document.getElementById('ssml'); function setInputMethod(method) { currentInputMethod = method; textInputTab.classList.toggle('active', method === 'text'); fileUploadTab.classList.toggle('active', method === 'file'); ssmlInputTab.classList.toggle('active', method === 'ssml'); textInputArea.style.display = method === 'text' ? 'block' : 'none'; fileUploadArea.style.display = method === 'file' ? 'block' : 'none'; ssmlInputArea.style.display = method === 'ssml' ? 'block' : 'none'; textInput.required = method === 'text'; ssmlInput.required = method === 'ssml'; } textInputTab.addEventListener('click', function() { setInputMethod('text'); }); fileUploadTab.addEventListener('click', function() { setInputMethod('file'); }); ssmlInputTab.addEventListener('click', function() { setInputMethod('ssml'); }); setInputMethod('text'); }\n    function initializeFileUpload() { const fileDropZone = document.getElementById('fileDropZone'); const fileInput = document.getElementById('fileInput'); const fileRemoveBtn = document.getElementById('fileRemoveBtn'); fileDropZone.addEventListener('click', function() { fileInput.click(); }); fileDropZone.addEventListener('keydown', function(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } }); fileInput.addEventListener('change', function(event) { if (event.target.files[0]) handleFileSelect(event.target.files[0]); }); fileDropZone.addEventListener('dragover', function(event) { event.preventDefault(); fileDropZone.classList.add('dragover'); }); fileDropZone.addEventListener('dragleave', function(event) { event.preventDefault(); fileDropZone.classList.remove('dragover'); }); fileDropZone.addEventListener('drop', function(event) { event.preventDefault(); fileDropZone.classList.remove('dragover'); if (event.dataTransfer.files[0]) handleFileSelect(event.dataTransfer.files[0]); }); fileRemoveBtn.addEventListener('click', function() { selectedFile = null; fileInput.value = ''; document.getElementById('fileInfo').style.display = 'none'; fileDropZone.style.display = 'block'; }); }\n    function handleFileSelect(file) { if (!file.type.includes('text/') && !file.name.toLowerCase().endsWith('.txt')) { alert('请选择txt格式的文本文件'); return; } if (file.size > 500 * 1024) { alert('文件大小不能超过500KB'); return; } selectedFile = file; document.getElementById('fileName').textContent = file.name; document.getElementById('fileSize').textContent = formatFileSize(file.size); document.getElementById('fileInfo').style.display = 'flex'; document.getElementById('fileDropZone').style.display = 'none'; }\n    function formatFileSize(bytes) { if (bytes === 0) return '0 Bytes'; const k = 1024; const sizes = ['Bytes', 'KB', 'MB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; }\n    document.getElementById('ttsForm').addEventListener('submit', async function(event) { event.preventDefault(); const voice = getSelectedVoiceId(); const speed = document.getElementById('speed').value; const pitch = document.getElementById('pitch').value; const style = document.getElementById('style').value; const generateBtn = document.getElementById('generateBtn'); const resultContainer = document.getElementById('result'); const loading = document.getElementById('loading'); const success = document.getElementById('success'); const error = document.getElementById('error'); if (currentInputMethod === 'text' && !document.getElementById('text').value.trim()) { alert('请输入要转换的文本内容'); return; } if (currentInputMethod === 'file' && !selectedFile) { alert('请选择要上传的txt文件'); return; } if (currentInputMethod === 'ssml' && !document.getElementById('ssml').value.trim()) { alert('请输入SSML内容'); return; } resultContainer.style.display = 'block'; loading.style.display = 'block'; success.style.display = 'none'; error.style.display = 'none'; generateBtn.disabled = true; generateBtn.textContent = t('status.generating'); try { let response; const loadingText = document.getElementById('loadingText'); const progressInfo = document.getElementById('progressInfo'); if (currentInputMethod === 'text') { const text = document.getElementById('text').value; loadingText.textContent = text.length > 3000 ? t('status.longText') : t('status.generating'); progressInfo.textContent = 'Text length: ' + text.length + ' characters'; response = await fetch('/v1/audio/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: text, voice: voice, speed: parseFloat(speed), pitch: pitch, style: style }) }); } else if (currentInputMethod === 'ssml') { const ssml = document.getElementById('ssml').value; loadingText.textContent = t('status.ssml'); progressInfo.textContent = 'SSML length: ' + ssml.length + ' characters'; response = await fetch('/v1/audio/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: ssml, inputType: 'ssml' }) }); } else { loadingText.textContent = t('status.file'); progressInfo.textContent = 'File: ' + selectedFile.name + ' (' + formatFileSize(selectedFile.size) + ')'; const formData = new FormData(); formData.append('file', selectedFile); formData.append('voice', voice); formData.append('speed', speed); formData.append('pitch', pitch); formData.append('style', style); response = await fetch('/v1/audio/speech', { method: 'POST', body: formData }); } if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error && errorData.error.message ? errorData.error.message : '生成失败'); } const audioBlob = await response.blob(); const audioUrl = URL.createObjectURL(audioBlob); document.getElementById('audioPlayer').src = audioUrl; document.getElementById('downloadBtn').href = audioUrl; loading.style.display = 'none'; success.style.display = 'block'; } catch (err) { loading.style.display = 'none'; error.style.display = 'block'; error.textContent = '错误: ' + err.message; } finally { generateBtn.disabled = false; generateBtn.textContent = t('action.generate'); } });\n    var MODE_BUTTONS = { tts: 'ttsMode', transcription: 'transcriptionMode', trancy: 'trancyMode' };
    var MODE_VIEWS = { tts: { id: 'ttsWorkspace', display: 'grid' }, transcription: { id: 'transcriptionContainer', display: 'block' }, trancy: { id: 'trancyContainer', display: 'block' } };
    function initializeModeSwitcher() { Object.keys(MODE_BUTTONS).forEach(function(mode) { var button = document.getElementById(MODE_BUTTONS[mode]); if (button) button.addEventListener('click', function() { switchMode(mode); }); }); }\n    function switchMode(mode) { Object.keys(MODE_BUTTONS).forEach(function(key) { var button = document.getElementById(MODE_BUTTONS[key]); if (!button) return; var active = key === mode; button.classList.toggle('active', active); button.setAttribute('aria-selected', active ? 'true' : 'false'); }); Object.keys(MODE_VIEWS).forEach(function(key) { var view = MODE_VIEWS[key]; var element = document.getElementById(view.id); if (element) element.style.display = key === mode ? view.display : 'none'; }); if (mode === 'trancy') loadTrancyAccounts(); }\n    function initializeAudioUpload() { const audioDropZone = document.getElementById('audioDropZone'); const audioFileInput = document.getElementById('audioFileInput'); const audioFileRemoveBtn = document.getElementById('audioFileRemoveBtn'); audioDropZone.addEventListener('click', function() { audioFileInput.click(); }); audioDropZone.addEventListener('keydown', function(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); audioFileInput.click(); } }); audioFileInput.addEventListener('change', function(event) { if (event.target.files[0]) handleAudioFileSelect(event.target.files[0]); }); audioDropZone.addEventListener('dragover', function(event) { event.preventDefault(); audioDropZone.classList.add('dragover'); }); audioDropZone.addEventListener('dragleave', function(event) { event.preventDefault(); audioDropZone.classList.remove('dragover'); }); audioDropZone.addEventListener('drop', function(event) { event.preventDefault(); audioDropZone.classList.remove('dragover'); if (event.dataTransfer.files[0]) handleAudioFileSelect(event.dataTransfer.files[0]); }); audioFileRemoveBtn.addEventListener('click', function() { selectedAudioFile = null; audioFileInput.value = ''; document.getElementById('audioFileInfo').style.display = 'none'; audioDropZone.style.display = 'block'; document.dispatchEvent(new CustomEvent('voicecraft:audio-file-cleared')); }); }\n    function handleAudioFileSelect(file) { const isValidType = file.name.toLowerCase().match(/\\.(mp3|wav|m4a|flac|aac|ogg|webm|amr|3gp)$/i) || file.type.includes('audio/'); if (!isValidType) { alert('请选择音频格式的文件（mp3、wav、m4a、flac、aac、ogg、webm、amr、3gp）'); return; } if (file.size > 50 * 1024 * 1024) { alert('音频文件大小不能超过50MB'); return; } selectedAudioFile = file; document.getElementById('audioFileName').textContent = file.name; document.getElementById('audioFileSize').textContent = formatFileSize(file.size); document.getElementById('audioFileInfo').style.display = 'flex'; document.getElementById('audioDropZone').style.display = 'none'; document.dispatchEvent(new CustomEvent('voicecraft:audio-file-selected', { detail: { file: file } })); }\n    function providerCard(provider) { return document.querySelector('.provider-card[data-provider="' + provider + '"]'); }
    function providerField(provider, field) { const card = providerCard(provider); return card ? card.querySelector('[data-field="' + field + '"]') : null; }
    function providerStatusText(entry) { if (!entry) return ''; if (entry.keyError) return entry.keyError; if (entry.keySource === 'db') return t('provider.statusDb') + ' ' + entry.keyTail; return t('provider.statusNone'); }
    function applyProviderStatus(payload) { const list = payload && Array.isArray(payload.providers) ? payload.providers : []; const config = document.getElementById('providerConfig'); list.forEach(function(entry) { const endpointInput = providerField(entry.provider, 'endpoint'); const modelInput = providerField(entry.provider, 'model'); const keyInput = providerField(entry.provider, 'apiKey'); if (endpointInput && !endpointInput.value) endpointInput.value = entry.endpoint || ''; if (modelInput && !modelInput.value) modelInput.value = entry.model || ''; if (keyInput) { keyInput.value = ''; keyInput.placeholder = entry.configured ? t('provider.statusDb') + ' ' + entry.keyTail : t('provider.apiKeyPlaceholder'); } const card = providerCard(entry.provider); const status = card ? card.querySelector('[data-role="status"]') : null; if (status) status.textContent = providerStatusText(entry); }); }
    async function loadProviderStatus() { try { const response = await fetch(PROVIDER_API_URL, { headers: { 'Accept': 'application/json' } }); if (!response.ok) throw new Error(await readJsonError(response, t('provider.loadFailed'))); applyProviderStatus(await response.json()); } catch (err) { const config = document.getElementById('providerConfig'); const hint = config ? config.querySelector('.provider-hint') : null; if (hint) hint.textContent = t('provider.loadFailed') + ': ' + err.message; } }
    function adminFetch(url, options) { const request = Object.assign({ method: 'POST' }, options || {}); request.headers = Object.assign({ 'Content-Type': 'application/json' }, request.headers || {}); return fetch(url, request); }
    async function saveProviderSettings(provider, button) { const payload = { model: providerField(provider, 'model') ? providerField(provider, 'model').value.trim() : '', apiKey: providerField(provider, 'apiKey') ? providerField(provider, 'apiKey').value.trim() : '' }; const endpointInput = providerField(provider, 'endpoint'); if (endpointInput) payload.endpoint = endpointInput.value.trim(); const card = providerCard(provider); const status = card ? card.querySelector('[data-role="status"]') : null; const originalLabel = button ? button.textContent : ''; if (button) { button.disabled = true; button.textContent = t('provider.saving'); } try { const response = await fetch(PROVIDER_API_URL + '/' + provider, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error(await readJsonError(response, t('provider.saveFailed'))); const result = await response.json(); applyProviderStatus({ providers: [result.provider] }); if (status) status.textContent = t('provider.saved') + ' · ' + providerStatusText(result.provider); } catch (err) { if (status) status.textContent = t('provider.saveFailed') + ': ' + err.message; } finally { if (button) { button.disabled = false; button.textContent = originalLabel; } } }
    function initializeProviderSettings() { const config = document.getElementById('providerConfig'); if (!config) return; config.querySelectorAll('[data-role="save"]').forEach(function(button) { const card = button.closest('.provider-card'); const provider = card ? card.dataset.provider : ''; if (!provider) return; button.addEventListener('click', function() { saveProviderSettings(provider, button); }); }); const backdrop = document.getElementById('providerBackdrop'); if (backdrop) backdrop.addEventListener('click', function() { config.open = false; }); const closeBtn = document.getElementById('providerModalClose'); if (closeBtn) closeBtn.addEventListener('click', function() { config.open = false; }); document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && config.open) config.open = false; }); loadProviderStatus(); }
    function setSttEngine(engine) { const engines = ['openai', 'elevenlabs', 'google', 'groq']; const requested = engine === 'whisper' ? 'openai' : engine; currentSttEngine = engines.includes(requested) ? requested : 'openai'; try { localStorage.setItem(STT_ENGINE_STORAGE_KEY, currentSttEngine); } catch (err) {} const openaiBtn = document.getElementById('engineOpenai'); const elevenlabsBtn = document.getElementById('engineElevenLabs'); const googleBtn = document.getElementById('engineGoogle'); const groqBtn = document.getElementById('engineGroq'); const elevenlabsOptions = document.getElementById('elevenlabsOptions'); const openaiOptions = document.getElementById('openaiOptions'); const googleOptions = document.getElementById('googleOptions'); if (!openaiBtn || !elevenlabsBtn || !googleBtn || !groqBtn) return; const isOpenai = currentSttEngine === 'openai'; const isElevenLabs = currentSttEngine === 'elevenlabs'; const isGoogle = currentSttEngine === 'google'; const isGroq = currentSttEngine === 'groq'; openaiBtn.classList.toggle('active', isOpenai); elevenlabsBtn.classList.toggle('active', isElevenLabs); googleBtn.classList.toggle('active', isGoogle); groqBtn.classList.toggle('active', isGroq); openaiBtn.setAttribute('aria-selected', isOpenai ? 'true' : 'false'); elevenlabsBtn.setAttribute('aria-selected', isElevenLabs ? 'true' : 'false'); googleBtn.setAttribute('aria-selected', isGoogle ? 'true' : 'false'); groqBtn.setAttribute('aria-selected', isGroq ? 'true' : 'false'); if (elevenlabsOptions) elevenlabsOptions.style.display = isElevenLabs ? 'block' : 'none'; if (openaiOptions) openaiOptions.style.display = isOpenai || isGroq ? 'block' : 'none'; if (googleOptions) googleOptions.style.display = isGoogle ? 'block' : 'none'; }
    function initializeTranscriptionEngine() { const openaiBtn = document.getElementById('engineOpenai'); const elevenlabsBtn = document.getElementById('engineElevenLabs'); const googleBtn = document.getElementById('engineGoogle'); const groqBtn = document.getElementById('engineGroq'); const langSelect = document.getElementById('elevenlabsLanguage'); if (!openaiBtn || !elevenlabsBtn || !googleBtn || !groqBtn) return; let stored = 'openai'; try { stored = localStorage.getItem(STT_ENGINE_STORAGE_KEY) || 'openai'; } catch (err) {} if (langSelect) { try { const storedLang = localStorage.getItem(ELEVENLABS_LANGUAGE_STORAGE_KEY); if (storedLang) langSelect.value = storedLang; } catch (err) {} langSelect.addEventListener('change', function() { try { localStorage.setItem(ELEVENLABS_LANGUAGE_STORAGE_KEY, langSelect.value); } catch (err) {} }); } initializeSttOptions(); openaiBtn.addEventListener('click', function() { setSttEngine('openai'); }); elevenlabsBtn.addEventListener('click', function() { setSttEngine('elevenlabs'); }); googleBtn.addEventListener('click', function() { setSttEngine('google'); }); groqBtn.addEventListener('click', function() { setSttEngine('groq'); }); setSttEngine(stored); }
    function initializeSttOptions() {
      Object.keys(STT_OPTION_STORAGE_KEYS).forEach(function(id) {
        var element = document.getElementById(id);
        if (!element) return;
        var key = STT_OPTION_STORAGE_KEYS[id];
        var stored = null;
        try { stored = localStorage.getItem(key); } catch (err) {}
        if (stored !== null) {
          if (element.type === 'checkbox') element.checked = stored === 'true';
          else element.value = stored;
        }
        element.addEventListener(element.type === 'checkbox' ? 'change' : 'input', function() {
          try { localStorage.setItem(key, element.type === 'checkbox' ? (element.checked ? 'true' : 'false') : element.value); } catch (err) {}
        });
      });
      var timestamps = document.getElementById('openaiTimestamps');
      var diarize = document.getElementById('elevenlabsDiarize');
      var hasTimestamps = false;
      var hasDiarize = false;
      try {
        hasTimestamps = localStorage.getItem(STT_OPTION_STORAGE_KEYS.openaiTimestamps) !== null;
        hasDiarize = localStorage.getItem(STT_OPTION_STORAGE_KEYS.elevenlabsDiarize) !== null;
      } catch (err) {}
      // Defaults: ask for word timings, keep ElevenLabs diarization on.
      if (timestamps && !hasTimestamps) timestamps.checked = true;
      var googleTimestamps = document.getElementById('googleTimestamps');
      if (googleTimestamps) {
        var hasGoogleTimestamps = false;
        try { hasGoogleTimestamps = localStorage.getItem(STT_OPTION_STORAGE_KEYS.googleTimestamps) !== null; } catch (err) {}
        if (!hasGoogleTimestamps) googleTimestamps.checked = true;
      }
      if (diarize && !hasDiarize) diarize.checked = true;
    }
    function formatTimestamp(value) { const number = Number(value); if (!Number.isFinite(number)) return '--:--.---'; const minutes = Math.floor(number / 60); const seconds = Math.floor(number % 60); const milliseconds = Math.round((number - Math.floor(number)) * 1000); return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + '.' + String(milliseconds).padStart(3, '0'); }
    function formatTimestampRange(item) { return formatTimestamp(item && item.start) + ' - ' + formatTimestamp(item && item.end); }
    function appendEmptyTimestampState(container) { container.innerHTML = ''; const empty = document.createElement('p'); empty.className = 'timestamp-empty'; empty.textContent = t('stt.noTimestamps'); container.appendChild(empty); }
    function clearActiveTranscriptionSegment(player) { if (activeTranscriptionSegmentStop && player) player.removeEventListener('timeupdate', activeTranscriptionSegmentStop); activeTranscriptionSegmentStop = null; }
    function playTranscriptionSegment(start, end) { const player = document.getElementById('audioPreviewPlayer'); const startTime = Number(start); const endTime = Number(end); if (!player || !player.src) { showToast(t('error.audioPreviewRequired')); return; } if (!Number.isFinite(startTime)) { showToast(t('error.timestampUnavailable')); return; } clearActiveTranscriptionSegment(player); player.currentTime = Math.max(0, startTime); if (Number.isFinite(endTime) && endTime > startTime) { activeTranscriptionSegmentStop = function() { if (player.currentTime >= endTime) { player.pause(); clearActiveTranscriptionSegment(player); } }; player.addEventListener('timeupdate', activeTranscriptionSegmentStop); } player.play().catch(function() { showToast(t('error.audioPlaybackFailed')); }); }
    function renderSentenceTimestampView(sentences) { const container = document.getElementById('sentenceTimestampView'); if (!container) return; container.innerHTML = ''; if (!Array.isArray(sentences) || !sentences.length) { appendEmptyTimestampState(container); return; } sentences.forEach(function(sentence) { const row = document.createElement('button'); row.type = 'button'; row.className = 'timestamp-row timestamp-playable'; row.addEventListener('click', function() { playTranscriptionSegment(sentence.start, sentence.end); }); const time = document.createElement('span'); time.className = 'timestamp-range'; time.textContent = formatTimestampRange(sentence); const text = document.createElement('span'); text.className = 'timestamp-text'; text.textContent = sentence.text || ''; row.appendChild(time); row.appendChild(text); container.appendChild(row); }); }
    function renderWordTimestampView(words) { const container = document.getElementById('wordTimestampView'); if (!container) return; container.innerHTML = ''; const visibleWords = Array.isArray(words) ? words.filter(function(word) { return String(word && word.text || '').trim(); }) : []; if (!visibleWords.length) { appendEmptyTimestampState(container); return; } visibleWords.forEach(function(word) { const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'word-token timestamp-playable word-token-' + String(word.type || 'word').replace(/[^a-z0-9_-]/gi, '').toLowerCase(); chip.title = formatTimestampRange(word) + ' · ' + String(word.type || 'word'); chip.addEventListener('click', function() { playTranscriptionSegment(word.start, word.end); }); const text = document.createElement('span'); text.className = 'word-token-text'; text.textContent = word.text || ''; const time = document.createElement('span'); time.className = 'word-token-time'; time.textContent = formatTimestampRange(word); chip.appendChild(text); chip.appendChild(time); container.appendChild(chip); }); }
    function setTranscriptionView(view) { currentTranscriptionView = view === 'sentences' || view === 'words' ? view : 'plain'; const text = document.getElementById('transcriptionText'); const sentenceView = document.getElementById('sentenceTimestampView'); const wordView = document.getElementById('wordTimestampView'); document.querySelectorAll('.transcription-view-btn').forEach(function(button) { const active = button.dataset.view === currentTranscriptionView; button.classList.toggle('active', active); button.setAttribute('aria-selected', active ? 'true' : 'false'); }); if (text) text.style.display = currentTranscriptionView === 'plain' ? 'block' : 'none'; if (sentenceView) sentenceView.style.display = currentTranscriptionView === 'sentences' ? 'grid' : 'none'; if (wordView) wordView.style.display = currentTranscriptionView === 'words' ? 'flex' : 'none'; }
    function renderTranscriptionResult(result) { currentTranscriptionResult = { text: String(result && result.text || ''), sentences: Array.isArray(result && result.sentences) ? result.sentences : [], words: Array.isArray(result && result.words) ? result.words : [] }; document.getElementById('transcriptionText').value = currentTranscriptionResult.text; renderSentenceTimestampView(currentTranscriptionResult.sentences); renderWordTimestampView(currentTranscriptionResult.words); setTranscriptionView('plain'); }
    function initializeTranscriptionResultViews() { document.querySelectorAll('.transcription-view-btn').forEach(function(button) { button.addEventListener('click', function() { setTranscriptionView(button.dataset.view); }); }); renderTranscriptionResult(currentTranscriptionResult); }
    document.getElementById('transcriptionForm').addEventListener('submit', async function(event) { event.preventDefault(); const transcribeBtn = document.getElementById('transcribeBtn'); const transcriptionResult = document.getElementById('transcriptionResult'); const transcriptionLoading = document.getElementById('transcriptionLoading'); const transcriptionSuccess = document.getElementById('transcriptionSuccess'); const transcriptionError = document.getElementById('transcriptionError'); const audioSourceUrl = (document.getElementById('audioSourceUrl')?.value || '').trim(); if (!selectedAudioFile && !audioSourceUrl) { alert(t('error.audioSourceRequired')); return; } const isOpenai = currentSttEngine === 'openai'; const isElevenLabs = currentSttEngine === 'elevenlabs'; const isGoogle = currentSttEngine === 'google'; const isGroq = currentSttEngine === 'groq'; transcriptionResult.style.display = 'block'; transcriptionLoading.style.display = 'block'; transcriptionSuccess.style.display = 'none'; transcriptionError.style.display = 'none'; transcribeBtn.disabled = true; transcribeBtn.textContent = t('status.transcribing'); document.getElementById('transcriptionProgressInfo').textContent = selectedAudioFile ? t('status.fileLabel') + ': ' + selectedAudioFile.name + ' (' + formatFileSize(selectedAudioFile.size) + ')' : t('stt.sourceUrl') + ': ' + audioSourceUrl; try { const formData = new FormData(); if (selectedAudioFile) { formData.append('file', selectedAudioFile); } else { formData.append('source_url', audioSourceUrl); } formData.append('engine', currentSttEngine); if (isElevenLabs) { formData.append('language', document.getElementById('elevenlabsLanguage').value); formData.append('tagAudioEvents', document.getElementById('elevenlabsTagAudioEvents').checked ? 'true' : 'false'); formData.append('diarize', document.getElementById('elevenlabsDiarize').checked ? 'true' : 'false'); const speakers = document.getElementById('elevenlabsNumSpeakers').value.trim(); if (speakers) formData.append('numSpeakers', speakers); formData.append('timestampsGranularity', document.getElementById('elevenlabsGranularity').value); } if (isOpenai || isGroq) { const language = document.getElementById('openaiLanguage').value.trim(); if (language) formData.append('language', language); const prompt = document.getElementById('openaiPrompt').value.trim(); if (prompt) formData.append('prompt', prompt); const temperature = document.getElementById('openaiTemperature').value.trim(); if (temperature) formData.append('temperature', temperature); formData.append('timestamps', document.getElementById('openaiTimestamps').checked ? 'true' : 'false'); } if (isGoogle) { formData.append('timestamps', document.getElementById('googleTimestamps').checked ? 'true' : 'false'); } const response = await fetch('/v1/audio/transcriptions', { method: 'POST', body: formData }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error && errorData.error.message ? errorData.error.message : '转录失败'); } const result = await response.json(); renderTranscriptionResult(result); transcriptionLoading.style.display = 'none'; transcriptionSuccess.style.display = 'block'; } catch (err) { transcriptionLoading.style.display = 'none'; transcriptionError.style.display = 'block'; transcriptionError.textContent = '错误: ' + err.message; } finally { transcribeBtn.disabled = false; transcribeBtn.textContent = t('action.transcribe'); } });
    document.getElementById('copyTranscriptionBtn').addEventListener('click', function() { const transcriptionText = document.getElementById('transcriptionText'); const button = this; const showCopied = function() { const originalText = button.textContent; button.textContent = t('action.copied'); setTimeout(function() { button.textContent = originalText; }, CONFIG.COPY_FEEDBACK); }; const fallbackCopy = function() { try { transcriptionText.select(); document.execCommand('copy'); showCopied(); } catch (err) { showToast(t('error.copyFailed')); } }; if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(transcriptionText.value).then(showCopied).catch(fallbackCopy); } else { fallbackCopy(); } });
    document.getElementById('editTranscriptionBtn').addEventListener('click', function() { const transcriptionText = document.getElementById('transcriptionText'); setTranscriptionView('plain'); transcriptionText.readOnly = !transcriptionText.readOnly; this.textContent = transcriptionText.readOnly ? t('action.edit') : t('action.save'); if (!transcriptionText.readOnly) transcriptionText.focus(); });
    document.getElementById('useForTtsBtn').addEventListener('click', function() { const transcriptionText = document.getElementById('transcriptionText').value; if (!transcriptionText.trim()) { alert('转录结果为空，无法转换为语音'); return; } switchMode('tts'); currentInputMethod = 'text'; document.getElementById('textInputTab').click(); document.getElementById('text').value = transcriptionText; document.getElementById('text').dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('ttsWorkspace').scrollIntoView({ behavior: 'smooth' }); });\n    var trancyState = { accounts: [], loadedAt: 0, addMode: 'login', defaultDailyLimit: 5 };
    var TRANCY_API_URL = '/api/trancy/accounts';
    function setTrancyStatus(message, tone) { var element = document.getElementById('trancyAddStatus'); if (!element) return; element.textContent = message || ''; if (tone) element.setAttribute('data-tone', tone); else element.removeAttribute('data-tone'); }
    function trancyTimeLabel(value) { if (!value) return t('trancy.never'); var date = new Date(value); if (isNaN(date.getTime())) return t('trancy.never'); return date.toLocaleString(); }
    function trancyAccountTitle(account) { return account.email || account.name || String(account.id || '').slice(0, 8); }
    function setTrancyAddMode(mode) {
      trancyState.addMode = mode === 'token' || mode === 'signup' ? mode : 'login';
      document.querySelectorAll('[data-trancy-mode]').forEach(function(button) {
        var active = button.getAttribute('data-trancy-mode') === trancyState.addMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('[data-trancy-fields]').forEach(function(group) {
        var groupName = group.getAttribute('data-trancy-fields');
        group.style.display = (groupName === 'token') === (trancyState.addMode === 'token') ? '' : 'none';
      });
      var hint = document.getElementById('trancyAddHint');
      if (hint) {
        var hintKey = trancyState.addMode === 'token' ? 'trancy.tokenHint'
          : trancyState.addMode === 'signup' ? 'trancy.signupHint' : 'trancy.loginHint';
        hint.setAttribute('data-i18n', hintKey);
        hint.textContent = t(hintKey);
      }
      var addBtn = document.getElementById('trancyAddBtn');
      if (addBtn) {
        var labelKey = trancyState.addMode === 'token' ? 'trancy.add'
          : trancyState.addMode === 'signup' ? 'trancy.signupButton' : 'trancy.loginButton';
        addBtn.textContent = t(labelKey);
      }
      setTrancyStatus('');
    }
    function renderTrancyAccount(account) {
      var row = document.createElement('article');
      row.className = 'trancy-account';
      row.setAttribute('data-status', String(account.status || 'new'));
      row.setAttribute('data-account-id', account.id);
      var main = document.createElement('div'); main.className = 'trancy-account-main';
      var title = document.createElement('div'); title.className = 'trancy-account-title';
      var titleText = document.createElement('span'); titleText.className = 'trancy-account-title-text'; titleText.textContent = trancyAccountTitle(account); title.appendChild(titleText);
      var status = document.createElement('span'); status.className = 'trancy-badge trancy-badge-' + String(account.status || 'new').replace(/[^a-z0-9_-]/gi, ''); status.textContent = t('trancy.status.' + (account.tokenError ? 'unreadable' : account.status || 'new')); title.appendChild(status);
      var plan = document.createElement('span'); plan.className = 'trancy-badge' + (account.premium ? ' trancy-badge-premium' : ''); plan.textContent = account.premium ? t('trancy.premium') : t('trancy.free'); title.appendChild(plan);
      if (account.exhaustedUntil && new Date(account.exhaustedUntil).getTime() > Date.now()) {
        var outOfQuota = document.createElement('span'); outOfQuota.className = 'trancy-badge trancy-badge-new'; outOfQuota.textContent = t('trancy.quotaBadge'); outOfQuota.title = t('trancy.quotaOut') + ' ' + trancyTimeLabel(account.exhaustedUntil); title.appendChild(outOfQuota);
      }
      main.appendChild(title);
      // The title is already the email, so the meta line starts at the token.
      var bits = [];
      if (account.tokenTail) bits.push(account.tokenTail);
      // Balances are observations from caption responses, not profile checks.
      var quotaText = account.quotaRemaining >= 0
        ? t('trancy.quotaObserved') + ' ' + account.quotaRemaining + (account.quotaLimit > 0 ? '/' + account.quotaLimit : '')
        : t(account.quotaStatus === 'stale' ? 'trancy.quotaStale' : 'trancy.quotaUnknown');
      bits.push(t('trancy.quota') + ': ' + quotaText);
      bits.push(t('trancy.gatewayCalls') + ' ' + (account.usedToday || 0));
      if (account.quotaCheckedAt) bits.push(t('trancy.quotaChecked') + ' ' + trancyTimeLabel(account.quotaCheckedAt));
      if (account.cooldownUntil && Date.parse(account.cooldownUntil) > Date.now()) {
        bits.push(t('trancy.cooldown') + ' ' + trancyTimeLabel(account.cooldownUntil));
      }
      if (account.exhaustedUntil && new Date(account.exhaustedUntil).getTime() > Date.now()) {
        bits.push(t('trancy.quotaOut') + ' ' + trancyTimeLabel(account.exhaustedUntil));
      }
      bits.push(t('trancy.checked') + ' ' + trancyTimeLabel(account.lastCheckedAt));
      if (account.tokenIssuedAt) bits.push(t('trancy.issued') + ' ' + trancyTimeLabel(account.tokenIssuedAt));
      if (account.useCount) bits.push(t('trancy.uses') + ' ' + account.useCount);
      var meta = document.createElement('p'); meta.className = 'trancy-account-meta'; meta.textContent = bits.join(' · ');
      main.appendChild(meta);
      if (account.hasPassword) {
        var credLine = document.createElement('p'); credLine.className = 'trancy-account-meta trancy-account-creds';
        credLine.appendChild(document.createTextNode(t('trancy.password') + ': '));
        // Stored encrypted: the mask is all the list ever carries. The plaintext
        // is fetched once, on demand, and then kept only in this closure.
        var passwordText = document.createElement('code'); passwordText.className = 'trancy-password';
        passwordText.textContent = '••••••••';
        var revealed = '';
        passwordText.addEventListener('click', function() {
          if (revealed) { copyTrancyPassword(revealed); return; }
          revealTrancyPassword(account.id, passwordText, function(value) {
            revealed = value;
          });
        });
        credLine.appendChild(passwordText);
        var revealBtn = document.createElement('button'); revealBtn.type = 'button'; revealBtn.className = 'trancy-reveal'; revealBtn.textContent = t('trancy.revealPassword');
        revealBtn.addEventListener('click', function() {
          if (revealed) { revealed = ''; passwordText.textContent = '••••••••'; revealBtn.textContent = t('trancy.revealPassword'); return; }
          revealTrancyPassword(account.id, passwordText, function(value) {
            revealed = value;
            revealBtn.textContent = t('trancy.hidePassword');
          });
        });
        credLine.appendChild(revealBtn);
        main.appendChild(credLine);
      }
      if (account.status === 'dead' || account.status === 'banned') {
        var hint = document.createElement('p'); hint.className = 'trancy-account-meta'; hint.textContent = t('trancy.deadHint'); main.appendChild(hint);
      }
      row.appendChild(main);
      var actions = document.createElement('div'); actions.className = 'trancy-account-actions';
      if (account.hasPassword) {
        var loginBtn = document.createElement('button'); loginBtn.type = 'button'; loginBtn.className = 'btn-secondary'; loginBtn.textContent = t('trancy.relogin');
        loginBtn.addEventListener('click', function() { reloginTrancyAccount(account.id, loginBtn); });
        actions.appendChild(loginBtn);
      }
      var refreshBtn = document.createElement('button'); refreshBtn.type = 'button'; refreshBtn.className = 'btn-secondary'; refreshBtn.textContent = t('trancy.refresh');
      refreshBtn.addEventListener('click', function() { refreshTrancyAccount(account.id, refreshBtn); });
      var removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'btn-secondary trancy-danger'; removeBtn.textContent = t('trancy.delete');
      removeBtn.addEventListener('click', function() { deleteTrancyAccount(account); });
      actions.appendChild(refreshBtn); actions.appendChild(removeBtn); row.appendChild(actions);
      return row;
    }
    function renderTrancyAccounts() {
      var list = document.getElementById('trancyAccountList');
      var emptyState = document.getElementById('trancyEmptyState');
      var summary = document.getElementById('trancySummary');
      var count = document.getElementById('trancyCount');
      if (!list) return;
      var accounts = trancyState.accounts || [];
      var usable = accounts.filter(function(account) { return account.captionAvailable; }).length;
      list.innerHTML = '';
      accounts.forEach(function(account) { list.appendChild(renderTrancyAccount(account)); });
      if (emptyState) emptyState.style.display = accounts.length ? 'none' : 'block';
      if (count) count.textContent = String(accounts.length);
      if (summary) {
        summary.innerHTML = '';
        var strong = document.createElement('b'); strong.textContent = String(usable);
        summary.appendChild(strong);
        summary.appendChild(document.createTextNode(' / ' + accounts.length + ' ' + t('trancy.usable')));
      }
      var quotaSummary = document.getElementById('trancyQuotaSummary');
      if (quotaSummary) {
        var left = 0;
        var unknown = 0;
        accounts.forEach(function(account) {
          if (!account.captionAvailable) return;
          if (account.quotaRemaining >= 0) left += account.quotaRemaining;
          else unknown += 1;
        });
        quotaSummary.innerHTML = '';
        var leftStrong = document.createElement('b'); leftStrong.textContent = String(left);
        quotaSummary.appendChild(document.createTextNode(t('trancy.quotaObservedTotal') + ' '));
        quotaSummary.appendChild(leftStrong);
        if (unknown) quotaSummary.appendChild(document.createTextNode(' · ' + unknown + ' ' + t('trancy.quotaUnknownAccounts')));
      }
    }
    async function loadTrancyAccounts(force) {
      var list = document.getElementById('trancyAccountList');
      if (!list) return;
      // The tab switch and the DOM-ready hook can both land here; a two second
      // window keeps the first paint at one request.
      if (force !== true && Date.now() - trancyState.loadedAt < 2000) return;
      try {
        var response = await fetch(TRANCY_API_URL, { cache: 'no-store', headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error(await readJsonError(response, t('trancy.loadFailed')));
        var payload = await response.json();
        trancyState.accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
        if (Number(payload.defaultDailyLimit) > 0) trancyState.defaultDailyLimit = Number(payload.defaultDailyLimit);
        trancyState.loadedAt = Date.now();
        renderTrancyAccounts();
      } catch (err) { setTrancyStatus(t('trancy.loadFailed') + ': ' + err.message, 'error'); }
    }
    async function submitTrancyAccount(event) {
      if (event) event.preventDefault();
      var tokenField = document.getElementById('trancyTokenInput');
      var emailField = document.getElementById('trancyEmailInput');
      var passwordField = document.getElementById('trancyPasswordInput');
      var addBtn = document.getElementById('trancyAddBtn');
      if (!addBtn) return;
      var mode = trancyState.addMode;
      var payload = {};
      var url = TRANCY_API_URL;
      if (mode === 'token') {
        payload.token = tokenField ? tokenField.value.trim() : '';
        if (!payload.token) { setTrancyStatus(t('trancy.tokenRequired'), 'error'); return; }
      } else {
        payload.email = emailField ? emailField.value.trim() : '';
        payload.password = passwordField ? passwordField.value : '';
        if (!payload.email || !payload.password) { setTrancyStatus(t('trancy.credentialsRequired'), 'error'); return; }
        url = TRANCY_API_URL + '/' + mode;
      }
      addBtn.disabled = true;
      setTrancyStatus(mode === 'token' ? t('trancy.adding') : t('trancy.loggingIn'));
      try {
        var response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(await readJsonError(response, mode === 'token' ? t('trancy.addFailed') : t('trancy.loginFailed')));
        if (tokenField) tokenField.value = '';
        if (passwordField) passwordField.value = '';
        await loadTrancyAccounts(true);
        setTrancyStatus(mode === 'signup' ? t('trancy.signedUp') : mode === 'login' ? t('trancy.loggedIn') : t('trancy.added'), 'ok');
      } catch (err) {
        setTrancyStatus((mode === 'token' ? t('trancy.addFailed') : t('trancy.loginFailed')) + ': ' + err.message, 'error');
      }
      finally { addBtn.disabled = false; }
    }
    async function reloginTrancyAccount(id, button) {
      if (button) { button.disabled = true; button.textContent = t('trancy.loggingIn'); }
      try {
        var response = await fetch(TRANCY_API_URL + '/' + encodeURIComponent(id) + '/login', { method: 'POST' });
        if (!response.ok) throw new Error(await readJsonError(response, t('trancy.loginFailed')));
        await loadTrancyAccounts(true);
        setTrancyStatus(t('trancy.loggedIn'), 'ok');
      } catch (err) { setTrancyStatus(t('trancy.loginFailed') + ': ' + err.message, 'error'); }
      finally { if (button) { button.disabled = false; button.textContent = t('trancy.relogin'); } }
    }
    async function revealTrancyPassword(id, element, onRevealed) {
      try {
        var response = await fetch(TRANCY_API_URL + '/' + encodeURIComponent(id) + '/password', { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(await readJsonError(response, t('trancy.passwordUnreadable')));
        var payload = await response.json();
        element.textContent = payload.password || '';
        element.title = t('trancy.copyPassword');
        if (onRevealed) onRevealed(payload.password || '');
      } catch (err) {
        setTrancyStatus(t('trancy.passwordUnreadable') + ': ' + err.message, 'error');
      }
    }
    function copyTrancyPassword(password) {
      if (!password) return;
      var done = function() { setTrancyStatus(t('trancy.copied'), 'ok'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(password).then(done).catch(function() { setTrancyStatus(t('trancy.copied') + ': ' + password, 'ok'); });
      } else {
        setTrancyStatus(t('trancy.copied') + ': ' + password, 'ok');
      }
    }
    async function refreshTrancyAccount(id, button) {
      if (button) { button.disabled = true; button.textContent = t('trancy.refreshing'); }
      try {
        var response = await fetch(TRANCY_API_URL + '/' + encodeURIComponent(id) + '/refresh', { method: 'POST' });
        if (!response.ok) throw new Error(await readJsonError(response, t('trancy.refreshFailed')));
        var payload = await response.json();
        await loadTrancyAccounts(true);
        if (!payload.result || !payload.result.refreshed) throw new Error(payload.result && (payload.result.error || payload.result.reason) || t('trancy.refreshFailed'));
        setTrancyStatus(t('trancy.refreshed'), 'ok');
      } catch (err) { setTrancyStatus(t('trancy.refreshFailed') + ': ' + err.message, 'error'); }
      finally { if (button) { button.disabled = false; button.textContent = t('trancy.refresh'); } }
    }
    async function refreshAllTrancyAccounts(button) {
      if (button) { button.disabled = true; }
      setTrancyStatus(t('trancy.refreshing'));
      try {
        var response = await fetch(TRANCY_API_URL + '/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minAgeMinutes: 0 }) });
        if (!response.ok) throw new Error(await readJsonError(response, t('trancy.refreshFailed')));
        var payload = await response.json();
        var result = payload.result || {};
        await loadTrancyAccounts(true);
        var failed = (result.failed || 0) + (result.dead || 0);
        setTrancyStatus(t('trancy.refreshed') + ' · ' + (result.ok || 0) + ' ok / ' + failed + ' ERR / ' + (result.skipped || 0) + ' ' + t('trancy.skipped'), failed ? 'error' : 'ok');
      } catch (err) { setTrancyStatus(t('trancy.refreshFailed') + ': ' + err.message, 'error'); }
      finally { if (button) { button.disabled = false; } }
    }
    async function deleteTrancyAccount(account) {
      if (!window.confirm(t('trancy.confirmDelete'))) return;
      try {
        var response = await fetch(TRANCY_API_URL + '/' + encodeURIComponent(account.id), { method: 'DELETE' });
        if (!response.ok) throw new Error(await readJsonError(response, t('trancy.deleteFailed')));
        await loadTrancyAccounts(true);
        setTrancyStatus(t('trancy.deleted'), 'ok');
      } catch (err) { setTrancyStatus(t('trancy.deleteFailed') + ': ' + err.message, 'error'); }
    }
    function initializeTrancyAccounts() {
      var form = document.getElementById('trancyAddForm');
      if (!form) return;
      form.addEventListener('submit', submitTrancyAccount);
      document.querySelectorAll('[data-trancy-mode]').forEach(function(button) {
        button.addEventListener('click', function() { setTrancyAddMode(button.getAttribute('data-trancy-mode')); });
      });
      var refreshAllBtn = document.getElementById('trancyRefreshAllBtn');
      if (refreshAllBtn) refreshAllBtn.addEventListener('click', function() { refreshAllTrancyAccounts(refreshAllBtn); });
      function refreshVisibleAccounts() {
        var panel = document.getElementById('trancyContainer');
        if (!document.hidden && panel && panel.style.display !== 'none') loadTrancyAccounts(true);
      }
      window.addEventListener('focus', refreshVisibleAccounts);
      document.addEventListener('visibilitychange', refreshVisibleAccounts);
      setInterval(refreshVisibleAccounts, 60000);
      setTrancyAddMode(trancyState.addMode);
      loadTrancyAccounts(true);
    }
\n  `;

export const THEME_BOOTSTRAP = "(function(){try{var t=localStorage.getItem('voicecraft-theme');if(!t){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();";
export const CLIENT_SCRIPT = CLIENT_SCRIPT_TEMPLATE
    .replace("__VOICECRAFT_VOICES__", () => JSON.stringify(VOICES, null, 2))
    .replace("__VOICECRAFT_TRANSLATIONS__", () => JSON.stringify(translations, null, 2));
