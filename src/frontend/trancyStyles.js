export const TRANCY_STYLES = `
    .trancy-panel { display:block; }
    .trancy-topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:14px; padding:12px 20px; min-height:48px; background:var(--surface); background:color-mix(in srgb,var(--surface) 88%,transparent); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid var(--border); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); }
    .trancy-topbar h2 { margin:0; font-family:var(--font-display); font-size:1.06rem; font-weight:700; letter-spacing:-.015em; }
    .trancy-topbar p { display:none; }
    #trancyAddHint { display:none; }
    .trancy-topbar-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .trancy-summary { font-family:var(--font-mono); font-size:.76rem; color:var(--text-2); padding:4px 10px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-pill); }
    .trancy-summary b { color:var(--text); font-weight:600; }
    .trancy-layout { display:grid; grid-template-columns:minmax(260px,320px) minmax(0,1fr); gap:14px; align-items:stretch; }
    @media (max-width:900px) { .trancy-layout { grid-template-columns:1fr; } }
    .trancy-add-card, .trancy-list-card { padding:18px 20px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); min-height:440px; }
    [data-theme="light"] .trancy-add-card, [data-theme="light"] .trancy-list-card { box-shadow:0 1px 0 rgba(255,255,255,.9) inset,var(--shadow-sm); }
    [data-theme="dark"] .trancy-add-card, [data-theme="dark"] .trancy-list-card { box-shadow:0 1px 0 rgba(255,255,255,.05) inset,var(--shadow-sm); }
    .trancy-add-card { display:grid; gap:12px; align-content:start; }
    .trancy-add-card h3, .trancy-list-card h3 { margin:0; font-family:var(--font-display); font-size:.95rem; font-weight:700; }
    .trancy-field { display:grid; gap:6px; }
    .trancy-field > span { font-size:.76rem; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--text-2); font-family:var(--font-mono); }
    .trancy-add-card .form-textarea { height:96px; min-height:96px; max-height:96px; font-family:var(--font-mono); font-size:.74rem; line-height:1.45; word-break:break-all; resize:vertical; }
    .trancy-list-card .panel-header { margin-bottom:10px; }
    .trancy-account-list { display:grid; gap:8px; }
    .trancy-account { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-md); transition:border-color .16s ease,background-color .16s ease,transform .12s ease; }
    .trancy-account:hover { border-color:var(--border-strong); background:var(--surface-hover); transform:translateY(-1px); }
    .trancy-account[data-status="dead"] { border-color:var(--error-border); background:var(--error-bg); }
    .trancy-account-main { min-width:0; display:grid; gap:4px; }
    .trancy-account-title { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
    .trancy-account-title-text { font-family:var(--font-display); font-weight:600; font-size:.9rem; color:var(--text); }
    .trancy-badge { padding:1px 8px; font-family:var(--font-mono); font-size:.66rem; letter-spacing:.04em; text-transform:uppercase; border-radius:var(--radius-pill); border:1px solid var(--border-strong); color:var(--text-2); background:var(--surface); }
    .trancy-badge-ok { color:#0f766e; border-color:rgba(13,148,136,.4); background:rgba(13,148,136,.1); }
    [data-theme="dark"] .trancy-badge-ok { color:#5eead4; border-color:rgba(94,234,212,.35); background:rgba(94,234,212,.1); }
    .trancy-badge-new { color:var(--warning); border-color:rgba(217,119,6,.35); background:rgba(217,119,6,.1); }
    .trancy-badge-dead, .trancy-badge-banned { color:var(--error); border-color:var(--error-border); background:var(--error-bg); }
    .trancy-badge-premium { color:var(--accent); border-color:var(--accent-ring); background:var(--accent-soft); }
    .trancy-account-meta { margin:0; font-family:var(--font-mono); font-size:.71rem; color:var(--text-3); word-break:break-word; }
    .trancy-account-meta b { color:var(--text-2); font-weight:500; }
    .trancy-account-creds { margin-top:2px; }
    .trancy-password { font-family:var(--font-mono); font-size:.74rem; padding:1px 6px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-xs); color:var(--text); cursor:pointer; user-select:all; transition:all .12s ease; }
    .trancy-password:hover { border-color:var(--accent-ring); color:var(--accent); }
    .trancy-password.is-hidden { cursor:default; color:var(--text-3); }
    .trancy-reveal { margin-left:6px; padding:0 6px; font-family:var(--font-mono); font-size:.68rem; text-transform:uppercase; letter-spacing:.04em; color:var(--text-3); background:transparent; border:1px solid var(--border); border-radius:var(--radius-pill); cursor:pointer; transition:color .15s ease,border-color .15s ease; }
    .trancy-reveal:hover { color:var(--accent); border-color:var(--accent-ring); }
    .trancy-mode-tabs { display:flex; gap:3px; padding:3px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-pill); }
    .trancy-mode-tabs .tab-btn { flex:1 1 0; padding:5px 8px; font-size:.78rem; border-radius:var(--radius-pill); }
    .trancy-credential-fields { display:grid; gap:10px; }
    .trancy-account-actions { display:flex; gap:6px; flex:0 0 auto; }
    .trancy-account-actions .btn-secondary { padding:5px 10px; font-size:.76rem; }
    .trancy-danger { color:var(--error); border-color:var(--error-border); }
    .trancy-danger:hover { background:var(--error-bg); color:var(--error); }
    .trancy-add-status { margin:0; min-height:1.1em; font-size:.78rem; color:var(--text-2); }
    .trancy-add-status[data-tone="error"] { color:var(--error); }
    .trancy-add-status[data-tone="ok"] { color:#0f766e; }
    [data-theme="dark"] .trancy-add-status[data-tone="ok"] { color:#5eead4; }
`;
