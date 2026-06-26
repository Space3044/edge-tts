const TOKEN_REFRESH_BEFORE_EXPIRY = 3 * 60;
let tokenInfo = {
    endpoint: null,
    token: null,
    expiredAt: null
};

// HTML 页面模板
const HTML_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title data-i18n="page.title">VoiceCraft - AI Voice Workspace</title>
  <meta name="description" content="VoiceCraft is a focused AI voice workspace with 114 voices." data-i18n-content="page.description">
  <meta name="keywords" content="text to speech,AI voice synthesis,online TTS,speech to text,voice transcription" data-i18n-content="page.keywords">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-display:"Space Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      --font-body:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
      --font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
      --radius-sm:8px; --radius-md:12px; --radius-lg:16px; --radius-pill:999px;
    }
    :root, [data-theme="light"] {
      --bg:#F4F3EF; --bg-tint:rgba(90,75,224,.05);
      --surface:#FFFFFF; --surface-2:#EFEDE7; --surface-3:#E6E3DB;
      --border:#E4E1D8; --border-strong:#D3CFC4;
      --text:#1A1B1E; --text-2:#585B62; --text-3:#8A8D95;
      --accent:#5A4BE0; --accent-hover:#4838C9; --accent-soft:rgba(90,75,224,.10); --accent-ring:rgba(90,75,224,.22);
      --on-accent:#FFFFFF; --signal:#EE9A3D;
      --error:#CF4436; --error-bg:#FBECEA; --error-border:#F3C9C3; --warning:#9A5B12;
      --shadow-sm:0 1px 2px rgb(20 22 28 / .06),0 1px 3px rgb(20 22 28 / .05);
      --shadow-md:0 14px 34px -14px rgb(20 22 28 / .20);
      --shadow-accent:0 8px 24px -10px rgba(90,75,224,.50);
      color-scheme:light;
    }
    [data-theme="dark"] {
      --bg:#0D1015; --bg-tint:rgba(126,112,247,.07);
      --surface:#161A21; --surface-2:#1B212B; --surface-3:#232A35;
      --border:#2A313D; --border-strong:#3A4350;
      --text:#E8ECF2; --text-2:#9AA2AF; --text-3:#6B7380;
      --accent:#7E70F7; --accent-hover:#6F60F2; --accent-soft:rgba(126,112,247,.16); --accent-ring:rgba(126,112,247,.35);
      --on-accent:#FFFFFF; --signal:#F2B45A;
      --error:#F0796B; --error-bg:rgba(207,68,54,.14); --error-border:rgba(240,121,107,.30); --warning:#E0A451;
      --shadow-sm:0 1px 2px rgb(0 0 0 / .35);
      --shadow-md:0 18px 44px -18px rgb(0 0 0 / .65);
      --shadow-accent:0 8px 28px -10px rgba(126,112,247,.55);
      color-scheme:dark;
    }
    * { box-sizing:border-box; }
    body {
      margin:0; min-height:100vh; color:var(--text); font-family:var(--font-body); line-height:1.5;
      background:var(--bg);
      background-image:radial-gradient(1100px 560px at 100% -8%,var(--bg-tint),transparent 62%);
      -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
      transition:background-color .3s ease,color .3s ease;
    }
    button,input,select,textarea { font:inherit; color:inherit; }
    :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .form-input:focus-visible,.form-select:focus-visible,.form-textarea:focus-visible { outline:none; }
    .app-shell { width:min(1200px,calc(100% - 40px)); margin:0 auto; padding:28px 0 48px; }
    .topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:24px; }
    .brand { display:flex; align-items:center; gap:13px; }
    .brand-mark { width:44px; height:44px; border-radius:13px; display:grid; place-items:center; background:linear-gradient(140deg,var(--accent),var(--signal)); box-shadow:var(--shadow-accent); }
    .wave { display:flex; align-items:center; gap:3px; height:20px; }
    .wave i { display:block; width:3px; height:35%; border-radius:2px; background:var(--on-accent); animation:eq 1.2s ease-in-out infinite; }
    .wave i:nth-child(1){ animation-delay:-.9s } .wave i:nth-child(2){ animation-delay:-.4s } .wave i:nth-child(3){ animation-delay:-.7s } .wave i:nth-child(4){ animation-delay:-.2s } .wave i:nth-child(5){ animation-delay:-.55s }
    @keyframes eq { 0%,100%{ height:22% } 50%{ height:92% } }
    .brand h1 { margin:0; font-family:var(--font-display); font-size:1.4rem; font-weight:700; letter-spacing:-.02em; }
    .brand p { margin:1px 0 0; color:var(--text-2); font-size:.8rem; }
    .topbar-actions { display:flex; align-items:center; gap:10px; }
    .mode-switcher { display:flex; gap:4px; padding:4px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-md); }
    .mode-btn { border:0; background:transparent; color:var(--text-2); padding:8px 14px; font-family:var(--font-display); font-weight:600; font-size:.875rem; border-radius:var(--radius-sm); cursor:pointer; transition:color .2s ease,background-color .2s ease,box-shadow .2s ease; }
    .mode-btn:hover { color:var(--text); }
    .mode-btn.active { background:var(--surface); color:var(--accent); box-shadow:var(--shadow-sm); }
    .theme-btn { width:42px; height:42px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); background:var(--surface); color:var(--text); border-radius:var(--radius-md); cursor:pointer; transition:border-color .2s ease,background-color .2s ease,transform .2s ease; }
    .theme-btn:hover { border-color:var(--border-strong); background:var(--surface-2); }
    .theme-btn:active { transform:scale(.94); }
    .theme-btn svg { width:18px; height:18px; }
    .icon-sun { display:none; } .icon-moon { display:block; }
    [data-theme="dark"] .icon-moon { display:none; } [data-theme="dark"] .icon-sun { display:block; }
    .language-switcher { position:relative; }
    .language-btn { display:inline-flex; align-items:center; gap:7px; height:42px; padding:0 13px; border:1px solid var(--border); background:var(--surface); color:var(--text); border-radius:var(--radius-md); font-weight:600; font-size:.875rem; cursor:pointer; transition:border-color .2s ease,background-color .2s ease; }
    .language-btn:hover { border-color:var(--border-strong); background:var(--surface-2); }
    .language-dropdown { position:absolute; right:0; top:calc(100% + 8px); z-index:10; min-width:160px; display:none; padding:6px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); box-shadow:var(--shadow-md); }
    .language-dropdown.show { display:grid; gap:2px; }
    .language-option { border-radius:var(--radius-sm); padding:9px 11px; cursor:pointer; color:var(--text-2); font-size:.875rem; transition:background-color .15s ease,color .15s ease; }
    .language-option:hover,.language-option.active { background:var(--accent-soft); color:var(--text); }
    .workspace-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(330px,.85fr); gap:18px; align-items:start; }
    .input-panel,.voice-panel,.transcription-panel { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:24px; transition:border-color .2s ease,box-shadow .2s ease; }
    .panel-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; }
    .panel-header h2 { margin:0; font-family:var(--font-display); font-size:1.08rem; font-weight:600; letter-spacing:-.01em; }
    .panel-header p { margin:4px 0 0; color:var(--text-2); font-size:.85rem; line-height:1.45; }
    .voice-count { flex-shrink:0; font-family:var(--font-mono); font-size:.72rem; color:var(--text-2); background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-pill); padding:4px 11px; white-space:nowrap; }
    .form-group { margin-bottom:18px; }
    .form-label { display:block; margin-bottom:8px; font-weight:600; font-size:.8rem; letter-spacing:.01em; }
    .form-input,.form-select,.form-textarea { width:100%; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface); color:var(--text); padding:11px 13px; outline:none; transition:border-color .15s ease,box-shadow .15s ease; }
    .form-input::placeholder,.form-textarea::placeholder { color:var(--text-3); }
    .form-input:focus,.form-select:focus,.form-textarea:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-ring); }
    .form-select { cursor:pointer; }
    .form-textarea { min-height:240px; resize:vertical; line-height:1.6; }
    .transcription-panel .form-textarea { min-height:160px; }
    .input-method-tabs { display:flex; gap:8px; }
    .tab-btn { border:1px solid var(--border); background:var(--surface-2); color:var(--text-2); padding:8px 14px; font-weight:600; font-size:.82rem; border-radius:var(--radius-sm); cursor:pointer; transition:color .18s ease,background-color .18s ease,border-color .18s ease,box-shadow .18s ease; }
    .tab-btn:hover { color:var(--text); border-color:var(--border-strong); }
    .tab-btn.active { background:var(--accent); border-color:var(--accent); color:var(--on-accent); box-shadow:var(--shadow-accent); }
    .file-drop-zone,.audio-upload-zone { border:1.5px dashed var(--border-strong); border-radius:var(--radius-md); background:var(--surface-2); padding:28px; text-align:center; cursor:pointer; transition:border-color .2s ease,background-color .2s ease; }
    .file-drop-zone:hover,.audio-upload-zone:hover,.file-drop-zone.dragover,.audio-upload-zone.dragover { border-color:var(--accent); background:var(--accent-soft); }
    .file-drop-text { margin:0; font-weight:600; }
    .file-drop-hint { margin:6px 0 0; color:var(--text-2); font-size:.82rem; }
    .file-info { display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid var(--border); border-radius:var(--radius-sm); padding:11px 13px; background:var(--surface-2); }
    .file-details { display:grid; gap:2px; min-width:0; }
    .file-name { font-weight:600; overflow-wrap:anywhere; }
    .file-size { color:var(--text-2); font-size:.78rem; font-family:var(--font-mono); }
    .file-remove-btn { flex-shrink:0; border:0; background:var(--error); color:#fff; width:30px; height:30px; border-radius:var(--radius-sm); cursor:pointer; font-size:1.15rem; line-height:1; transition:opacity .15s ease; }
    .file-remove-btn:hover { opacity:.85; }
    .controls-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
    .btn-primary,.btn-secondary { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:0; border-radius:var(--radius-md); font-family:var(--font-display); font-weight:600; text-decoration:none; cursor:pointer; transition:background-color .2s ease,transform .15s ease,box-shadow .2s ease,border-color .2s ease; }
    .btn-primary { width:100%; min-height:48px; margin-top:4px; background:var(--accent); color:var(--on-accent); padding:13px 18px; font-size:.95rem; box-shadow:var(--shadow-accent); }
    .btn-primary:hover:not(:disabled) { background:var(--accent-hover); transform:translateY(-1px); }
    .btn-primary:active:not(:disabled) { transform:translateY(0); }
    .btn-primary:disabled { opacity:.55; cursor:not-allowed; box-shadow:none; }
    .btn-secondary { background:var(--surface-2); color:var(--text); padding:10px 14px; border:1px solid var(--border); font-size:.85rem; }
    .btn-secondary:hover { background:var(--surface-3); border-color:var(--border-strong); }
    .filter-group { display:flex; flex-wrap:wrap; gap:7px; margin:12px 0; }
    .filter-chip { border:1px solid var(--border); background:var(--surface-2); color:var(--text-2); padding:6px 13px; font-weight:600; font-size:.78rem; border-radius:var(--radius-pill); cursor:pointer; transition:color .18s ease,background-color .18s ease,border-color .18s ease; }
    .filter-chip:hover { color:var(--text); border-color:var(--border-strong); }
    .filter-chip.active { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
    .selected-voice { margin:14px 0 12px; padding:10px 13px; background:var(--accent-soft); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:var(--radius-sm); color:var(--text); font-size:.8rem; overflow-wrap:anywhere; }
    .voice-list { display:grid; gap:9px; max-height:430px; overflow:auto; padding:2px; margin:0 -2px; }
    .voice-list::-webkit-scrollbar { width:8px; }
    .voice-list::-webkit-scrollbar-thumb { background:var(--border-strong); border-radius:4px; }
    .voice-list::-webkit-scrollbar-track { background:transparent; }
    .voice-item { position:relative; display:grid; gap:3px; width:100%; border:1px solid var(--border); background:var(--surface); color:var(--text); padding:12px 14px; text-align:left; border-radius:var(--radius-md); cursor:pointer; transition:border-color .15s ease,background-color .15s ease,transform .15s ease; }
    .voice-item:hover { border-color:var(--border-strong); background:var(--surface-2); transform:translateX(2px); }
    .voice-item.active { border-color:var(--accent); background:var(--accent-soft); }
    .voice-item.active::before { content:""; position:absolute; left:0; top:13px; bottom:13px; width:3px; border-radius:0 3px 3px 0; background:var(--accent); }
    .voice-name { font-weight:600; font-size:.92rem; }
    .voice-meta { color:var(--text-2); font-size:.78rem; }
    .voice-id { color:var(--text-3); font-size:.72rem; font-family:var(--font-mono); overflow-wrap:anywhere; }
    .empty-state { color:var(--warning); font-size:.85rem; padding:8px 0; }
    .result-container { display:none; margin-top:18px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--surface-2); padding:16px; }
    .loading-container { text-align:center; color:var(--text-2); padding:8px; }
    .loading-spinner { width:30px; height:30px; margin:0 auto 12px; border-radius:50%; border:3px solid var(--border); border-top-color:var(--accent); animation:spin 1s linear infinite; }
    .loading-text { margin:0 0 4px; font-weight:600; color:var(--text); }
    .progress-info { font-size:.78rem; color:var(--text-2); font-family:var(--font-mono); }
    .audio-player { width:100%; margin-bottom:12px; }
    .error-message { color:var(--error); background:var(--error-bg); border:1px solid var(--error-border); border-radius:var(--radius-sm); padding:12px 14px; font-size:.88rem; }
    .token-config { display:flex; flex-wrap:wrap; gap:14px; }
    .token-config label { display:inline-flex; align-items:center; gap:7px; font-size:.85rem; color:var(--text-2); cursor:pointer; }
    .token-config input[type=radio] { accent-color:var(--accent); }
    .result-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion:reduce) {
      *,*::before,*::after { animation-duration:.001ms!important; animation-iteration-count:1!important; transition-duration:.001ms!important; }
      .wave i { height:55%; }
    }
    @media (max-width:880px) {
      .app-shell { width:min(100% - 28px,720px); padding-top:18px; }
      .topbar { flex-direction:column; align-items:stretch; gap:14px; }
      .topbar-actions { justify-content:space-between; }
      .mode-switcher { flex:1; } .mode-btn { flex:1; }
      .workspace-grid,.controls-grid { grid-template-columns:1fr; }
      .panel-header { flex-direction:column; }
      .form-textarea { min-height:180px; }
    }
  </style>
  <script>(function(){try{var t=localStorage.getItem('voicecraft-theme');if(!t){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();</script>
</head>
<body>
  <div class="toast-host" id="toastHost" aria-live="assertive" aria-atomic="true"></div>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true"><span class="wave"><i></i><i></i><i></i><i></i><i></i></span></span><div><h1 data-i18n="header.title">VoiceCraft</h1><p data-i18n="header.subtitle">AI voice workspace</p></div></div>
      <div class="topbar-actions">
        <div class="mode-switcher" role="tablist" aria-label="VoiceCraft mode"><button type="button" class="mode-btn active" id="ttsMode" role="tab" aria-selected="true"><span data-i18n="mode.tts">Text to Speech</span></button><button type="button" class="mode-btn" id="transcriptionMode" role="tab" aria-selected="false"><span data-i18n="mode.transcription">Speech to Text</span></button></div>
        <button type="button" class="theme-btn" id="themeBtn" aria-label="Toggle color theme" title="Toggle theme"><svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg><svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button>
        <div class="language-switcher"><button type="button" class="language-btn" id="languageBtn" aria-haspopup="listbox" aria-expanded="false"><span id="currentLangFlag">🌐</span><span id="currentLangName" data-i18n="lang.current">English</span></button><div class="language-dropdown" id="languageDropdown" role="listbox" aria-label="Language"><div class="language-option" data-lang="en">English</div><div class="language-option" data-lang="zh">中文</div><div class="language-option" data-lang="ja">日本語</div><div class="language-option" data-lang="ko">한국어</div><div class="language-option" data-lang="es">Español</div><div class="language-option" data-lang="fr">Français</div><div class="language-option" data-lang="de">Deutsch</div><div class="language-option" data-lang="ru">Русский</div></div></div>
      </div>
    </header>
    <main class="workspace">
      <section class="workspace-grid" id="ttsWorkspace">
        <form id="ttsForm" class="input-panel">
          <div class="panel-header"><div><h2 data-i18n="tts.title">Text to Speech</h2><p data-i18n="tts.subtitle">Write or upload text, tune the voice, then generate an MP3.</p></div></div>
          <div class="form-group"><label class="form-label" data-i18n="input.method">Input method</label><div class="input-method-tabs"><button type="button" class="tab-btn active" id="textInputTab" data-i18n="input.manual">Manual text</button><button type="button" class="tab-btn" id="fileUploadTab" data-i18n="input.upload">Upload txt</button></div></div>
          <div class="form-group" id="textInputArea"><label class="form-label" for="text" data-i18n="input.text">Input text</label><textarea class="form-textarea" id="text" placeholder="请输入要转换为语音的文本内容..." data-i18n-placeholder="input.textPlaceholder" required></textarea><span id="textCounter" class="char-counter" aria-hidden="true"></span></div>
          <div class="form-group" id="fileUploadArea" style="display:none"><label class="form-label" for="fileInput" data-i18n="input.file">Upload txt file</label><div class="file-drop-zone" id="fileDropZone" role="button" tabindex="0" aria-label="Upload txt file, drop or activate to choose"><p class="file-drop-text" data-i18n="input.fileDrop">Drop a txt file here, or click to choose</p><p class="file-drop-hint" data-i18n="input.fileHint">TXT only, max 500KB</p><input type="file" id="fileInput" accept=".txt,text/plain" style="display:none"></div><div class="file-info" id="fileInfo" style="display:none"><div class="file-details"><span class="file-name" id="fileName"></span><span class="file-size" id="fileSize"></span></div><button type="button" class="file-remove-btn" id="fileRemoveBtn">×</button></div></div>
          <div class="controls-grid"><div class="form-group"><label class="form-label" for="speed" data-i18n="control.speed">Speed</label><select class="form-select" id="speed"><option value="0.5">Very slow</option><option value="0.75">Slow</option><option value="1.0" selected>Normal</option><option value="1.25">Fast</option><option value="1.5">Very fast</option><option value="2.0">Extreme</option></select></div><div class="form-group"><label class="form-label" for="pitch" data-i18n="control.pitch">Pitch</label><select class="form-select" id="pitch"><option value="-50">Very low</option><option value="-25">Low</option><option value="0" selected>Standard</option><option value="25">High</option><option value="50">Very high</option></select></div><div class="form-group"><label class="form-label" for="style" data-i18n="control.style">Style</label><select class="form-select" id="style"><option value="general" selected>General</option><option value="assistant">Assistant</option><option value="chat">Chat</option><option value="customerservice">Customer service</option><option value="newscast">Newscast</option><option value="affectionate">Affectionate</option><option value="calm">Calm</option><option value="cheerful">Cheerful</option><option value="gentle">Gentle</option><option value="lyrical">Lyrical</option><option value="serious">Serious</option></select></div></div>
          <button type="submit" class="btn-primary" id="generateBtn"><span data-i18n="action.generate">Generate voice</span></button>
          <div id="result" class="result-container"><div id="loading" class="loading-container" style="display:none" aria-live="polite"><div class="loading-spinner"></div><p class="loading-text" id="loadingText">Generating voice...</p><div class="progress-info" id="progressInfo"></div></div><div id="success" style="display:none"><audio id="audioPlayer" class="audio-player" controls></audio><a id="downloadBtn" class="btn-secondary" download="speech.mp3">Download MP3</a></div><div id="error" class="error-message" style="display:none" role="alert"></div></div>
        </form>
        <aside class="voice-panel"><div class="panel-header"><div><h2 data-i18n="voice.title">Voice Library</h2><p data-i18n="voice.subtitle">Search 114 Edge voices by name, locale, gender, or ID.</p></div><span class="voice-count" id="voiceCount">114 voices</span></div><div class="voice-search"><label class="form-label" for="voiceSearch" data-i18n="voice.search">Search voices</label><input class="form-input" id="voiceSearch" type="search" placeholder="Xiaoxiao, Jenny, zh-CN, en-US..." data-i18n-placeholder="voice.searchPlaceholder" autocomplete="off"></div><div class="filter-group" id="voiceLanguageFilters" aria-label="Language filters"></div><div class="filter-group" id="voiceGenderFilters" aria-label="Gender filters"></div><input type="hidden" id="selectedVoiceId" value="zh-CN-XiaoxiaoNeural"><p class="selected-voice" id="selectedVoiceSummary">Selected: zh-CN-XiaoxiaoNeural</p><div class="voice-list" id="voiceList" role="listbox" aria-label="Voice options"></div><p class="empty-state" id="voiceEmptyState" style="display:none" data-i18n="voice.empty">No voices match your search.</p></aside>
      </section>
      <section class="transcription-panel" id="transcriptionContainer" style="display:none">
        <form id="transcriptionForm"><div class="panel-header"><div><h2 data-i18n="stt.title">Speech to Text</h2><p data-i18n="stt.subtitle">Upload audio and transcribe it with the existing API flow.</p></div></div><div class="form-group"><label class="form-label" data-i18n="stt.upload">Upload audio file</label><div class="audio-upload-zone" id="audioDropZone" role="button" tabindex="0" aria-label="Upload audio file, drop or activate to choose"><p class="file-drop-text" data-i18n="stt.fileDrop">Drop an audio file here, or click to choose</p><p class="file-drop-hint" data-i18n="stt.fileHint">mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. Max 10MB</p><input type="file" id="audioFileInput" accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,.webm,.amr,.3gp,audio/*" style="display:none"></div><div class="file-info" id="audioFileInfo" style="display:none"><div class="file-details"><span class="file-name" id="audioFileName"></span><span class="file-size" id="audioFileSize"></span></div><button type="button" class="file-remove-btn" id="audioFileRemoveBtn">×</button></div></div><div class="form-group"><label class="form-label" for="tokenInput" data-i18n="token.title">API Token</label><div class="token-config"><label><input type="radio" name="tokenOption" value="default" checked> <span data-i18n="token.default">Use default token</span></label><label><input type="radio" name="tokenOption" value="custom"> <span data-i18n="token.custom">Use custom SiliconFlow token</span></label></div><input type="password" class="form-input" id="tokenInput" placeholder="Enter API token" data-i18n-placeholder="token.placeholder" style="display:none;margin-top:10px"></div><button type="submit" class="btn-primary" id="transcribeBtn"><span data-i18n="action.transcribe">Transcribe audio</span></button></form>
        <div id="transcriptionResult" class="result-container"><div id="transcriptionLoading" class="loading-container" style="display:none" aria-live="polite"><div class="loading-spinner"></div><p class="loading-text" id="transcriptionLoadingText">Transcribing audio...</p><div class="progress-info" id="transcriptionProgressInfo"></div></div><div id="transcriptionSuccess" style="display:none"><div class="transcription-result"><label class="form-label" for="transcriptionText" data-i18n="stt.result">Transcription result</label><textarea class="form-textarea" id="transcriptionText" placeholder="Transcription result appears here..." data-i18n-placeholder="stt.resultPlaceholder" readonly></textarea><div class="result-actions"><button type="button" class="btn-secondary" id="copyTranscriptionBtn" data-i18n="action.copy">Copy text</button><button type="button" class="btn-secondary" id="editTranscriptionBtn" data-i18n="action.edit">Edit text</button><button type="button" class="btn-secondary" id="useForTtsBtn" data-i18n="action.useForTts">Use for TTS</button></div></div></div><div id="transcriptionError" class="error-message" style="display:none" role="alert"></div></div>
      </section>
    </main>
  </div>
  <script>
    const VOICES = [
  { id: "zh-CN-XiaoxiaoNeural", name: "晓晓 Xiaoxiao", locale: "zh-CN", language: "Chinese", gender: "Female", description: "温柔" },
  { id: "zh-CN-YunxiNeural", name: "云希 Yunxi", locale: "zh-CN", language: "Chinese", gender: "Male", description: "清朗" },
  { id: "zh-CN-YunyangNeural", name: "云扬 Yunyang", locale: "zh-CN", language: "Chinese", gender: "Male", description: "阳光" },
  { id: "zh-CN-XiaoyiNeural", name: "晓伊 Xiaoyi", locale: "zh-CN", language: "Chinese", gender: "Female", description: "甜美" },
  { id: "zh-CN-YunjianNeural", name: "云健 Yunjian", locale: "zh-CN", language: "Chinese", gender: "Male", description: "稳重" },
  { id: "zh-CN-XiaochenNeural", name: "晓辰 Xiaochen", locale: "zh-CN", language: "Chinese", gender: "Female", description: "知性" },
  { id: "zh-CN-XiaohanNeural", name: "晓涵 Xiaohan", locale: "zh-CN", language: "Chinese", gender: "Female", description: "优雅" },
  { id: "zh-CN-XiaomengNeural", name: "晓梦 Xiaomeng", locale: "zh-CN", language: "Chinese", gender: "Female", description: "梦幻" },
  { id: "zh-CN-XiaomoNeural", name: "晓墨 Xiaomo", locale: "zh-CN", language: "Chinese", gender: "Female", description: "文艺" },
  { id: "zh-CN-XiaoqiuNeural", name: "晓秋 Xiaoqiu", locale: "zh-CN", language: "Chinese", gender: "Female", description: "成熟" },
  { id: "zh-CN-XiaoruiNeural", name: "晓睿 Xiaorui", locale: "zh-CN", language: "Chinese", gender: "Female", description: "智慧" },
  { id: "zh-CN-XiaoshuangNeural", name: "晓双 Xiaoshuang", locale: "zh-CN", language: "Chinese", gender: "Female", description: "活泼" },
  { id: "zh-CN-XiaoxuanNeural", name: "晓萱 Xiaoxuan", locale: "zh-CN", language: "Chinese", gender: "Female", description: "清新" },
  { id: "zh-CN-XiaoyanNeural", name: "晓颜 Xiaoyan", locale: "zh-CN", language: "Chinese", gender: "Female", description: "柔美" },
  { id: "zh-CN-XiaoyouNeural", name: "晓悠 Xiaoyou", locale: "zh-CN", language: "Chinese", gender: "Female", description: "悠扬" },
  { id: "zh-CN-XiaozhenNeural", name: "晓甄 Xiaozhen", locale: "zh-CN", language: "Chinese", gender: "Female", description: "端庄" },
  { id: "zh-CN-YunfengNeural", name: "云枫 Yunfeng", locale: "zh-CN", language: "Chinese", gender: "Male", description: "磁性" },
  { id: "zh-CN-YunhaoNeural", name: "云皓 Yunhao", locale: "zh-CN", language: "Chinese", gender: "Male", description: "豪迈" },
  { id: "zh-CN-YunxiaNeural", name: "云夏 Yunxia", locale: "zh-CN", language: "Chinese", gender: "Male", description: "热情" },
  { id: "zh-CN-YunyeNeural", name: "云野 Yunye", locale: "zh-CN", language: "Chinese", gender: "Male", description: "野性" },
  { id: "zh-CN-YunzeNeural", name: "云泽 Yunze", locale: "zh-CN", language: "Chinese", gender: "Male", description: "深沉" },
  { id: "en-US-JennyNeural", name: "Jenny", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-GuyNeural", name: "Guy", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-AriaNeural", name: "Aria", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-DavisNeural", name: "Davis", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-AmberNeural", name: "Amber", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-AnaNeural", name: "Ana", locale: "en-US", language: "English", gender: "Female", description: "Child, US" },
  { id: "en-US-AndrewNeural", name: "Andrew", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-AshleyNeural", name: "Ashley", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-BrandonNeural", name: "Brandon", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-ChristopherNeural", name: "Christopher", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-CoraNeural", name: "Cora", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-ElizabethNeural", name: "Elizabeth", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-EricNeural", name: "Eric", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-JacobNeural", name: "Jacob", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-JaneNeural", name: "Jane", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-JasonNeural", name: "Jason", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-MichelleNeural", name: "Michelle", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-MonicaNeural", name: "Monica", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-NancyNeural", name: "Nancy", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-RogerNeural", name: "Roger", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-SaraNeural", name: "Sara", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-SteffanNeural", name: "Steffan", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-TonyNeural", name: "Tony", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-GB-SoniaNeural", name: "Sonia", locale: "en-GB", language: "English", gender: "Female", description: "UK" },
  { id: "en-GB-RyanNeural", name: "Ryan", locale: "en-GB", language: "English", gender: "Male", description: "UK" },
  { id: "en-GB-LibbyNeural", name: "Libby", locale: "en-GB", language: "English", gender: "Female", description: "UK" },
  { id: "en-GB-MaisieNeural", name: "Maisie", locale: "en-GB", language: "English", gender: "Female", description: "Child, UK" },
  { id: "en-AU-NatashaNeural", name: "Natasha", locale: "en-AU", language: "English", gender: "Female", description: "AU" },
  { id: "en-AU-WilliamNeural", name: "William", locale: "en-AU", language: "English", gender: "Male", description: "AU" },
  { id: "ja-JP-NanamiNeural", name: "Nanami 七海", locale: "ja-JP", language: "Japanese", gender: "Female", description: "" },
  { id: "ja-JP-KeitaNeural", name: "Keita 圭太", locale: "ja-JP", language: "Japanese", gender: "Male", description: "" },
  { id: "ja-JP-AoiNeural", name: "Aoi 葵", locale: "ja-JP", language: "Japanese", gender: "Female", description: "" },
  { id: "ja-JP-DaichiNeural", name: "Daichi 大地", locale: "ja-JP", language: "Japanese", gender: "Male", description: "" },
  { id: "ja-JP-MayuNeural", name: "Mayu 真由", locale: "ja-JP", language: "Japanese", gender: "Female", description: "" },
  { id: "ja-JP-NaokiNeural", name: "Naoki 直樹", locale: "ja-JP", language: "Japanese", gender: "Male", description: "" },
  { id: "ja-JP-ShioriNeural", name: "Shiori 栞", locale: "ja-JP", language: "Japanese", gender: "Female", description: "" },
  { id: "ko-KR-SunHiNeural", name: "SunHi 선희", locale: "ko-KR", language: "Korean", gender: "Female", description: "" },
  { id: "ko-KR-InJoonNeural", name: "InJoon 인준", locale: "ko-KR", language: "Korean", gender: "Male", description: "" },
  { id: "ko-KR-BongJinNeural", name: "BongJin 봉진", locale: "ko-KR", language: "Korean", gender: "Male", description: "" },
  { id: "ko-KR-GookMinNeural", name: "GookMin 국민", locale: "ko-KR", language: "Korean", gender: "Male", description: "" },
  { id: "ko-KR-JiMinNeural", name: "JiMin 지민", locale: "ko-KR", language: "Korean", gender: "Female", description: "" },
  { id: "ko-KR-SeoHyeonNeural", name: "SeoHyeon 서현", locale: "ko-KR", language: "Korean", gender: "Female", description: "" },
  { id: "ko-KR-SoonBokNeural", name: "SoonBok 순복", locale: "ko-KR", language: "Korean", gender: "Female", description: "" },
  { id: "ko-KR-YuJinNeural", name: "YuJin 유진", locale: "ko-KR", language: "Korean", gender: "Female", description: "" },
  { id: "fr-FR-DeniseNeural", name: "Denise", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-HenriNeural", name: "Henri", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-EloiseNeural", name: "Eloise", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-AlainNeural", name: "Alain", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-BrigitteNeural", name: "Brigitte", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-CelesteNeural", name: "Celeste", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-ClaudeNeural", name: "Claude", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-CoraliNeural", name: "Corali", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-JacquelineNeural", name: "Jacqueline", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-JeromeNeural", name: "Jerome", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-JosephineNeural", name: "Josephine", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-MauriceNeural", name: "Maurice", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-YvesNeural", name: "Yves", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-YvetteNeural", name: "Yvette", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "de-DE-KatjaNeural", name: "Katja", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-ConradNeural", name: "Conrad", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-AmalaNeural", name: "Amala", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-BerndNeural", name: "Bernd", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-ChristophNeural", name: "Christoph", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-ElkeNeural", name: "Elke", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-GiselaNeural", name: "Gisela", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-KasperNeural", name: "Kasper", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-KillianNeural", name: "Killian", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-KlarissaNeural", name: "Klarissa", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-KlausNeural", name: "Klaus", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-LouisaNeural", name: "Louisa", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-MajaNeural", name: "Maja", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-RalfNeural", name: "Ralf", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-TanjaNeural", name: "Tanja", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "es-ES-ElviraNeural", name: "Elvira", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-AlvaroNeural", name: "Alvaro", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-AbrilNeural", name: "Abril", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-ArnauNeural", name: "Arnau", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-DarioNeural", name: "Dario", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-EliasNeural", name: "Elias", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-EstrellaNeural", name: "Estrella", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-IreneNeural", name: "Irene", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-LaiaNeural", name: "Laia", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-LiaNeural", name: "Lia", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-NilNeural", name: "Nil", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-SaulNeural", name: "Saul", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-TeoNeural", name: "Teo", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-TrianaNeural", name: "Triana", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-VeraNeural", name: "Vera", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-MX-DaliaNeural", name: "Dalia", locale: "es-MX", language: "Spanish", gender: "Female", description: "MX" },
  { id: "es-MX-JorgeNeural", name: "Jorge", locale: "es-MX", language: "Spanish", gender: "Male", description: "MX" },
  { id: "ru-RU-SvetlanaNeural", name: "Svetlana Светлана", locale: "ru-RU", language: "Russian", gender: "Female", description: "" },
  { id: "ru-RU-DmitryNeural", name: "Dmitry Дмитрий", locale: "ru-RU", language: "Russian", gender: "Male", description: "" },
  { id: "ru-RU-DariyaNeural", name: "Dariya Дарья", locale: "ru-RU", language: "Russian", gender: "Female", description: "" }
    ];
    let selectedFile = null;
    let currentInputMethod = 'text';
    let currentMode = 'tts';
    let selectedAudioFile = null;
    let currentLanguage = 'en';
    let selectedVoiceId = 'zh-CN-XiaoxiaoNeural';
    let activeLanguageFilter = 'All';
    let activeGenderFilter = 'All';
    let voiceSearchTimer = null;
    const CONFIG = { SEARCH_DEBOUNCE: 120, COPY_FEEDBACK: 1500, MAX_TEXT_LENGTH: 10000 };
    const translations = {
      en: {
        'page.title': 'VoiceCraft - AI Voice Workspace',
        'page.description': 'VoiceCraft is a focused AI voice workspace with 114 voices.',
        'page.keywords': 'text to speech,AI voice synthesis,online TTS,speech to text,voice transcription',
        'lang.current': 'English',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'AI voice workspace',
        'mode.tts': 'Text to Speech',
        'mode.transcription': 'Speech to Text',
        'tts.title': 'Text to Speech',
        'tts.subtitle': 'Write or upload text, tune the voice, then generate an MP3.',
        'input.method': 'Input method',
        'input.manual': 'Manual text',
        'input.upload': 'Upload txt',
        'input.text': 'Input text',
        'input.textPlaceholder': 'Enter text to convert to speech...',
        'input.file': 'Upload txt file',
        'input.fileDrop': 'Drop a txt file here, or click to choose',
        'input.fileHint': 'TXT only, max 500KB',
        'control.speed': 'Speed',
        'control.pitch': 'Pitch',
        'control.style': 'Style',
        'voice.title': 'Voice Library',
        'voice.subtitle': 'Search 114 Edge voices by name, locale, gender, or ID.',
        'voice.search': 'Search voices',
        'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...',
        'voice.empty': 'No voices match your search.',
        'voice.selected': 'Selected',
        'stt.title': 'Speech to Text',
        'stt.subtitle': 'Upload audio and transcribe it with the existing API flow.',
        'stt.upload': 'Upload audio file',
        'stt.fileDrop': 'Drop an audio file here, or click to choose',
        'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. Max 10MB',
        'stt.result': 'Transcription result',
        'stt.resultPlaceholder': 'Transcription result appears here...',
        'token.title': 'API Token',
        'token.default': 'Use default token',
        'token.custom': 'Use custom SiliconFlow token',
        'token.placeholder': 'Enter API token',
        'action.generate': 'Generate voice',
        'action.transcribe': 'Transcribe audio',
        'action.copy': 'Copy text',
        'action.edit': 'Edit text',
        'action.save': 'Save edit',
        'action.copied': 'Copied',
        'action.useForTts': 'Use for TTS',
        'status.generating': 'Generating...',
        'status.longText': 'Processing long text...',
        'status.file': 'Processing uploaded file...',
        'status.transcribing': 'Transcribing...'
      },
      zh: {
        'page.title': 'VoiceCraft - AI 语音工作台',
        'page.description': 'VoiceCraft 是一个 AI 语音工作台，支持 114 种声音。',
        'page.keywords': '文字转语音,AI语音合成,在线TTS,语音转文字,语音转录',
        'lang.current': '中文',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'AI 语音工作台',
        'mode.tts': '文字转语音',
        'mode.transcription': '语音转文字',
        'tts.title': '文字转语音',
        'tts.subtitle': '输入或上传文本，选择声音和参数后生成 MP3。',
        'input.method': '输入方式',
        'input.manual': '手动输入',
        'input.upload': '上传 txt',
        'input.text': '输入文本',
        'input.textPlaceholder': '请输入要转换为语音的文本内容...',
        'input.file': '上传 txt 文件',
        'input.fileDrop': '拖拽 txt 文件到此处，或点击选择',
        'input.fileHint': '仅支持 TXT，最大 500KB',
        'control.speed': '语速',
        'control.pitch': '音调',
        'control.style': '风格',
        'voice.title': '声音库',
        'voice.subtitle': '按名称、地区、性别或 ID 搜索 114 个 Edge 声音。',
        'voice.search': '搜索声音',
        'voice.searchPlaceholder': '晓晓、Jenny、zh-CN、en-US...',
        'voice.empty': '没有匹配的声音。',
        'voice.selected': '已选择',
        'stt.title': '语音转文字',
        'stt.subtitle': '上传音频，使用现有 API 流程转录。',
        'stt.upload': '上传音频文件',
        'stt.fileDrop': '拖拽音频文件到此处，或点击选择',
        'stt.fileHint': '支持 mp3、wav、m4a、flac、aac、ogg、webm、amr、3gp，最大 10MB',
        'stt.result': '转录结果',
        'stt.resultPlaceholder': '转录结果将在这里显示...',
        'token.title': 'API Token',
        'token.default': '使用默认 Token',
        'token.custom': '使用硅基流动自定义 Token',
        'token.placeholder': '输入 API Token',
        'action.generate': '生成语音',
        'action.transcribe': '开始转录',
        'action.copy': '复制文本',
        'action.edit': '编辑文本',
        'action.save': '保存编辑',
        'action.copied': '已复制',
        'action.useForTts': '转为语音',
        'status.generating': '正在生成...',
        'status.longText': '正在处理长文本...',
        'status.file': '正在处理上传文件...',
        'status.transcribing': '正在转录...'
      },
      ja: { 'page.title': 'VoiceCraft - AI音声ワークスペース', 'page.description': 'VoiceCraft AI音声ワークスペース with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': '日本語', 'header.subtitle': 'AI音声ワークスペース', 'mode.tts': 'テキスト読み上げ', 'mode.transcription': '音声テキスト変換', 'tts.title': 'テキスト読み上げ', 'tts.subtitle': 'テキストを入力またはアップロードし、音声と設定を選んでMP3を生成します。', 'input.method': '入力方法', 'input.manual': '手動入力', 'input.upload': 'txtをアップロード', 'input.text': '入力テキスト', 'input.textPlaceholder': '音声に変換するテキストを入力してください...', 'input.file': 'txtファイルをアップロード', 'input.fileDrop': 'txtファイルをここにドロップ、またはクリックして選択', 'input.fileHint': 'TXTのみ、最大500KB', 'control.speed': '速度', 'control.pitch': 'ピッチ', 'control.style': 'スタイル', 'voice.title': '音声ライブラリ', 'voice.subtitle': '名前、ロケール、性別、IDで114個のEdge音声を検索します。', 'voice.search': '音声を検索', 'voice.searchPlaceholder': 'Xiaoxiao、Jenny、zh-CN、en-US...', 'voice.empty': '一致する音声がありません。', 'voice.selected': '選択中', 'stt.title': '音声テキスト変換', 'stt.subtitle': '音声をアップロードし、既存のAPIフローで文字起こしします。', 'stt.upload': '音声ファイルをアップロード', 'stt.fileDrop': '音声ファイルをここにドロップ、またはクリックして選択', 'stt.fileHint': 'mp3、wav、m4a、flac、aac、ogg、webm、amr、3gp、最大10MB', 'stt.result': '文字起こし結果', 'stt.resultPlaceholder': '文字起こし結果がここに表示されます...', 'token.title': 'API Token', 'token.default': '既定のTokenを使用', 'token.custom': 'カスタムSiliconFlow Tokenを使用', 'token.placeholder': 'API Tokenを入力', 'action.generate': '音声を生成', 'action.transcribe': '文字起こしを開始', 'action.copy': 'テキストをコピー', 'action.edit': '編集', 'action.save': '編集を保存', 'action.copied': 'コピーしました', 'action.useForTts': 'TTSで使う', 'status.generating': '生成中...', 'status.longText': '長いテキストを処理中...', 'status.file': 'アップロードファイルを処理中...', 'status.transcribing': '文字起こし中...' }, ko: { 'page.title': 'VoiceCraft - AI 음성 작업 공간', 'page.description': 'VoiceCraft AI 음성 작업 공간 with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': '한국어', 'header.subtitle': 'AI 음성 작업 공간', 'mode.tts': '텍스트 음성 변환', 'mode.transcription': '음성 텍스트 변환', 'tts.title': '텍스트 음성 변환', 'tts.subtitle': '텍스트를 입력하거나 업로드하고 음성과 설정을 선택해 MP3를 생성합니다.', 'input.method': '입력 방식', 'input.manual': '직접 입력', 'input.upload': 'txt 업로드', 'input.text': '입력 텍스트', 'input.textPlaceholder': '음성으로 변환할 텍스트를 입력하세요...', 'input.file': 'txt 파일 업로드', 'input.fileDrop': 'txt 파일을 여기에 놓거나 클릭해 선택', 'input.fileHint': 'TXT만 지원, 최대 500KB', 'control.speed': '속도', 'control.pitch': '피치', 'control.style': '스타일', 'voice.title': '음성 라이브러리', 'voice.subtitle': '이름, 로캘, 성별 또는 ID로 114개 Edge 음성을 검색합니다.', 'voice.search': '음성 검색', 'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...', 'voice.empty': '일치하는 음성이 없습니다.', 'voice.selected': '선택됨', 'stt.title': '음성 텍스트 변환', 'stt.subtitle': '오디오를 업로드하고 기존 API 흐름으로 전사합니다.', 'stt.upload': '오디오 파일 업로드', 'stt.fileDrop': '오디오 파일을 여기에 놓거나 클릭해 선택', 'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. 최대 10MB', 'stt.result': '전사 결과', 'stt.resultPlaceholder': '전사 결과가 여기에 표시됩니다...', 'token.title': 'API Token', 'token.default': '기본 Token 사용', 'token.custom': '사용자 SiliconFlow Token 사용', 'token.placeholder': 'API Token 입력', 'action.generate': '음성 생성', 'action.transcribe': '전사 시작', 'action.copy': '텍스트 복사', 'action.edit': '편집', 'action.save': '편집 저장', 'action.copied': '복사됨', 'action.useForTts': 'TTS에 사용', 'status.generating': '생성 중...', 'status.longText': '긴 텍스트 처리 중...', 'status.file': '업로드 파일 처리 중...', 'status.transcribing': '전사 중...' }, es: { 'page.title': 'VoiceCraft - Espacio de trabajo de voz con IA', 'page.description': 'VoiceCraft Espacio de trabajo de voz con IA with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': 'Español', 'header.subtitle': 'Espacio de trabajo de voz con IA', 'mode.tts': 'Texto a voz', 'mode.transcription': 'Voz a texto', 'tts.title': 'Texto a voz', 'tts.subtitle': 'Escribe o sube texto, ajusta la voz y genera un MP3.', 'input.method': 'Método de entrada', 'input.manual': 'Texto manual', 'input.upload': 'Subir txt', 'input.text': 'Texto de entrada', 'input.textPlaceholder': 'Introduce el texto para convertirlo en voz...', 'input.file': 'Subir archivo txt', 'input.fileDrop': 'Suelta un txt aquí o haz clic para elegir', 'input.fileHint': 'Solo TXT, máximo 500KB', 'control.speed': 'Velocidad', 'control.pitch': 'Tono', 'control.style': 'Estilo', 'voice.title': 'Biblioteca de voces', 'voice.subtitle': 'Busca 114 voces Edge por nombre, región, género o ID.', 'voice.search': 'Buscar voces', 'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...', 'voice.empty': 'No hay voces coincidentes.', 'voice.selected': 'Seleccionado', 'stt.title': 'Voz a texto', 'stt.subtitle': 'Sube audio y transcríbelo con el flujo API existente.', 'stt.upload': 'Subir audio', 'stt.fileDrop': 'Suelta un audio aquí o haz clic para elegir', 'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. Máximo 10MB', 'stt.result': 'Resultado de transcripción', 'stt.resultPlaceholder': 'El resultado aparecerá aquí...', 'token.title': 'API Token', 'token.default': 'Usar Token predeterminado', 'token.custom': 'Usar Token personalizado de SiliconFlow', 'token.placeholder': 'Introduce API Token', 'action.generate': 'Generar voz', 'action.transcribe': 'Transcribir audio', 'action.copy': 'Copiar texto', 'action.edit': 'Editar texto', 'action.save': 'Guardar edición', 'action.copied': 'Copiado', 'action.useForTts': 'Usar para TTS', 'status.generating': 'Generando...', 'status.longText': 'Procesando texto largo...', 'status.file': 'Procesando archivo subido...', 'status.transcribing': 'Transcribiendo...' }, fr: { 'page.title': 'VoiceCraft - Espace de travail vocal IA', 'page.description': 'VoiceCraft Espace de travail vocal IA with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': 'Français', 'header.subtitle': 'Espace de travail vocal IA', 'mode.tts': 'Texte vers parole', 'mode.transcription': 'Parole vers texte', 'tts.title': 'Texte vers parole', 'tts.subtitle': 'Saisissez ou importez du texte, réglez la voix, puis générez un MP3.', 'input.method': 'Méthode de saisie', 'input.manual': 'Texte manuel', 'input.upload': 'Importer txt', 'input.text': 'Texte à saisir', 'input.textPlaceholder': 'Saisissez le texte à convertir en parole...', 'input.file': 'Importer un fichier txt', 'input.fileDrop': 'Déposez un txt ici ou cliquez pour choisir', 'input.fileHint': 'TXT uniquement, 500KB max', 'control.speed': 'Vitesse', 'control.pitch': 'Hauteur', 'control.style': 'Style', 'voice.title': 'Bibliothèque de voix', 'voice.subtitle': 'Recherchez 114 voix Edge par nom, région, genre ou ID.', 'voice.search': 'Rechercher des voix', 'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...', 'voice.empty': 'Aucune voix correspondante.', 'voice.selected': 'Sélectionné', 'stt.title': 'Parole vers texte', 'stt.subtitle': 'Importez un audio et transcrivez-le avec le flux API existant.', 'stt.upload': 'Importer un audio', 'stt.fileDrop': 'Déposez un audio ici ou cliquez pour choisir', 'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. 10MB max', 'stt.result': 'Résultat de transcription', 'stt.resultPlaceholder': 'Le résultat apparaîtra ici...', 'token.title': 'API Token', 'token.default': 'Utiliser le Token par défaut', 'token.custom': 'Utiliser un Token SiliconFlow personnalisé', 'token.placeholder': 'Saisir API Token', 'action.generate': 'Générer la voix', 'action.transcribe': 'Transcrire audio', 'action.copy': 'Copier le texte', 'action.edit': 'Modifier', 'action.save': 'Enregistrer', 'action.copied': 'Copié', 'action.useForTts': 'Utiliser pour TTS', 'status.generating': 'Génération...', 'status.longText': 'Traitement du texte long...', 'status.file': 'Traitement du fichier importé...', 'status.transcribing': 'Transcription...' }, de: { 'page.title': 'VoiceCraft - KI-Sprach-Arbeitsbereich', 'page.description': 'VoiceCraft KI-Sprach-Arbeitsbereich with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': 'Deutsch', 'header.subtitle': 'KI-Sprach-Arbeitsbereich', 'mode.tts': 'Text zu Sprache', 'mode.transcription': 'Sprache zu Text', 'tts.title': 'Text zu Sprache', 'tts.subtitle': 'Text eingeben oder hochladen, Stimme einstellen und MP3 erzeugen.', 'input.method': 'Eingabemethode', 'input.manual': 'Manueller Text', 'input.upload': 'txt hochladen', 'input.text': 'Eingabetext', 'input.textPlaceholder': 'Text zur Sprachsynthese eingeben...', 'input.file': 'txt-Datei hochladen', 'input.fileDrop': 'txt hier ablegen oder klicken', 'input.fileHint': 'Nur TXT, max. 500KB', 'control.speed': 'Geschwindigkeit', 'control.pitch': 'Tonhöhe', 'control.style': 'Stil', 'voice.title': 'Stimmenbibliothek', 'voice.subtitle': '114 Edge-Stimmen nach Name, Region, Geschlecht oder ID suchen.', 'voice.search': 'Stimmen suchen', 'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...', 'voice.empty': 'Keine passenden Stimmen.', 'voice.selected': 'Ausgewählt', 'stt.title': 'Sprache zu Text', 'stt.subtitle': 'Audio hochladen und mit dem bestehenden API-Ablauf transkribieren.', 'stt.upload': 'Audiodatei hochladen', 'stt.fileDrop': 'Audio hier ablegen oder klicken', 'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. Max. 10MB', 'stt.result': 'Transkriptionsergebnis', 'stt.resultPlaceholder': 'Das Ergebnis erscheint hier...', 'token.title': 'API Token', 'token.default': 'Standard-Token verwenden', 'token.custom': 'Eigenes SiliconFlow-Token verwenden', 'token.placeholder': 'API Token eingeben', 'action.generate': 'Stimme erzeugen', 'action.transcribe': 'Audio transkribieren', 'action.copy': 'Text kopieren', 'action.edit': 'Bearbeiten', 'action.save': 'Speichern', 'action.copied': 'Kopiert', 'action.useForTts': 'Für TTS verwenden', 'status.generating': 'Erzeuge...', 'status.longText': 'Langer Text wird verarbeitet...', 'status.file': 'Hochgeladene Datei wird verarbeitet...', 'status.transcribing': 'Transkribiere...' }, ru: { 'page.title': 'VoiceCraft - AI рабочая область голоса', 'page.description': 'VoiceCraft AI рабочая область голоса with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': 'Русский', 'header.subtitle': 'AI рабочая область голоса', 'mode.tts': 'Текст в речь', 'mode.transcription': 'Речь в текст', 'tts.title': 'Текст в речь', 'tts.subtitle': 'Введите или загрузите текст, настройте голос и создайте MP3.', 'input.method': 'Способ ввода', 'input.manual': 'Ввести текст', 'input.upload': 'Загрузить txt', 'input.text': 'Текст', 'input.textPlaceholder': 'Введите текст для озвучивания...', 'input.file': 'Загрузить txt файл', 'input.fileDrop': 'Перетащите txt сюда или нажмите для выбора', 'input.fileHint': 'Только TXT, до 500KB', 'control.speed': 'Скорость', 'control.pitch': 'Тон', 'control.style': 'Стиль', 'voice.title': 'Библиотека голосов', 'voice.subtitle': 'Поиск 114 голосов Edge по имени, региону, полу или ID.', 'voice.search': 'Поиск голосов', 'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...', 'voice.empty': 'Подходящих голосов нет.', 'voice.selected': 'Выбрано', 'stt.title': 'Речь в текст', 'stt.subtitle': 'Загрузите аудио и расшифруйте через текущий API.', 'stt.upload': 'Загрузить аудио', 'stt.fileDrop': 'Перетащите аудио сюда или нажмите для выбора', 'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. До 10MB', 'stt.result': 'Результат распознавания', 'stt.resultPlaceholder': 'Результат появится здесь...', 'token.title': 'API Token', 'token.default': 'Использовать Token по умолчанию', 'token.custom': 'Использовать свой SiliconFlow Token', 'token.placeholder': 'Введите API Token', 'action.generate': 'Создать голос', 'action.transcribe': 'Распознать аудио', 'action.copy': 'Копировать текст', 'action.edit': 'Редактировать', 'action.save': 'Сохранить', 'action.copied': 'Скопировано', 'action.useForTts': 'Использовать для TTS', 'status.generating': 'Создание...', 'status.longText': 'Обработка длинного текста...', 'status.file': 'Обработка загруженного файла...', 'status.transcribing': 'Распознавание...' }
    };
    const languageNames = { en:'English', zh:'中文', ja:'日本語', ko:'한국어', es:'Español', fr:'Français', de:'Deutsch', ru:'Русский' };
    document.addEventListener('DOMContentLoaded', function() { initializeTheme(); initializeI18n(); initializeInputMethodTabs(); initializeFileUpload(); initializeModeSwitcher(); initializeAudioUpload(); initializeTokenConfig(); initializeLanguageSwitcher(); initializeVoicePicker(); initializeTextCounter(); });
    function applyTheme(theme) { document.documentElement.setAttribute('data-theme', theme); }
    function initializeTheme() { const themeBtn = document.getElementById('themeBtn'); if (themeBtn) themeBtn.addEventListener('click', function() { const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; localStorage.setItem('voicecraft-theme', next); applyTheme(next); }); if (window.matchMedia) { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(event) { if (!localStorage.getItem('voicecraft-theme')) applyTheme(event.matches ? 'dark' : 'light'); }); } }
    function detectLanguage() { const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase(); if (browserLang.startsWith('zh')) return 'zh'; if (browserLang.startsWith('ja')) return 'ja'; if (browserLang.startsWith('ko')) return 'ko'; if (browserLang.startsWith('es')) return 'es'; if (browserLang.startsWith('fr')) return 'fr'; if (browserLang.startsWith('de')) return 'de'; if (browserLang.startsWith('ru')) return 'ru'; return 'en'; }
    function setLanguage(lang) { currentLanguage = translations[lang] ? lang : 'en'; localStorage.setItem('voicecraft-language', currentLanguage); applyTranslations(); updateLanguageSwitcher(); updateTextCounter(); }
    function t(key) { const dict = translations[currentLanguage] || translations.en; return dict[key] || translations.en[key] || key; }
    function applyTranslations() { document.querySelectorAll('[data-i18n]').forEach(function(element) { element.textContent = t(element.getAttribute('data-i18n')); }); document.querySelectorAll('[data-i18n-content]').forEach(function(element) { element.setAttribute('content', t(element.getAttribute('data-i18n-content'))); }); document.querySelectorAll('[data-i18n-placeholder]').forEach(function(element) { element.setAttribute('placeholder', t(element.getAttribute('data-i18n-placeholder'))); }); document.title = t('page.title'); if (document.getElementById('voiceList')) renderVoiceList(); }
    function updateLanguageSwitcher() { document.getElementById('currentLangName').textContent = languageNames[currentLanguage] || 'English'; document.querySelectorAll('.language-option').forEach(function(option) { option.classList.toggle('active', option.dataset.lang === currentLanguage); }); }
    function initializeI18n() { setLanguage(localStorage.getItem('voicecraft-language') || detectLanguage()); }
    function initializeLanguageSwitcher() { const languageBtn = document.getElementById('languageBtn'); const languageDropdown = document.getElementById('languageDropdown'); languageBtn.addEventListener('click', function(event) { event.stopPropagation(); const open = languageDropdown.classList.toggle('show'); languageBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }); document.addEventListener('click', function() { languageDropdown.classList.remove('show'); languageBtn.setAttribute('aria-expanded', 'false'); }); document.querySelectorAll('.language-option').forEach(function(option) { option.addEventListener('click', function(event) { event.stopPropagation(); setLanguage(option.dataset.lang); languageDropdown.classList.remove('show'); languageBtn.setAttribute('aria-expanded', 'false'); }); }); }
    function getSelectedVoiceId() { return selectedVoiceId; }
    function getVoiceById(voiceId) { return VOICES.find(function(voice) { return voice.id === voiceId; }) || VOICES[0]; }
    function getUniqueVoiceValues(key) { return ['All'].concat(Array.from(new Set(VOICES.map(function(voice) { return voice[key]; }))).sort()); }
    function filterVoices() { const query = document.getElementById('voiceSearch').value.trim().toLowerCase(); return VOICES.filter(function(voice) { const matchesLanguage = activeLanguageFilter === 'All' || voice.language === activeLanguageFilter; const matchesGender = activeGenderFilter === 'All' || voice.gender === activeGenderFilter; const searchText = [voice.id, voice.name, voice.locale, voice.language, voice.gender, voice.description].join(' ').toLowerCase(); return matchesLanguage && matchesGender && (!query || searchText.includes(query)); }); }
    function renderFilterGroup(containerId, values, activeValue, onSelect) { const container = document.getElementById(containerId); container.innerHTML = values.map(function(value) { const active = value === activeValue ? ' active' : ''; return '<button type="button" class="filter-chip' + active + '" data-value="' + value + '">' + value + '</button>'; }).join(''); container.querySelectorAll('.filter-chip').forEach(function(button) { button.addEventListener('click', function() { onSelect(button.dataset.value); }); }); }
    function renderVoiceList() { const voices = filterVoices(); const list = document.getElementById('voiceList'); const emptyState = document.getElementById('voiceEmptyState'); const selectedVoice = getVoiceById(selectedVoiceId); updateSelectedVoiceSummary(); document.getElementById('voiceCount').textContent = voices.length + ' of ' + VOICES.length + ' voices'; emptyState.style.display = voices.length ? 'none' : 'block'; list.innerHTML = voices.map(function(voice) { const active = voice.id === selectedVoice.id ? ' active' : ''; const description = voice.description ? ' · ' + voice.description : ''; return '<button type="button" class="voice-item' + active + '" data-voice-id="' + voice.id + '" role="option" tabindex="' + (voice.id === selectedVoice.id ? '0' : '-1') + '" aria-selected="' + (voice.id === selectedVoice.id) + '"><span class="voice-name">' + voice.name + '</span><span class="voice-meta">' + voice.locale + ' · ' + voice.gender + description + '</span><span class="voice-id">' + voice.id + '</span></button>'; }).join(''); }
    function updateSelectedVoiceSummary() { const v = getVoiceById(selectedVoiceId); document.getElementById('selectedVoiceId').value = v.id; document.getElementById('selectedVoiceSummary').textContent = t('voice.selected') + ': ' + v.name + ' · ' + v.id; }
    function selectVoice(voiceId) { selectedVoiceId = voiceId; const list = document.getElementById('voiceList'); list.querySelectorAll('.voice-item').forEach(function(item) { const active = item.dataset.voiceId === voiceId; item.classList.toggle('active', active); item.setAttribute('aria-selected', active); item.setAttribute('tabindex', active ? '0' : '-1'); }); updateSelectedVoiceSummary(); }
    function handleLanguageFilterSelect(value) { activeLanguageFilter = value; renderFilterGroup('voiceLanguageFilters', getUniqueVoiceValues('language'), activeLanguageFilter, handleLanguageFilterSelect); renderVoiceList(); }
    function handleGenderFilterSelect(value) { activeGenderFilter = value; renderFilterGroup('voiceGenderFilters', getUniqueVoiceValues('gender'), activeGenderFilter, handleGenderFilterSelect); renderVoiceList(); }
    function initializeVoicePicker() { renderFilterGroup('voiceLanguageFilters', getUniqueVoiceValues('language'), activeLanguageFilter, handleLanguageFilterSelect); renderFilterGroup('voiceGenderFilters', getUniqueVoiceValues('gender'), activeGenderFilter, handleGenderFilterSelect); document.getElementById('voiceSearch').addEventListener('input', function() { clearTimeout(voiceSearchTimer); voiceSearchTimer = setTimeout(renderVoiceList, CONFIG.SEARCH_DEBOUNCE); }); initializeVoiceKeyboard(); document.getElementById('voiceList').addEventListener('click', function(event) { const item = event.target.closest('.voice-item'); if (item) selectVoice(item.dataset.voiceId); }); renderVoiceList(); }
    function initializeVoiceKeyboard() { const list = document.getElementById('voiceList'); list.addEventListener('keydown', function(event) { const items = Array.from(list.querySelectorAll('.voice-item')); if (!items.length) return; const currentIndex = Math.max(0, items.findIndex(function(item) { return item.dataset.voiceId === selectedVoiceId; })); let nextIndex = currentIndex; if (event.key === 'ArrowDown') nextIndex = Math.min(items.length - 1, currentIndex + 1); else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1); else if (event.key === 'Home') nextIndex = 0; else if (event.key === 'End') nextIndex = items.length - 1; else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectVoice(items[currentIndex].dataset.voiceId); return; } else return; event.preventDefault(); selectVoice(items[nextIndex].dataset.voiceId); items[nextIndex].focus(); }); }
    function updateTextCounter() { const textInput = document.getElementById('text'); const counter = document.getElementById('textCounter'); if (!textInput || !counter) return; const length = textInput.value.length; counter.textContent = length ? length + ' / ' + CONFIG.MAX_TEXT_LENGTH : ''; counter.classList.toggle('warning', length > CONFIG.MAX_TEXT_LENGTH); }
    function initializeTextCounter() { const textInput = document.getElementById('text'); if (!textInput) return; textInput.addEventListener('input', updateTextCounter); updateTextCounter(); }
    function showToast(message) { if (!message) return; window.alert(message); }
    function initializeInputMethodTabs() { const textInputTab = document.getElementById('textInputTab'); const fileUploadTab = document.getElementById('fileUploadTab'); const textInputArea = document.getElementById('textInputArea'); const fileUploadArea = document.getElementById('fileUploadArea'); textInputTab.addEventListener('click', function() { currentInputMethod = 'text'; textInputTab.classList.add('active'); fileUploadTab.classList.remove('active'); textInputArea.style.display = 'block'; fileUploadArea.style.display = 'none'; document.getElementById('text').required = true; }); fileUploadTab.addEventListener('click', function() { currentInputMethod = 'file'; fileUploadTab.classList.add('active'); textInputTab.classList.remove('active'); textInputArea.style.display = 'none'; fileUploadArea.style.display = 'block'; document.getElementById('text').required = false; }); }
    function initializeFileUpload() { const fileDropZone = document.getElementById('fileDropZone'); const fileInput = document.getElementById('fileInput'); const fileRemoveBtn = document.getElementById('fileRemoveBtn'); fileDropZone.addEventListener('click', function() { fileInput.click(); }); fileDropZone.addEventListener('keydown', function(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } }); fileInput.addEventListener('change', function(event) { if (event.target.files[0]) handleFileSelect(event.target.files[0]); }); fileDropZone.addEventListener('dragover', function(event) { event.preventDefault(); fileDropZone.classList.add('dragover'); }); fileDropZone.addEventListener('dragleave', function(event) { event.preventDefault(); fileDropZone.classList.remove('dragover'); }); fileDropZone.addEventListener('drop', function(event) { event.preventDefault(); fileDropZone.classList.remove('dragover'); if (event.dataTransfer.files[0]) handleFileSelect(event.dataTransfer.files[0]); }); fileRemoveBtn.addEventListener('click', function() { selectedFile = null; fileInput.value = ''; document.getElementById('fileInfo').style.display = 'none'; fileDropZone.style.display = 'block'; }); }
    function handleFileSelect(file) { if (!file.type.includes('text/') && !file.name.toLowerCase().endsWith('.txt')) { alert('请选择txt格式的文本文件'); return; } if (file.size > 500 * 1024) { alert('文件大小不能超过500KB'); return; } selectedFile = file; document.getElementById('fileName').textContent = file.name; document.getElementById('fileSize').textContent = formatFileSize(file.size); document.getElementById('fileInfo').style.display = 'flex'; document.getElementById('fileDropZone').style.display = 'none'; }
    function formatFileSize(bytes) { if (bytes === 0) return '0 Bytes'; const k = 1024; const sizes = ['Bytes', 'KB', 'MB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; }
    document.getElementById('ttsForm').addEventListener('submit', async function(event) { event.preventDefault(); const voice = getSelectedVoiceId(); const speed = document.getElementById('speed').value; const pitch = document.getElementById('pitch').value; const style = document.getElementById('style').value; const generateBtn = document.getElementById('generateBtn'); const resultContainer = document.getElementById('result'); const loading = document.getElementById('loading'); const success = document.getElementById('success'); const error = document.getElementById('error'); if (currentInputMethod === 'text' && !document.getElementById('text').value.trim()) { alert('请输入要转换的文本内容'); return; } if (currentInputMethod === 'file' && !selectedFile) { alert('请选择要上传的txt文件'); return; } resultContainer.style.display = 'block'; loading.style.display = 'block'; success.style.display = 'none'; error.style.display = 'none'; generateBtn.disabled = true; generateBtn.textContent = t('status.generating'); try { let response; const loadingText = document.getElementById('loadingText'); const progressInfo = document.getElementById('progressInfo'); if (currentInputMethod === 'text') { const text = document.getElementById('text').value; loadingText.textContent = text.length > 3000 ? t('status.longText') : t('status.generating'); progressInfo.textContent = 'Text length: ' + text.length + ' characters'; response = await fetch('/v1/audio/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: text, voice: voice, speed: parseFloat(speed), pitch: pitch, style: style }) }); } else { loadingText.textContent = t('status.file'); progressInfo.textContent = 'File: ' + selectedFile.name + ' (' + formatFileSize(selectedFile.size) + ')'; const formData = new FormData(); formData.append('file', selectedFile); formData.append('voice', voice); formData.append('speed', speed); formData.append('pitch', pitch); formData.append('style', style); response = await fetch('/v1/audio/speech', { method: 'POST', body: formData }); } if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error && errorData.error.message ? errorData.error.message : '生成失败'); } const audioBlob = await response.blob(); const audioUrl = URL.createObjectURL(audioBlob); document.getElementById('audioPlayer').src = audioUrl; document.getElementById('downloadBtn').href = audioUrl; loading.style.display = 'none'; success.style.display = 'block'; } catch (err) { loading.style.display = 'none'; error.style.display = 'block'; error.textContent = '错误: ' + err.message; } finally { generateBtn.disabled = false; generateBtn.textContent = t('action.generate'); } });
    function initializeModeSwitcher() { document.getElementById('ttsMode').addEventListener('click', function() { switchMode('tts'); }); document.getElementById('transcriptionMode').addEventListener('click', function() { switchMode('transcription'); }); }
    function switchMode(mode) { const ttsMode = document.getElementById('ttsMode'); const transcriptionMode = document.getElementById('transcriptionMode'); const ttsWorkspace = document.getElementById('ttsWorkspace'); const transcriptionContainer = document.getElementById('transcriptionContainer'); currentMode = mode; if (mode === 'tts') { ttsMode.classList.add('active'); transcriptionMode.classList.remove('active'); ttsMode.setAttribute('aria-selected', 'true'); transcriptionMode.setAttribute('aria-selected', 'false'); ttsWorkspace.style.display = 'grid'; transcriptionContainer.style.display = 'none'; } else { transcriptionMode.classList.add('active'); ttsMode.classList.remove('active'); transcriptionMode.setAttribute('aria-selected', 'true'); ttsMode.setAttribute('aria-selected', 'false'); ttsWorkspace.style.display = 'none'; transcriptionContainer.style.display = 'block'; } }
    function initializeAudioUpload() { const audioDropZone = document.getElementById('audioDropZone'); const audioFileInput = document.getElementById('audioFileInput'); const audioFileRemoveBtn = document.getElementById('audioFileRemoveBtn'); audioDropZone.addEventListener('click', function() { audioFileInput.click(); }); audioDropZone.addEventListener('keydown', function(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); audioFileInput.click(); } }); audioFileInput.addEventListener('change', function(event) { if (event.target.files[0]) handleAudioFileSelect(event.target.files[0]); }); audioDropZone.addEventListener('dragover', function(event) { event.preventDefault(); audioDropZone.classList.add('dragover'); }); audioDropZone.addEventListener('dragleave', function(event) { event.preventDefault(); audioDropZone.classList.remove('dragover'); }); audioDropZone.addEventListener('drop', function(event) { event.preventDefault(); audioDropZone.classList.remove('dragover'); if (event.dataTransfer.files[0]) handleAudioFileSelect(event.dataTransfer.files[0]); }); audioFileRemoveBtn.addEventListener('click', function() { selectedAudioFile = null; audioFileInput.value = ''; document.getElementById('audioFileInfo').style.display = 'none'; audioDropZone.style.display = 'block'; }); }
    function handleAudioFileSelect(file) { const isValidType = file.name.toLowerCase().match(/\.(mp3|wav|m4a|flac|aac|ogg|webm|amr|3gp)$/i) || file.type.includes('audio/'); if (!isValidType) { alert('请选择音频格式的文件（mp3、wav、m4a、flac、aac、ogg、webm、amr、3gp）'); return; } if (file.size > 10 * 1024 * 1024) { alert('音频文件大小不能超过10MB'); return; } selectedAudioFile = file; document.getElementById('audioFileName').textContent = file.name; document.getElementById('audioFileSize').textContent = formatFileSize(file.size); document.getElementById('audioFileInfo').style.display = 'flex'; document.getElementById('audioDropZone').style.display = 'none'; }
    function initializeTokenConfig() { const tokenRadios = document.querySelectorAll('input[name="tokenOption"]'); const tokenInput = document.getElementById('tokenInput'); tokenRadios.forEach(function(radio) { radio.addEventListener('change', function() { tokenInput.style.display = this.value === 'custom' ? 'block' : 'none'; tokenInput.required = this.value === 'custom'; if (this.value !== 'custom') tokenInput.value = ''; }); }); }
    document.getElementById('transcriptionForm').addEventListener('submit', async function(event) { event.preventDefault(); const transcribeBtn = document.getElementById('transcribeBtn'); const transcriptionResult = document.getElementById('transcriptionResult'); const transcriptionLoading = document.getElementById('transcriptionLoading'); const transcriptionSuccess = document.getElementById('transcriptionSuccess'); const transcriptionError = document.getElementById('transcriptionError'); if (!selectedAudioFile) { alert('请选择要转录的音频文件'); return; } const tokenOption = document.querySelector('input[name="tokenOption"]:checked').value; const customToken = document.getElementById('tokenInput').value; if (tokenOption === 'custom' && !customToken.trim()) { alert('请输入自定义Token'); return; } transcriptionResult.style.display = 'block'; transcriptionLoading.style.display = 'block'; transcriptionSuccess.style.display = 'none'; transcriptionError.style.display = 'none'; transcribeBtn.disabled = true; transcribeBtn.textContent = t('status.transcribing'); document.getElementById('transcriptionProgressInfo').textContent = t('status.fileLabel') + ': ' + selectedAudioFile.name + ' (' + formatFileSize(selectedAudioFile.size) + ')'; try { const formData = new FormData(); formData.append('file', selectedAudioFile); if (tokenOption === 'custom') formData.append('token', customToken); const response = await fetch('/v1/audio/transcriptions', { method: 'POST', body: formData }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error && errorData.error.message ? errorData.error.message : '转录失败'); } const result = await response.json(); document.getElementById('transcriptionText').value = result.text || ''; transcriptionLoading.style.display = 'none'; transcriptionSuccess.style.display = 'block'; } catch (err) { transcriptionLoading.style.display = 'none'; transcriptionError.style.display = 'block'; transcriptionError.textContent = '错误: ' + err.message; } finally { transcribeBtn.disabled = false; transcribeBtn.textContent = t('action.transcribe'); } });
    document.getElementById('copyTranscriptionBtn').addEventListener('click', function() { const transcriptionText = document.getElementById('transcriptionText'); const button = this; const showCopied = function() { const originalText = button.textContent; button.textContent = t('action.copied'); setTimeout(function() { button.textContent = originalText; }, CONFIG.COPY_FEEDBACK); }; const fallbackCopy = function() { try { transcriptionText.select(); document.execCommand('copy'); showCopied(); } catch (err) { showToast(t('error.copyFailed')); } }; if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(transcriptionText.value).then(showCopied).catch(fallbackCopy); } else { fallbackCopy(); } });
    document.getElementById('editTranscriptionBtn').addEventListener('click', function() { const transcriptionText = document.getElementById('transcriptionText'); transcriptionText.readOnly = !transcriptionText.readOnly; this.textContent = transcriptionText.readOnly ? t('action.edit') : t('action.save'); if (!transcriptionText.readOnly) transcriptionText.focus(); });
    document.getElementById('useForTtsBtn').addEventListener('click', function() { const transcriptionText = document.getElementById('transcriptionText').value; if (!transcriptionText.trim()) { alert('转录结果为空，无法转换为语音'); return; } switchMode('tts'); currentInputMethod = 'text'; document.getElementById('textInputTab').click(); document.getElementById('text').value = transcriptionText; document.getElementById('ttsWorkspace').scrollIntoView({ behavior: 'smooth' }); });
  </script>
</body>
</html>`;
async function handleRequest(request) {
    if (request.method === "OPTIONS") {
        return handleOptions(request);
    }




    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname;

    // 返回前端页面
    if (path === "/" || path === "/index.html") {
        return new Response(HTML_PAGE, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                ...makeCORSHeaders()
            }
        });
    }

    if (path === "/v1/audio/transcriptions") {
        try {
            return await handleAudioTranscription(request);
        } catch (error) {
            console.error("Audio transcription error:", error);
            return new Response(JSON.stringify({
                error: {
                    message: error.message,
                    type: "api_error",
                    param: null,
                    code: "transcription_error"
                }
            }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }
    }

    if (path === "/v1/audio/speech") {
        try {
            const contentType = request.headers.get("content-type") || "";
            
            // 处理文件上传
            if (contentType.includes("multipart/form-data")) {
                return await handleFileUpload(request);
            }
            
            // 处理JSON请求（原有功能）
            const requestBody = await request.json();
            const {
                input,
                voice = "zh-CN-XiaoxiaoNeural",
                speed = '1.0',
                volume = '0',
                pitch = '0',
                style = "general"
            } = requestBody;

            let rate = parseInt(String((parseFloat(speed) - 1.0) * 100));
            let numVolume = parseInt(String(parseFloat(volume) * 100));
            let numPitch = parseInt(pitch);
            const response = await getVoice(
                input,
                voice,
                rate >= 0 ? `+${rate}%` : `${rate}%`,
                numPitch >= 0 ? `+${numPitch}Hz` : `${numPitch}Hz`,
                numVolume >= 0 ? `+${numVolume}%` : `${numVolume}%`,
                style,
                "audio-24khz-48kbitrate-mono-mp3"
            );

            return response;

        } catch (error) {
            console.error("Error:", error);
            return new Response(JSON.stringify({
                error: {
                    message: error.message,
                    type: "api_error",
                    param: null,
                    code: "edge_tts_error"
                }
            }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }
    }

    // 默认返回 404
    return new Response("Not Found", { status: 404 });
}

export default {
    async fetch(request) {
        return handleRequest(request);
    }
};

async function handleOptions(request) {
    return new Response(null, {
        status: 204,
        headers: {
            ...makeCORSHeaders(),
            "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "Authorization"
        }
    });
}

// 添加延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 优化文本分块函数
function optimizedTextSplit(text, maxChunkSize = 1500) {
    const chunks = [];
    const sentences = text.split(/[。！？\n]/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) continue;
        
        // 如果单个句子就超过最大长度，按字符分割
        if (trimmedSentence.length > maxChunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            
            // 按字符分割长句子
            for (let i = 0; i < trimmedSentence.length; i += maxChunkSize) {
                chunks.push(trimmedSentence.slice(i, i + maxChunkSize));
            }
        } else if ((currentChunk + trimmedSentence).length > maxChunkSize) {
            // 当前块加上新句子会超过限制，先保存当前块
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = trimmedSentence;
        } else {
            // 添加到当前块
            currentChunk += (currentChunk ? '。' : '') + trimmedSentence;
        }
    }
    
    // 添加最后一个块
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 0);
}

// 批量处理音频块
async function processBatchedAudioChunks(chunks, voiceName, rate, pitch, volume, style, outputFormat, batchSize = 3, delayMs = 1000) {
    const audioChunks = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchPromises = batch.map(async (chunk, index) => {
            try {
                // 为每个请求添加小延迟，避免同时发送
                if (index > 0) {
                    await delay(index * 200);
                }
                return await getAudioChunk(chunk, voiceName, rate, pitch, volume, style, outputFormat);
            } catch (error) {
                console.error(`处理音频块失败 (批次 ${Math.floor(i/batchSize) + 1}, 块 ${index + 1}):`, error);
                throw error;
            }
        });
        
        try {
            const batchResults = await Promise.all(batchPromises);
            audioChunks.push(...batchResults);
            
            // 批次间延迟
            if (i + batchSize < chunks.length) {
                await delay(delayMs);
            }
        } catch (error) {
            console.error(`批次处理失败:`, error);
            throw error;
        }
    }
    
    return audioChunks;
}

async function getVoice(text, voiceName = "zh-CN-XiaoxiaoNeural", rate = '+0%', pitch = '+0Hz', volume = '+0%', style = "general", outputFormat = "audio-24khz-48kbitrate-mono-mp3") {
    try {
        // 文本预处理
        const cleanText = text.trim();
        if (!cleanText) {
            throw new Error("文本内容为空");
        }
        
        // 如果文本很短，直接处理
        if (cleanText.length <= 1500) {
            const audioBlob = await getAudioChunk(cleanText, voiceName, rate, pitch, volume, style, outputFormat);
            return new Response(audioBlob, {
                headers: {
                    "Content-Type": "audio/mpeg",
                    ...makeCORSHeaders()
                }
            });
        }

        // 优化的文本分块
        const chunks = optimizedTextSplit(cleanText, 1500);
        
        // 检查分块数量，防止超过CloudFlare限制
        if (chunks.length > 40) {
            throw new Error(`文本过长，分块数量(${chunks.length})超过限制。请缩短文本或分批处理。`);
        }
        
        console.log(`文本已分为 ${chunks.length} 个块进行处理`);

        // 批量处理音频块，控制并发数量和频率
        const audioChunks = await processBatchedAudioChunks(
            chunks, 
            voiceName, 
            rate, 
            pitch, 
            volume, 
            style, 
            outputFormat,
            3,  // 每批处理3个
            800 // 批次间延迟800ms
        );

        // 将音频片段拼接起来
        const concatenatedAudio = new Blob(audioChunks, { type: 'audio/mpeg' });
        return new Response(concatenatedAudio, {
            headers: {
                "Content-Type": "audio/mpeg",
                ...makeCORSHeaders()
            }
        });

    } catch (error) {
        console.error("语音合成失败:", error);
        return new Response(JSON.stringify({
            error: {
                message: error.message || String(error),
                type: "api_error",
                param: `${voiceName}, ${rate}, ${pitch}, ${volume}, ${style}, ${outputFormat}`,
                code: "edge_tts_error"
            }
        }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                ...makeCORSHeaders()
            }
        });
    }
}



//获取单个音频数据（增强错误处理和重试机制）
async function getAudioChunk(text, voiceName, rate, pitch, volume, style, outputFormat = 'audio-24khz-48kbitrate-mono-mp3', maxRetries = 3) {
    const retryDelay = 500; // 重试延迟500ms
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const endpoint = await getEndpoint();
            const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
            
            // 处理文本中的延迟标记
            let m = text.match(/\[(\d+)\]\s*?$/);
            let slien = 0;
            if (m && m.length == 2) {
                slien = parseInt(m[1]);
                text = text.replace(m[0], '');
            }
            
            // 验证文本长度
            if (!text.trim()) {
                throw new Error("文本块为空");
            }
            
            if (text.length > 2000) {
                throw new Error(`文本块过长: ${text.length} 字符，最大支持2000字符`);
            }
            
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": endpoint.t,
                    "Content-Type": "application/ssml+xml",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
                    "X-Microsoft-OutputFormat": outputFormat
                },
                body: getSsml(text, voiceName, rate, pitch, volume, style, slien)
            });

            if (!response.ok) {
                const errorText = await response.text();
                
                // 根据错误类型决定是否重试
                if (response.status === 429) {
                    // 频率限制，需要重试
                    if (attempt < maxRetries) {
                        console.log(`频率限制，第${attempt + 1}次重试，等待${retryDelay * (attempt + 1)}ms`);
                        await delay(retryDelay * (attempt + 1));
                        continue;
                    }
                    throw new Error(`请求频率过高，已重试${maxRetries}次仍失败`);
                } else if (response.status >= 500) {
                    // 服务器错误，可以重试
                    if (attempt < maxRetries) {
                        console.log(`服务器错误，第${attempt + 1}次重试，等待${retryDelay * (attempt + 1)}ms`);
                        await delay(retryDelay * (attempt + 1));
                        continue;
                    }
                    throw new Error(`Edge TTS服务器错误: ${response.status} ${errorText}`);
                } else {
                    // 客户端错误，不重试
                    throw new Error(`Edge TTS API错误: ${response.status} ${errorText}`);
                }
            }

            return await response.blob();
            
        } catch (error) {
            if (attempt === maxRetries) {
                // 最后一次重试失败
                throw new Error(`音频生成失败（已重试${maxRetries}次）: ${error.message}`);
            }
            
            // 如果是网络错误或其他可重试错误
            if (error.message.includes('fetch') || error.message.includes('network')) {
                console.log(`网络错误，第${attempt + 1}次重试，等待${retryDelay * (attempt + 1)}ms`);
                await delay(retryDelay * (attempt + 1));
                continue;
            }
            
            // 其他错误直接抛出
            throw error;
        }
    }
}

// XML文本转义函数
function escapeXmlText(text) {
    return text
        .replace(/&/g, '&amp;')   // 必须首先处理 &
        .replace(/</g, '&lt;')    // 处理 <
        .replace(/>/g, '&gt;')    // 处理 >
        .replace(/"/g, '&quot;')  // 处理 "
        .replace(/'/g, '&apos;'); // 处理 '
}

function getSsml(text, voiceName, rate, pitch, volume, style, slien = 0) {
    // 对文本进行XML转义
    const escapedText = escapeXmlText(text);
    
    let slien_str = '';
    if (slien > 0) {
        slien_str = `<break time="${slien}ms" />`
    }
    return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN"> 
                <voice name="${voiceName}"> 
                    <mstts:express-as style="${style}"  styledegree="2.0" role="default" > 
                        <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">${escapedText}</prosody> 
                    </mstts:express-as> 
                    ${slien_str}
                </voice> 
            </speak>`;

}

async function getEndpoint() {
    const now = Date.now() / 1000;

    if (tokenInfo.token && tokenInfo.expiredAt && now < tokenInfo.expiredAt - TOKEN_REFRESH_BEFORE_EXPIRY) {
        return tokenInfo.endpoint;
    }

    // 获取新token
    const endpointUrl = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
    const clientId = crypto.randomUUID().replace(/-/g, "");

    try {
        const response = await fetch(endpointUrl, {
            method: "POST",
            headers: {
                "Accept-Language": "zh-Hans",
                "X-ClientVersion": "4.0.530a 5fe1dc6c",
                "X-UserId": "0f04d16a175c411e",
                "X-HomeGeographicRegion": "zh-Hans-CN",
                "X-ClientTraceId": clientId,
                "X-MT-Signature": await sign(endpointUrl),
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
                "Content-Type": "application/json; charset=utf-8",
                "Content-Length": "0",
                "Accept-Encoding": "gzip"
            }
        });

        if (!response.ok) {
            throw new Error(`获取endpoint失败: ${response.status}`);
        }

        const data = await response.json();
        const jwt = data.t.split(".")[1];
        const decodedJwt = JSON.parse(atob(jwt));

        tokenInfo = {
            endpoint: data,
            token: data.t,
            expiredAt: decodedJwt.exp
        };

        return data;

    } catch (error) {
        console.error("获取endpoint失败:", error);
        // 如果有缓存的token，即使过期也尝试使用
        if (tokenInfo.token) {
            console.log("使用过期的缓存token");
            return tokenInfo.endpoint;
        }
        throw error;
    }
}



function makeCORSHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        "Access-Control-Max-Age": "86400"
    };
}

async function hmacSha256(key, data) {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
    return new Uint8Array(signature);
}

async function base64ToBytes(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function bytesToBase64(bytes) {
    return btoa(String.fromCharCode.apply(null, bytes));
}

function uuid() {
    return crypto.randomUUID().replace(/-/g, "");
}

async function sign(urlStr) {
    const url = urlStr.split("://")[1];
    const encodedUrl = encodeURIComponent(url);
    const uuidStr = uuid();
    const formattedDate = dateFormat();
    const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();
    const decode = await base64ToBytes("oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==");
    const signData = await hmacSha256(decode, bytesToSign);
    const signBase64 = await bytesToBase64(signData);
    return `MSTranslatorAndroidApp::${signBase64}::${formattedDate}::${uuidStr}`;
}

function dateFormat() {
    const formattedDate = (new Date()).toUTCString().replace(/GMT/, "").trim() + " GMT";
    return formattedDate.toLowerCase();
}

// 处理文件上传的函数
async function handleFileUpload(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const voice = formData.get('voice') || 'zh-CN-XiaoxiaoNeural';
        const speed = formData.get('speed') || '1.0';
        const volume = formData.get('volume') || '0';
        const pitch = formData.get('pitch') || '0';
        const style = formData.get('style') || 'general';

        // 验证文件
        if (!file) {
            return new Response(JSON.stringify({
                error: {
                    message: "未找到上传的文件",
                    type: "invalid_request_error",
                    param: "file",
                    code: "missing_file"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 验证文件类型
        if (!file.type.includes('text/') && !file.name.toLowerCase().endsWith('.txt')) {
            return new Response(JSON.stringify({
                error: {
                    message: "不支持的文件类型，请上传txt文件",
                    type: "invalid_request_error",
                    param: "file",
                    code: "invalid_file_type"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 验证文件大小（限制为500KB）
        if (file.size > 500 * 1024) {
            return new Response(JSON.stringify({
                error: {
                    message: "文件大小超过限制（最大500KB）",
                    type: "invalid_request_error",
                    param: "file",
                    code: "file_too_large"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 读取文件内容
        const text = await file.text();
        
        // 验证文本内容
        if (!text.trim()) {
            return new Response(JSON.stringify({
                error: {
                    message: "文件内容为空",
                    type: "invalid_request_error",
                    param: "file",
                    code: "empty_file"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 文本长度限制（10000字符）
        if (text.length > 10000) {
            return new Response(JSON.stringify({
                error: {
                    message: "文本内容过长（最大10000字符）",
                    type: "invalid_request_error",
                    param: "file",
                    code: "text_too_long"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 处理参数格式，与原有逻辑保持一致
        let rate = parseInt(String((parseFloat(speed) - 1.0) * 100));
        let numVolume = parseInt(String(parseFloat(volume) * 100));
        let numPitch = parseInt(pitch);

        // 调用TTS服务
        return await getVoice(
            text,
            voice,
            rate >= 0 ? `+${rate}%` : `${rate}%`,
            numPitch >= 0 ? `+${numPitch}Hz` : `${numPitch}Hz`,
            numVolume >= 0 ? `+${numVolume}%` : `${numVolume}%`,
            style,
            "audio-24khz-48kbitrate-mono-mp3"
        );

    } catch (error) {
        console.error("文件上传处理失败:", error);
        return new Response(JSON.stringify({
            error: {
                message: "文件处理失败",
                type: "api_error",
                param: null,
                code: "file_processing_error"
            }
        }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                ...makeCORSHeaders()
            }
        });
    }
}

// 处理语音转录的函数
async function handleAudioTranscription(request) {
    try {
        // 验证请求方法
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({
                error: {
                    message: "只支持POST方法",
                    type: "invalid_request_error",
                    param: "method",
                    code: "method_not_allowed"
                }
            }), {
                status: 405,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        const contentType = request.headers.get("content-type") || "";
        
        // 验证Content-Type
        if (!contentType.includes("multipart/form-data")) {
            return new Response(JSON.stringify({
                error: {
                    message: "请求必须使用multipart/form-data格式",
                    type: "invalid_request_error",
                    param: "content-type",
                    code: "invalid_content_type"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 解析FormData
        const formData = await request.formData();
        const audioFile = formData.get('file');
        const customToken = formData.get('token');

        // 验证音频文件
        if (!audioFile) {
            return new Response(JSON.stringify({
                error: {
                    message: "未找到音频文件",
                    type: "invalid_request_error",
                    param: "file",
                    code: "missing_file"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 验证文件大小（限制为10MB）
        if (audioFile.size > 10 * 1024 * 1024) {
            return new Response(JSON.stringify({
                error: {
                    message: "音频文件大小不能超过10MB",
                    type: "invalid_request_error",
                    param: "file",
                    code: "file_too_large"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 验证音频文件格式
        const allowedTypes = [
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/aac',
            'audio/ogg', 'audio/webm', 'audio/amr', 'audio/3gpp'
        ];
        
        const isValidType = allowedTypes.some(type => 
            audioFile.type.includes(type) || 
            audioFile.name.toLowerCase().match(/\.(mp3|wav|m4a|flac|aac|ogg|webm|amr|3gp)$/i)
        );

        if (!isValidType) {
            return new Response(JSON.stringify({
                error: {
                    message: "不支持的音频文件格式，请上传mp3、wav、m4a、flac、aac、ogg、webm、amr或3gp格式的文件",
                    type: "invalid_request_error",
                    param: "file",
                    code: "invalid_file_type"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 使用默认token或用户提供的token
        const token = customToken || 'sk-wtldsvuprmwltxpbspbmawtolbacghzawnjhtlzlnujjkfhh';

        // 构建发送到硅基流动API的FormData
        const apiFormData = new FormData();
        apiFormData.append('file', audioFile);
        apiFormData.append('model', 'FunAudioLLM/SenseVoiceSmall');

        // 发送请求到硅基流动API
        const apiResponse = await fetch('https://api.siliconflow.cn/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: apiFormData
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('硅基流动API错误:', apiResponse.status, errorText);
            
            let errorMessage = '语音转录服务暂时不可用';
            
            if (apiResponse.status === 401) {
                errorMessage = 'API Token无效，请检查您的配置';
            } else if (apiResponse.status === 429) {
                errorMessage = '请求过于频繁，请稍后再试';
            } else if (apiResponse.status === 413) {
                errorMessage = '音频文件太大，请选择较小的文件';
            }

            return new Response(JSON.stringify({
                error: {
                    message: errorMessage,
                    type: "api_error",
                    param: null,
                    code: "transcription_api_error"
                }
            }), {
                status: apiResponse.status,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 获取转录结果
        const transcriptionResult = await apiResponse.json();

        // 返回转录结果
        return new Response(JSON.stringify(transcriptionResult), {
            headers: {
                "Content-Type": "application/json",
                ...makeCORSHeaders()
            }
        });

    } catch (error) {
        console.error("语音转录处理失败:", error);
        return new Response(JSON.stringify({
            error: {
                message: "语音转录处理失败",
                type: "api_error",
                param: null,
                code: "transcription_processing_error"
            }
        }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                ...makeCORSHeaders()
            }
        });
    }
}

