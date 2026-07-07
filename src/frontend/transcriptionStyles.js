export const TRANSCRIPTION_STYLES = `
    #transcriptionForm > .form-group:nth-of-type(3) {
      display:grid;
      gap:10px;
      margin:0 0 12px;
      padding:12px;
      border:1px solid var(--border);
      border-left:3px solid var(--accent);
      background:linear-gradient(90deg,var(--accent-soft),var(--surface-2));
    }
    #transcriptionForm > .form-group:nth-of-type(3) .form-label {
      margin:0;
      color:var(--text-2);
      font-size:.76rem;
      text-transform:uppercase;
    }
    .engine-tabs {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:6px;
      padding:4px;
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:var(--radius-sm);
    }
    .engine-btn {
      min-height:42px;
      border:1px solid transparent;
      background:transparent;
      color:var(--text-2);
      padding:0 12px;
      font-family:var(--font-display);
      font-weight:600;
      font-size:.88rem;
      border-radius:var(--radius-sm);
      cursor:pointer;
      transition:color .18s ease,background-color .18s ease,border-color .18s ease,box-shadow .18s ease;
    }
    .engine-btn:hover {
      color:var(--text);
      background:var(--surface-2);
    }
    .engine-btn.active {
      color:var(--accent);
      background:var(--accent-soft);
      border-color:var(--accent);
      box-shadow:inset 0 0 0 1px var(--accent-ring);
    }
    #whisperOptions,
    #elevenlabsOptions {
      margin:0 0 12px;
      padding:14px;
      border:1px solid var(--border);
      background:var(--surface-2);
    }
    #whisperOptions .form-label,
    #elevenlabsOptions .form-label {
      color:var(--text-2);
      font-size:.76rem;
    }
    #whisperOptions .form-input,
    #elevenlabsOptions .form-input {
      background:var(--surface);
    }
    .audio-preview-shell {
      margin-top:10px;
      padding:10px 12px;
      border:1px solid var(--border);
      background:var(--surface-2);
    }
    .audio-preview-player {
      display:block;
      width:100%;
      height:38px;
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
      gap:4px;
      padding:3px;
      border:1px solid var(--border);
      background:var(--surface);
    }
    .transcription-view-btn {
      min-height:32px;
      border:1px solid transparent;
      background:transparent;
      color:var(--text-2);
      padding:0 10px;
      font-size:.78rem;
      font-weight:600;
      cursor:pointer;
    }
    .transcription-view-btn:hover {
      color:var(--text);
      background:var(--surface-2);
    }
    .transcription-view-btn.active {
      color:var(--accent);
      border-color:var(--accent);
      background:var(--accent-soft);
    }
    .timestamp-result-view {
      min-height:180px;
      max-height:360px;
      overflow:auto;
      padding:12px;
      border:1px solid var(--border);
      background:var(--surface);
    }
    .sentence-timestamp-view {
      gap:8px;
    }
    .timestamp-row {
      display:grid;
      grid-template-columns:200px minmax(0,1fr);
      gap:16px;
      align-items:start;
      width:100%;
      padding:9px 0;
      border:0;
      border-bottom:1px solid var(--border);
      background:transparent;
      color:inherit;
      text-align:left;
      cursor:pointer;
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
    }
    .timestamp-text {
      min-width:0;
      line-height:1.55;
      overflow-wrap:anywhere;
    }
    .word-timestamp-view {
      flex-wrap:wrap;
      align-content:flex-start;
      gap:8px;
    }
    .word-token {
      display:inline-grid;
      gap:2px;
      min-width:76px;
      max-width:180px;
      padding:7px 8px;
      border:1px solid var(--border);
      background:var(--surface-2);
      color:inherit;
      text-align:left;
      cursor:pointer;
    }
    .word-token-punctuation {
      min-width:58px;
    }
    .word-token-text {
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      font-weight:600;
    }
    .word-token-time {
      color:var(--text-2);
      font-family:var(--font-mono);
      font-size:.66rem;
      white-space:nowrap;
    }
    .timestamp-empty {
      margin:0;
      color:var(--text-2);
      font-size:.85rem;
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
      background:var(--surface);
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
