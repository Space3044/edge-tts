export const PAGE_STYLES = `
    :root {
      --font-display:"Space Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      --font-body:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
      --font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
      --radius-sm:0; --radius-md:0; --radius-lg:0; --radius-pill:0;
    }
    :root, [data-theme="light"] {
      --bg:#f6f8fb; --bg-tint:rgba(37,99,235,.04);
      --surface:#ffffff; --surface-2:#f8fafc; --surface-3:#f1f5f9;
      --border:#e2e8f0; --border-strong:#cbd5e1; --border-subtle:#edf2f7;
      --text:#0f172a; --text-2:#475569; --text-3:#94a3b8;
      --accent:#2563eb; --accent-hover:#1d4ed8; --accent-soft:rgba(37,99,235,.08); --accent-ring:rgba(37,99,235,.22);
      --on-accent:#ffffff; --signal:#d97706;
      --error:#e11d48; --error-bg:rgba(225,29,72,.06); --error-border:rgba(225,29,72,.25); --warning:#d97706;
      --shadow-sm:none;
      --shadow-md:0 16px 32px -8px rgba(15,23,42,.12),0 4px 8px -2px rgba(15,23,42,.04);
      --shadow-accent:none;
      color-scheme:light;
    }
    [data-theme="dark"] {
      --bg:#090b10; --bg-tint:rgba(59,130,246,.05);
      --surface:#11141c; --surface-2:#161a25; --surface-3:#1e2434;
      --border:#1f2637; --border-strong:#2c364d; --border-subtle:#171d2a;
      --text:#f8fafc; --text-2:#94a3b8; --text-3:#64748b;
      --accent:#3b82f6; --accent-hover:#60a5fa; --accent-soft:rgba(59,130,246,.14); --accent-ring:rgba(59,130,246,.32);
      --on-accent:#ffffff; --signal:#f59e0b;
      --error:#fb7185; --error-bg:rgba(251,113,133,.12); --error-border:rgba(251,113,133,.30); --warning:#f59e0b;
      --shadow-sm:none;
      --shadow-md:0 20px 40px -12px rgba(0,0,0,.7);
      --shadow-accent:none;
      color-scheme:dark;
    }
    * { box-sizing:border-box; }
    body {
      margin:0; min-height:100vh; color:var(--text); font-family:var(--font-body); line-height:1.5;
      background-color:var(--bg);
      background-image:linear-gradient(to right,var(--border-subtle) 1px,transparent 1px),linear-gradient(to bottom,var(--border-subtle) 1px,transparent 1px);
      background-size:32px 32px;
      -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; text-rendering:optimizeLegibility;
      transition:background-color .25s ease,color .25s ease;
    }
    button,input,select,textarea { font:inherit; color:inherit; }
    :focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
    .form-input:focus-visible,.form-select:focus-visible,.form-textarea:focus-visible { outline:none; }
    .app-shell { width:min(1440px,calc(100% - 40px)); margin:0 auto; padding:28px 0 44px; }
    .topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--border); }
    .brand { display:flex; align-items:center; gap:12px; }
    .brand-mark { width:40px; height:40px; display:grid; place-items:center; background:var(--surface); border:1px solid var(--border-strong); border-left:3px solid var(--accent); box-shadow:none; }
    .wave { display:flex; align-items:center; gap:3px; height:18px; }
    .wave i { display:block; width:2.5px; height:35%; background:var(--accent); animation:eq 1.2s ease-in-out infinite; }
    .wave i:nth-child(1){ animation-delay:-.9s } .wave i:nth-child(2){ animation-delay:-.4s } .wave i:nth-child(3){ animation-delay:-.7s } .wave i:nth-child(4){ animation-delay:-.2s } .wave i:nth-child(5){ animation-delay:-.55s }
    @keyframes eq { 0%,100%{ height:20%; opacity:.45; } 50%{ height:95%; opacity:1; } }
    .brand h1 { margin:0; font-family:var(--font-display); font-size:1.32rem; font-weight:700; letter-spacing:-.025em; color:var(--text); }
    .brand p { margin:1px 0 0; color:var(--text-2); font-size:.75rem; font-family:var(--font-mono); letter-spacing:.02em; text-transform:uppercase; }
    .topbar-actions { display:flex; align-items:center; gap:8px; }
    .mode-switcher { display:flex; align-items:stretch; gap:2px; padding:3px; height:38px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-md); }
    .mode-btn { display:inline-flex; align-items:center; border:1px solid transparent; background:transparent; color:var(--text-2); padding:0 14px; font-family:var(--font-display); font-weight:600; font-size:.84rem; border-radius:var(--radius-sm); cursor:pointer; transition:color .18s ease,background-color .18s ease,border-color .18s ease; }
    .mode-btn:hover { color:var(--text); }
    .mode-btn.active { background:var(--surface); color:var(--accent); border-color:var(--border); }
    .repo-link { width:42px; height:42px; padding:0; display:inline-flex; align-items:center; justify-content:center; border:0; background:transparent; color:var(--text-2); border-radius:var(--radius-sm); text-decoration:none; cursor:pointer; transition:color .15s ease,background-color .15s ease; }
    .repo-link:hover { background:var(--surface-2); color:var(--text); }
    .repo-link svg { width:18px; height:18px; flex:0 0 18px; }
    .theme-btn { width:42px; height:42px; display:inline-flex; align-items:center; justify-content:center; border:0; background:transparent; color:var(--text-2); border-radius:var(--radius-sm); cursor:pointer; transition:color .15s ease,background-color .15s ease,transform .12s ease; }
    .theme-btn:hover { color:var(--text); background:var(--surface-2); }
    .theme-btn:active { transform:scale(.94); }
    .theme-btn svg { width:18px; height:18px; }
    .icon-sun { display:none; } .icon-moon { display:block; }
    [data-theme="dark"] .icon-moon { display:none; } [data-theme="dark"] .icon-sun { display:block; }
    .language-switcher { position:relative; }
    .language-btn { display:inline-flex; align-items:center; gap:6px; height:42px; padding:0 11px; border:0; background:transparent; color:var(--text-2); border-radius:var(--radius-sm); font-weight:500; font-size:.84rem; cursor:pointer; transition:color .15s ease,background-color .15s ease; }
    .language-btn:hover { color:var(--text); background:var(--surface-2); }
    .language-dropdown { position:absolute; right:0; top:calc(100% + 6px); z-index:20; min-width:150px; display:none; padding:4px; background:var(--surface); border:1px solid var(--border-strong); border-radius:var(--radius-md); box-shadow:var(--shadow-md); }
    .language-dropdown.show { display:grid; gap:2px; }
    .language-option { border-radius:var(--radius-sm); padding:8px 10px; cursor:pointer; color:var(--text-2); font-size:.84rem; transition:background-color .12s ease,color .12s ease; }
    .language-option:hover,.language-option.active { background:var(--accent-soft); color:var(--accent); font-weight:600; }
    .workspace-grid { display:grid; grid-template-columns:320px minmax(0,1fr) 260px; gap:14px; align-items:stretch; height:clamp(640px,calc(100dvh - 112px),760px); }
    .input-panel,.voice-panel,.settings-panel,.result-panel,.transcription-panel { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:20px; transition:border-color .2s ease; }
    .panel-header { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; min-height:54px; margin-bottom:18px; }
    .panel-header h2 { margin:0; font-family:var(--font-display); font-size:1.05rem; font-weight:600; letter-spacing:-.01em; color:var(--text); }
    .panel-header p { margin:4px 0 0; color:var(--text-2); font-size:.82rem; line-height:1.45; }
    .panel-header-actions { display:flex; align-items:flex-end; justify-content:flex-end; gap:10px; flex-shrink:0; }
    .input-method-control { display:flex; align-items:center; justify-content:flex-end; gap:10px; min-height:38px; }
    .input-method-control .form-label { min-height:38px; display:flex; align-items:center; margin:0; color:var(--text-2); font-size:.76rem; white-space:nowrap; text-transform:uppercase; letter-spacing:.04em; }
    .input-method-control .input-method-tabs { align-items:center; justify-content:flex-end; }
    .voice-count { flex-shrink:0; font-family:var(--font-mono); font-size:.7rem; color:var(--text-2); background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-pill); padding:3px 9px; white-space:nowrap; letter-spacing:.02em; }
    .form-group { margin-bottom:12px; }
    .form-label { display:block; margin-bottom:8px; font-weight:600; font-size:.8rem; letter-spacing:.01em; color:var(--text); }
    .field-label-row { position:relative; display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:38px; margin-bottom:8px; }
    .field-label-row .form-label { min-height:38px; display:flex; align-items:center; margin-bottom:0; }
    .field-label-main { display:flex; align-items:center; gap:10px; min-width:0; }
    .field-label-main .form-label { font-size:1rem; font-family:var(--font-display); font-weight:600; letter-spacing:-.01em; }
    .inline-action { height:38px; min-height:38px; border-radius:var(--radius-sm); font-size:.78rem; }
    .inline-action-group { position:relative; display:flex; align-items:center; justify-content:flex-end; gap:6px; flex-shrink:0; }
    .char-counter { color:var(--text-3); font-family:var(--font-mono); font-size:.76rem; white-space:nowrap; }
    .char-counter.warning { color:var(--warning); font-weight:600; }
    .transcription-header-actions { align-items:center; }
    .provider-config { position:relative; }
    .provider-config summary { list-style:none; cursor:pointer; display:inline-flex; }
    .provider-config summary::-webkit-details-marker { display:none; }
    .provider-config[open] > summary { color:var(--accent); border-color:var(--accent); background:var(--accent-soft); }
    .provider-grid { position:absolute; right:0; top:calc(100% + 6px); z-index:30; width:min(840px,calc(100vw - 48px)); margin:0; padding:16px; border:1px solid var(--border-strong); background:var(--surface); box-shadow:var(--shadow-md); display:grid; gap:12px; }
    .provider-hint { margin:0; color:var(--text-2); font-size:.78rem; line-height:1.5; font-family:var(--font-mono); }
    .provider-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; }
    .provider-card { display:grid; gap:9px; align-content:start; padding:12px; background:var(--surface-2); border:1px solid var(--border); }
    .provider-card h3 { margin:0; font-family:var(--font-display); font-size:.86rem; font-weight:600; color:var(--text); }
    .provider-card label { display:grid; gap:4px; min-width:0; color:var(--text-2); font-size:.74rem; font-weight:600; }
    .provider-card .form-input { padding:7px 9px; font-size:.82rem; background:var(--surface); }
    .provider-card-footer { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:32px; margin-top:4px; }
    .provider-status { min-width:0; color:var(--text-2); font-size:.72rem; font-family:var(--font-mono); overflow-wrap:anywhere; }
    .provider-save { padding:6px 12px; font-size:.78rem; }
    .polish-config { margin-left:auto; }
    .polish-config summary { list-style:none; }
    .polish-config summary::-webkit-details-marker { display:none; }
    .polish-config[open] summary { color:var(--accent); border-color:var(--accent); background:var(--accent-soft); }
    .polish-grid { position:absolute; right:0; top:calc(100% + 6px); z-index:30; width:min(620px,calc(100vw - 48px)); display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; padding:14px; border:1px solid var(--border-strong); background:var(--surface); box-shadow:var(--shadow-md); }
    .polish-grid label { display:grid; gap:5px; min-width:0; color:var(--text-2); font-size:.76rem; font-weight:600; }
    .polish-grid .polish-instruction { grid-column:1 / -1; }
    .compact-textarea { height:80px; min-height:80px; resize:none; font-size:.84rem; }
    .form-input,.form-select { width:100%; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface); color:var(--text); padding:10px 12px; outline:none; transition:border-color .15s ease,box-shadow .15s ease; }
    .form-input::placeholder { color:var(--text-3); }
    .form-input:focus,.form-select:focus { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
    .form-select { cursor:pointer; }
    .form-textarea { height:236px; min-height:236px; width:100%; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface); color:var(--text); padding:10px 12px; outline:none; resize:none; line-height:1.6; font-family:var(--font-body); font-size:.92rem; transition:border-color .15s ease,box-shadow .15s ease; }
    .form-textarea::placeholder { color:var(--text-3); }
    .form-textarea:focus { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent); }
    .transcription-panel .form-textarea { min-height:160px; height:180px; }
    .input-method-tabs { display:flex; gap:4px; padding:2px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-sm); }
    .tab-btn { border:1px solid transparent; background:transparent; color:var(--text-2); padding:6px 12px; font-family:var(--font-display); font-weight:600; font-size:.8rem; border-radius:var(--radius-sm); cursor:pointer; transition:color .15s ease,background-color .15s ease,border-color .15s ease; }
    .tab-btn:hover { color:var(--text); }
    .tab-btn.active { background:var(--surface); border-color:var(--border); color:var(--accent); box-shadow:none; }
    .file-drop-zone,.audio-upload-zone { min-height:236px; display:grid; align-content:center; justify-items:center; gap:6px; border:1.5px dashed var(--border-strong); border-radius:var(--radius-md); background:var(--surface-2); padding:24px; text-align:center; cursor:pointer; transition:border-color .2s ease,background-color .2s ease; }
    .file-drop-zone:hover,.audio-upload-zone:hover,.file-drop-zone.dragover,.audio-upload-zone.dragover { border-color:var(--accent); background:var(--accent-soft); }
    .file-drop-text { margin:0; font-family:var(--font-display); font-weight:600; font-size:.92rem; color:var(--text); }
    .file-drop-hint { margin:0; color:var(--text-2); font-size:.78rem; font-family:var(--font-mono); }
    .textarea-shell { position:relative; }
    .textarea-shell .form-textarea { display:block; padding-bottom:172px; }
    .ssml-ghost-example { position:absolute; left:12px; right:12px; bottom:24px; max-height:112px; margin:0; padding:10px 0 0; border-top:1px solid var(--border); color:var(--text-3); font-family:var(--font-mono); font-size:.75rem; line-height:1.45; white-space:pre-wrap; overflow:hidden; overflow-wrap:anywhere; pointer-events:none; opacity:.65; transition:opacity .15s ease; }
    .textarea-shell.has-value .ssml-ghost-example { opacity:0; }
    .file-info { display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px 12px; background:var(--surface-2); }
    .file-details { display:grid; gap:2px; min-width:0; }
    .file-name { font-weight:600; font-size:.88rem; overflow-wrap:anywhere; }
    .file-size { color:var(--text-2); font-size:.75rem; font-family:var(--font-mono); }
    .file-remove-btn { flex-shrink:0; border:1px solid var(--border); background:var(--surface); color:var(--text-2); width:28px; height:28px; border-radius:var(--radius-sm); cursor:pointer; font-size:1.1rem; line-height:1; display:grid; place-items:center; transition:color .15s ease,background-color .15s ease,border-color .15s ease; }
    .file-remove-btn:hover { color:var(--error); background:var(--error-bg); border-color:var(--error-border); }
    .controls-grid { display:grid; grid-template-columns:1fr; gap:8px; align-items:stretch; align-self:stretch; min-width:0; padding:12px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-md); }
    .controls-grid > .form-group { min-height:84px; margin-bottom:0; display:grid; gap:8px; align-content:space-between; padding:10px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); }
    .controls-grid .form-label { margin-bottom:0; color:var(--text-2); font-size:.76rem; text-transform:uppercase; letter-spacing:.04em; }
    .controls-grid .control-label-row, .controls-grid > .form-group > .form-label { min-height:24px; display:flex; align-items:center; }
    .range-control { display:grid; gap:8px; }
    .control-label-row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .range-value { flex-shrink:0; min-width:60px; text-align:right; font-family:var(--font-mono); font-size:.78rem; font-weight:600; color:var(--accent); background:var(--accent-soft); border:1px solid var(--border); padding:4px 8px; letter-spacing:.02em; }
    .form-range { width:100%; height:6px; accent-color:var(--accent); cursor:pointer; background:linear-gradient(90deg,var(--accent-soft),var(--surface-3)); border:0; outline:none; }
    .form-range::-webkit-slider-runnable-track { height:6px; border-radius:999px; background:linear-gradient(90deg,var(--accent-soft),var(--surface-3)); }
    .form-range::-webkit-slider-thumb { margin-top:-6px; width:14px; height:18px; border-radius:0; border:1px solid var(--border-strong); background:var(--accent); cursor:ew-resize; box-shadow:0 1px 3px rgba(0,0,0,.2); }
    .form-range::-moz-range-track { height:6px; border-radius:999px; background:linear-gradient(90deg,var(--accent-soft),var(--surface-3)); }
    .form-range::-moz-range-thumb { width:14px; height:18px; border-radius:0; border:1px solid var(--border-strong); background:var(--accent); cursor:ew-resize; }
    .range-scale { display:flex; justify-content:space-between; color:var(--text-3); font-size:.7rem; font-family:var(--font-mono); text-transform:uppercase; letter-spacing:.02em; }
    .style-control { align-content:start; }
    .style-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
    .style-option { min-height:30px; border:1px solid var(--border); background:var(--surface-2); color:var(--text-2); padding:0 8px; font-size:.72rem; font-weight:600; text-align:center; cursor:pointer; transition:color .15s ease,background-color .15s ease,border-color .15s ease; }
    .style-option:hover { color:var(--text); border-color:var(--border-strong); background:var(--surface-3); }
    .style-option.active { color:var(--on-accent); border-color:var(--accent); background:var(--accent); }
    .btn-primary,.btn-secondary { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:1px solid transparent; border-radius:var(--radius-md); font-family:var(--font-display); font-weight:600; text-decoration:none; cursor:pointer; transition:background-color .18s ease,border-color .18s ease,transform .12s ease; }
    .btn-primary { width:100%; min-height:44px; margin-top:4px; background:var(--accent); color:var(--on-accent); padding:11px 18px; font-size:.92rem; box-shadow:var(--shadow-accent); }
    .btn-primary:hover:not(:disabled) { background:var(--accent-hover); }
    .btn-primary:active:not(:disabled) { transform:scale(.99); }
    .btn-primary:disabled { opacity:.5; cursor:not-allowed; box-shadow:none; }
    .btn-secondary { background:var(--surface); color:var(--text); padding:9px 15px; border:1px solid var(--border); font-size:.84rem; }
    .btn-secondary:hover { background:var(--surface-2); border-color:var(--border-strong); }
    .icon-action { width:38px; height:38px; padding:0; flex:0 0 38px; display:inline-flex; align-items:center; justify-content:center; color:var(--text-2); border-radius:var(--radius-sm); cursor:pointer; transition:color .15s ease,background-color .15s ease; }
    .icon-action svg { width:18px; height:18px; }
    .icon-action-plain { border:0; background:transparent; box-shadow:none; }
    .icon-action-plain:hover { color:var(--accent); background:var(--accent-soft); }
    .icon-action-label { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
    .icon-action.is-loading { opacity:.6; cursor:progress; }
    .inline-generate-action { width:auto; min-height:38px; height:38px; margin:0 0 0 6px; padding:0 16px; white-space:nowrap; font-size:.86rem; box-shadow:none; }
    .filter-group { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; }
    .filter-chip { border:1px solid var(--border); background:var(--surface-2); color:var(--text-2); padding:5px 11px; font-weight:500; font-size:.76rem; border-radius:var(--radius-pill); cursor:pointer; transition:color .15s ease,background-color .15s ease,border-color .15s ease; }
    .filter-chip:hover { color:var(--text); border-color:var(--border-strong); background:var(--surface-3); }
    .filter-chip.active { background:var(--accent); border-color:var(--accent); color:var(--on-accent); font-weight:600; }
    .selected-voice { margin:12px 0 10px; padding:8px 11px; background:var(--surface-2); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:var(--radius-sm); color:var(--text); font-size:.78rem; font-family:var(--font-mono); overflow-wrap:anywhere; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .voice-panel { display:grid; grid-template-rows:auto auto auto auto auto minmax(0,1fr) auto; gap:8px; padding:18px; overflow:hidden; }
    .voice-panel .panel-header,.voice-panel .voice-search,.voice-panel .filter-group,.voice-panel .selected-voice { margin:0; }
    .voice-panel .panel-header { min-height:0; align-items:center; margin-bottom:4px; }
    .voice-panel .panel-header p { display:none; }
    .voice-panel .voice-search { display:grid; gap:6px; }
    .voice-panel .filter-group { flex-wrap:nowrap; overflow-x:auto; overflow-y:hidden; min-height:34px; padding-bottom:2px; scrollbar-width:thin; }
    .voice-panel .filter-chip { flex:0 0 auto; white-space:nowrap; padding:5px 10px; font-size:.74rem; }
    .voice-list { max-height:none; min-height:0; height:100%; display:grid; gap:5px; overflow:auto; padding:2px; margin:0 -2px; scrollbar-width:thin; scrollbar-color:var(--border-strong) transparent; }
    .voice-list::-webkit-scrollbar { width:6px; }
    .voice-list::-webkit-scrollbar-thumb { background:var(--border-strong); }
    .voice-list::-webkit-scrollbar-track { background:transparent; }
    .voice-item { position:relative; display:grid; gap:2px; width:100%; min-height:58px; padding:9px 12px; border:1px solid var(--border); background:var(--surface); color:var(--text); text-align:left; border-radius:var(--radius-md); cursor:pointer; transition:border-color .15s ease,background-color .15s ease; }
    .voice-item:hover { border-color:var(--border-strong); background:var(--surface-2); }
    .voice-item.active { border-color:var(--accent); background:var(--accent-soft); }
    .voice-item.active::before { content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--accent); }
    .voice-name { font-size:.88rem; display:block; min-width:0; line-height:1.45; padding-bottom:3px; margin-bottom:-3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .voice-meta { font-size:.75rem; display:block; min-width:0; line-height:1.45; padding-bottom:3px; margin-bottom:-3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .voice-id { display:none; }
    .empty-state { color:var(--warning); font-size:.82rem; font-family:var(--font-mono); padding:8px 0; margin:0; }
    .result-container { display:none; margin-top:18px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--surface-2); padding:16px; }
    .loading-container { text-align:center; color:var(--text-2); padding:16px; }
    .loading-spinner { width:28px; height:28px; margin:0 auto 10px; border-radius:50%; border:2.5px solid var(--border-strong); border-top-color:var(--accent); animation:spin .85s linear infinite; }
    .loading-text { margin:0 0 4px; font-family:var(--font-display); font-weight:600; font-size:.88rem; color:var(--text); }
    .progress-info { font-size:.76rem; color:var(--text-2); font-family:var(--font-mono); }
    .audio-player { width:100%; margin-bottom:12px; height:40px; }
    .error-message { color:var(--error); background:var(--error-bg); border:1px solid var(--error-border); border-radius:var(--radius-sm); padding:12px 14px; font-size:.85rem; }
    .token-config { display:flex; flex-wrap:wrap; gap:14px; }
    .token-config label { display:inline-flex; align-items:center; gap:7px; font-size:.85rem; color:var(--text-2); cursor:pointer; }
    .token-config input[type=radio] { accent-color:var(--accent); }
    .result-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
    .tts-production-panel { height:100%; min-height:0; display:grid; grid-template-rows:minmax(0,1fr) 220px; gap:14px; }
    .input-panel,.settings-panel,.result-panel { height:100%; min-height:0; }
    .tts-parameter-panel { overflow:hidden; }
    .settings-panel { height:100%; min-height:0; overflow:hidden; display:grid; grid-template-rows:auto minmax(0,1fr); padding:18px; }
    .settings-panel .panel-header { min-height:0; margin-bottom:12px; }
    .tts-result-panel { display:grid; grid-template-rows:auto minmax(0,1fr); overflow:hidden; padding:18px; }
    .tts-result-panel .panel-header { min-height:0; margin-bottom:10px; }
    .tts-result-container { display:flex; align-items:center; min-height:126px; height:auto; margin-top:0; overflow:hidden; padding:14px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--surface-2); position:relative; }
    .tts-result-container > div { width:100%; }
    .tts-result-container:not(:has(#loading:not([style*="none"]):not([style*="display: none"]), #success:not([style*="none"]):not([style*="display: none"]), #error:not([style*="none"]):not([style*="display: none"]))) { background:var(--surface); border:1px dashed var(--border); justify-content:center; }
    .tts-result-container:not(:has(#loading:not([style*="none"]):not([style*="display: none"]), #success:not([style*="none"]):not([style*="display: none"]), #error:not([style*="none"]):not([style*="display: none"])))::before { content:"Ready to synthesize · Audio output will appear here"; font-family:var(--font-mono); font-size:.78rem; color:var(--text-3); letter-spacing:.02em; }
    html[lang="zh-CN"] .tts-result-container:not(:has(#loading:not([style*="none"]):not([style*="display: none"]), #success:not([style*="none"]):not([style*="display: none"]), #error:not([style*="none"]):not([style*="display: none"])))::before { content:"就绪 · 生成的音频将在此展示与播放"; }
    .tts-parameter-panel > .panel-header { align-items:center; min-height:44px; margin-bottom:14px; }
    .tts-parameter-panel > .form-group { min-width:0; margin-bottom:0; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion:reduce) {
      *,*::before,*::after { animation-duration:.001ms!important; animation-iteration-count:1!important; transition-duration:.001ms!important; }
      .wave i { height:55%; }
    }
    @media (max-width:880px) {
      .app-shell { width:min(100% - 24px,720px); padding-top:16px; }
      .topbar { flex-direction:column; align-items:stretch; gap:12px; }
      .topbar-actions { justify-content:space-between; }
      .mode-switcher { flex:1; } .mode-btn { flex:1; }
      .workspace-grid,.controls-grid { grid-template-columns:1fr; }
      .workspace-grid { height:auto; }
      .tts-parameter-panel { display:block; }
      .tts-parameter-panel > .panel-header,.tts-parameter-panel > .form-group { grid-column:auto; grid-row:auto; }
      .controls-grid { grid-column:auto; grid-row:auto; }
      .tts-production-panel { height:auto; grid-template-rows:auto auto; }
      .input-panel,.voice-panel,.settings-panel,.result-panel { height:auto; overflow:visible; }
      .settings-panel { height:auto; overflow:visible; }
      .voice-panel { display:block; }
      .voice-panel .panel-header p { display:block; }
      .voice-panel .filter-group { flex-wrap:wrap; overflow:visible; }
      .voice-list { height:auto; max-height:400px; }
      .panel-header { flex-direction:column; }
      .panel-header-actions,.input-method-control { width:100%; align-items:flex-start; justify-content:flex-start; }
      .input-method-control .input-method-tabs { width:100%; }
      .input-method-control .tab-btn { flex:1; }
      .inline-action-group { flex-wrap:wrap; }
      .provider-grid { right:auto; left:0; width:min(840px,calc(100vw - 32px)); }
      .form-textarea { height:220px; min-height:220px; }
      .file-drop-zone,.audio-upload-zone { min-height:220px; }
    }
`;
