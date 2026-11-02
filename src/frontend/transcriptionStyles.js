export const TRANSCRIPTION_STYLES = `
    #engineGroup {
      display:grid;
      gap:10px;
      margin:0 0 16px;
      padding:14px;
      border:1px solid var(--border);
      border-left:3px solid var(--accent);
      background:var(--surface-2);
      border-radius:var(--radius-md);
      box-shadow:var(--shadow-sm);
    }
    #engineGroup .form-label {
      margin:0;
      color:var(--text-2);
      font-size:.74rem;
      text-transform:uppercase;
      letter-spacing:.04em;
    }
    .engine-tabs {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:4px;
      padding:3px;
      background:var(--surface-3);
      border:1px solid var(--border);
      border-radius:var(--radius-sm);
    }
    .engine-btn {
      min-height:38px;
      border:1px solid transparent;
      background:transparent;
      color:var(--text-2);
      padding:0 12px;
      font-family:var(--font-display);
      font-weight:600;
      font-size:.85rem;
      border-radius:var(--radius-xs);
      cursor:pointer;
      transition:color .15s ease,background-color .15s ease,border-color .15s ease,box-shadow .15s ease;
    }
    .engine-btn:hover {
      color:var(--text);
    }
    .engine-btn.active {
      color:var(--accent);
      background:var(--surface);
      border-color:var(--border);
      box-shadow:0 1px 3px rgba(0,0,0,.08);
    }
    #elevenlabsOptions {
      margin:0 0 16px;
      padding:14px;
      border:1px solid var(--border);
      border-radius:var(--radius-md);
      background:var(--surface-2);
      box-shadow:var(--shadow-sm);
    }
    #elevenlabsOptions .form-label {
      color:var(--text-2);
      font-size:.74rem;
      text-transform:uppercase;
      letter-spacing:.04em;
    }
    #elevenlabsOptions .form-input {
      background:var(--surface);
    }
    .audio-preview-shell {
      margin-top:10px;
      padding:10px 14px;
      border:1px solid var(--border);
      border-radius:var(--radius-sm);
      background:var(--surface-2);
    }
    .audio-preview-player {
      display:block;
      width:100%;
      height:36px;
    }
    .transcription-result-header {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:8px;
    }
    .transcription-result-header .form-label {
      margin:0;
    }
    .transcription-view-tabs {
      display:flex;
      gap:3px;
      padding:3px;
      border:1px solid var(--border);
      border-radius:var(--radius-sm);
      background:var(--surface-2);
    }
    .transcription-view-btn {
      min-height:30px;
      border:1px solid transparent;
      background:transparent;
      color:var(--text-2);
      padding:0 10px;
      font-family:var(--font-display);
      font-size:.78rem;
      font-weight:600;
      border-radius:var(--radius-xs);
      cursor:pointer;
      transition:color .15s ease,background-color .15s ease;
    }
    .transcription-view-btn:hover {
      color:var(--text);
    }
    .transcription-view-btn.active {
      color:var(--accent);
      border-color:var(--border);
      background:var(--surface);
      box-shadow:0 1px 2px rgba(0,0,0,.05);
    }
    .timestamp-result-view {
      min-height:180px;
      max-height:360px;
      overflow:auto;
      padding:14px;
      border:1px solid var(--border);
      border-radius:var(--radius-md);
      background:var(--surface);
      scrollbar-width:thin;
    }
    .sentence-timestamp-view {
      gap:6px;
    }
    .timestamp-row {
      display:grid;
      grid-template-columns:200px minmax(0,1fr);
      gap:14px;
      align-items:start;
      width:100%;
      padding:8px 10px;
      border:0;
      border-bottom:1px solid var(--border-subtle);
      background:transparent;
      color:inherit;
      text-align:left;
      cursor:pointer;
      transition:background-color .12s ease;
      border-radius:var(--radius-xs);
    }
    .timestamp-playable:hover {
      background:var(--accent-soft);
    }
    .timestamp-row:last-child {
      border-bottom:0;
    }
    .timestamp-range {
      font-family:var(--font-mono);
      color:var(--accent);
      font-size:.76rem;
      white-space:nowrap;
      font-weight:600;
    }
    .timestamp-text {
      min-width:0;
      line-height:1.5;
      overflow-wrap:anywhere;
      font-size:.88rem;
    }
    .word-timestamp-view {
      flex-wrap:wrap;
      align-content:flex-start;
      gap:6px;
    }
    .word-token {
      display:inline-grid;
      gap:2px;
      min-width:76px;
      max-width:180px;
      padding:6px 8px;
      border:1px solid var(--border);
      border-radius:var(--radius-xs);
      background:var(--surface-2);
      color:inherit;
      text-align:left;
      cursor:pointer;
      transition:all .12s ease;
    }
    .word-token:hover {
      background:var(--accent-soft);
      border-color:var(--accent);
      transform:translateY(-1px);
    }
    .word-token-punctuation {
      min-width:54px;
    }
    .word-token-text {
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      font-weight:600;
      font-size:.84rem;
    }
    .word-token-time {
      color:var(--text-3);
      font-family:var(--font-mono);
      font-size:.66rem;
      white-space:nowrap;
    }
    .timestamp-empty {
      margin:0;
      color:var(--text-2);
      font-size:.84rem;
      font-family:var(--font-mono);
      padding:12px;
      text-align:center;
    }
    .stt-prompt-field, .stt-wide {
      grid-column:1 / -1;
    }
    .stt-prompt-field .compact-textarea {
      height:64px;
      min-height:64px;
    }
    .elevenlabs-grid {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
      align-items:stretch;
    }
    .elevenlabs-grid label {
      min-width:0;
      margin:0;
    }
    .toggle-option {
      display:grid;
      grid-template-columns:auto max-content minmax(0,1fr);
      column-gap:10px;
      align-items:center;
      min-height:44px;
      padding:11px 12px;
      border:1px solid var(--border);
      border-radius:var(--radius-sm);
      background:var(--surface);
      box-shadow:var(--shadow-sm);
    }
    .toggle-option input {
      width:18px;
      height:18px;
      margin:0;
      accent-color:var(--accent);
    }
    .toggle-option > span:first-child {
      font-weight:600;
      font-size:.84rem;
      white-space:nowrap;
    }
    .toggle-hint {
      color:var(--text-2);
      font-size:.78rem;
      line-height:1.4;
      min-width:0;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    @media (max-width:880px) {
      .transcription-result-header {
        align-items:stretch;
        flex-direction:column;
      }
      .transcription-view-tabs {
        width:100%;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
      }
      .transcription-view-btn {
        padding:0 6px;
      }
      .timestamp-row {
        grid-template-columns:1fr;
        gap:4px;
      }
      .elevenlabs-grid {
        grid-template-columns:1fr;
      }
      .toggle-option {
        grid-template-columns:auto 1fr;
        grid-template-rows:auto auto;
        align-items:start;
      }
      .toggle-option input {
        grid-row:1 / 3;
        margin-top:1px;
      }
      .toggle-hint {
        white-space:normal;
        overflow:visible;
        text-overflow:clip;
      }
    }
`;
