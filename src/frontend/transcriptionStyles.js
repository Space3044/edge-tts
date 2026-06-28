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
