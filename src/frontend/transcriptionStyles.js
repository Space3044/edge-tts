export const TRANSCRIPTION_STYLES = `
    .transcription-panel {
      padding: 24px;
      background: var(--surface);
      background: color-mix(in srgb, var(--surface) 90%, transparent);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }
    .transcription-panel .panel-header {
      min-height: 40px;
      margin-bottom: 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .stt-workspace-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.12fr) minmax(360px, 0.88fr);
      gap: 20px;
      align-items: stretch;
    }
    .stt-source-card, .stt-config-card {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-shadow: var(--shadow-sm);
      transition: border-color .18s ease, box-shadow .18s ease;
    }
    .stt-source-card:hover, .stt-config-card:hover {
      border-color: var(--border-strong);
    }
    .stt-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .stt-step-tag {
      font-family: var(--font-mono);
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .04em;
      color: var(--accent);
      background: var(--accent-soft);
      border: 1px solid var(--accent-ring);
      border-radius: var(--radius-pill);
      padding: 2px 8px;
      line-height: 1.4;
    }
    .stt-card-title {
      margin: 0;
      font-family: var(--font-display);
      font-size: .95rem;
      font-weight: 700;
      letter-spacing: -.01em;
      color: var(--text);
    }
    .stt-upload-group {
      margin-bottom: 0;
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
    }
    .stt-upload-group > .form-label {
      display: none;
    }
    .audio-upload-zone {
      min-height: 220px;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      border: 1.5px dashed var(--border-strong);
      border-radius: var(--radius-md);
      background: var(--surface);
      padding: 26px 20px;
      text-align: center;
      cursor: pointer;
      transition: all .2s cubic-bezier(0.16,1,0.3,1);
    }
    .audio-upload-zone:hover, .audio-upload-zone.dragover {
      border-color: var(--accent);
      background: var(--accent-soft);
      transform: translateY(-1px);
      box-shadow: 0 4px 16px -2px rgba(79,70,229,.15);
    }
    .audio-upload-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--accent-soft);
      border: 1px solid var(--accent-ring);
      color: var(--accent);
      display: grid;
      place-items: center;
      transition: transform .2s ease;
    }
    .audio-upload-icon svg {
      width: 24px;
      height: 24px;
    }
    .audio-upload-zone:hover .audio-upload-icon {
      transform: scale(1.08);
    }
    .file-drop-text {
      font-size: .92rem;
      font-weight: 600;
      color: var(--text);
      margin: 0;
    }
    .stt-format-chips {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      margin: 2px 0;
    }
    .stt-format-chips span {
      font-family: var(--font-mono);
      font-size: .68rem;
      font-weight: 600;
      color: var(--text-2);
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      padding: 1px 7px;
    }
    .file-drop-hint {
      font-size: .74rem;
      color: var(--text-3);
      font-family: var(--font-mono);
      margin: 0;
    }
    .stt-divider {
      display: flex;
      align-items: center;
      text-align: center;
      color: var(--text-3);
      font-size: .72rem;
      font-family: var(--font-mono);
      font-weight: 700;
      letter-spacing: .08em;
      margin: 2px 0;
    }
    .stt-divider::before, .stt-divider::after {
      content: "";
      flex: 1;
      border-bottom: 1px solid var(--border);
    }
    .stt-divider span {
      padding: 0 12px;
    }
    .stt-url-group {
      margin-bottom: 0;
    }
    .stt-url-group .form-label {
      margin-bottom: 6px;
      font-size: .8rem;
      font-weight: 600;
      color: var(--text-2);
    }
    .stt-url-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .stt-url-icon {
      position: absolute;
      left: 12px;
      color: var(--text-3);
      display: grid;
      place-items: center;
      pointer-events: none;
    }
    .stt-url-icon svg {
      width: 16px;
      height: 16px;
    }
    .stt-url-input-wrap .form-input {
      padding-left: 36px;
      background: var(--surface);
    }
    #engineGroup {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 14px;
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      background: var(--surface);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
    }
    #engineGroup .form-label {
      margin: 0;
      color: var(--text-2);
      font-size: .74rem;
      text-transform: uppercase;
      letter-spacing: .04em;
      font-family: var(--font-mono);
      font-weight: 700;
    }
    .engine-tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
      padding: 4px;
      background: var(--surface-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
    }
    .engine-btn {
      min-height: 38px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-2);
      padding: 0 14px;
      font-family: var(--font-display);
      font-weight: 600;
      font-size: .85rem;
      border-radius: var(--radius-pill);
      cursor: pointer;
      transition: color .15s ease, background-color .15s ease, border-color .15s ease, box-shadow .15s ease, transform .12s ease;
    }
    .engine-btn:hover {
      color: var(--text);
    }
    .engine-btn:active {
      transform: scale(.98);
    }
    .engine-btn.active {
      color: var(--accent);
      background: var(--surface);
      border-color: var(--border);
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .stt-options-group {
      margin: 0;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
    }
    #elevenlabsOptions {
      margin: 0;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
    }
    #elevenlabsOptions .form-label {
      color: var(--text-2);
      font-size: .74rem;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    #elevenlabsOptions .form-input {
      background: var(--surface);
    }
    .elevenlabs-grid {
      display: grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap: 12px;
      align-items: stretch;
    }
    .elevenlabs-grid label:not(.toggle-option) {
      min-width: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .elevenlabs-grid label > span {
      font-size: .76rem;
      font-weight: 600;
      color: var(--text-2);
    }
    .stt-prompt-field, .stt-wide {
      grid-column: 1 / -1;
    }
    .stt-prompt-field .compact-textarea {
      height: 64px;
      min-height: 64px;
    }
    .toggle-option {
      display: grid;
      grid-template-columns:auto max-content minmax(0,1fr);
      column-gap: 12px;
      align-items: center;
      min-height: 44px;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: border-color .15s ease, background-color .15s ease;
    }
    .toggle-option:hover {
      border-color: var(--accent-ring);
      background: var(--surface-hover);
    }
    .toggle-option input {
      width: 18px;
      height: 18px;
      margin: 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .toggle-option > span:first-child {
      font-weight: 600;
      font-size: .84rem;
      white-space:nowrap;
    }
    .toggle-hint {
      color: var(--text-2);
      font-size: .78rem;
      line-height: 1.4;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space:nowrap;
    }
    .stt-submit-btn {
      margin-top: auto;
      min-height: 48px;
      font-size: .94rem;
      font-weight: 700;
      letter-spacing: .02em;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
      color: var(--on-accent);
      border: 0;
      border-radius: var(--radius-md);
      box-shadow: 0 4px 16px -2px rgba(79,70,229,.42);
      cursor: pointer;
      transition: all .18s ease;
    }
    .stt-submit-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      filter: brightness(1.05);
      box-shadow: 0 6px 20px -2px rgba(79,70,229,.52);
    }
    .stt-submit-btn:active:not(:disabled) {
      transform: translateY(0);
      filter: brightness(.98);
    }
    .stt-btn-icon {
      width: 18px;
      height: 18px;
    }
    .provider-config {
      position: relative;
    }
    .provider-cards {
      display: grid;
      gap: 16px;
    }
    .audio-preview-shell {
      margin-top: 10px;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }
    .audio-preview-player {
      display: block;
      width: 100%;
      height: 36px;
    }
    .transcription-result-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .transcription-result-header .form-label {
      margin: 0;
    }
    .transcription-view-tabs {
      display: flex;
      gap: 3px;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      background: var(--surface-2);
    }
    .transcription-view-btn {
      min-height: 30px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-2);
      padding: 0 12px;
      font-family: var(--font-display);
      font-size: .78rem;
      font-weight: 600;
      border-radius: var(--radius-pill);
      cursor: pointer;
      transition: color .15s ease, background-color .15s ease;
    }
    .transcription-view-btn:hover {
      color: var(--text);
    }
    .transcription-view-btn.active {
      color: var(--accent);
      border-color: var(--border);
      background: var(--surface);
      box-shadow: 0 1px 2px rgba(0,0,0,.05);
    }
    .timestamp-result-view {
      min-height: 180px;
      max-height: 360px;
      overflow: auto;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      scrollbar-width: thin;
    }
    .sentence-timestamp-view {
      gap: 6px;
    }
    .timestamp-row {
      display: grid;
      grid-template-columns:200px minmax(0,1fr);
      gap: 14px;
      align-items: start;
      width: 100%;
      padding: 8px 12px;
      border: 0;
      border-bottom: 1px solid var(--border-subtle);
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: background-color .12s ease, transform .12s ease;
      border-radius: var(--radius-xs);
    }
    .timestamp-playable:hover {
      background: var(--accent-soft);
      transform: translateX(2px);
    }
    .timestamp-row:last-child {
      border-bottom: 0;
    }
    .timestamp-range {
      font-family: var(--font-mono);
      color: var(--accent);
      font-size: .76rem;
      white-space: nowrap;
      font-weight: 600;
    }
    .timestamp-text {
      min-width: 0;
      line-height: 1.5;
      overflow-wrap: anywhere;
      font-size: .88rem;
    }
    .word-timestamp-view {
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 6px;
    }
    .word-token {
      display: inline-grid;
      gap: 2px;
      min-width: 76px;
      max-width: 180px;
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-xs);
      background: var(--surface-2);
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: all .12s ease;
    }
    .word-token:hover {
      background: var(--accent-soft);
      border-color: var(--accent);
      transform: translateY(-1px);
      box-shadow: 0 2px 6px -1px rgba(79,70,229,.2);
    }
    .word-token-punctuation {
      min-width: 54px;
    }
    .word-token-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
      font-size: .84rem;
    }
    .word-token-time {
      color: var(--text-3);
      font-family: var(--font-mono);
      font-size: .66rem;
      white-space: nowrap;
    }
    .timestamp-empty {
      margin: 0;
      color: var(--text-2);
      font-size: .84rem;
      font-family: var(--font-mono);
      padding: 12px;
      text-align: center;
    }
    @media (max-width: 900px) {
      .stt-workspace-grid {
        grid-template-columns: 1fr;
      }
      .transcription-result-header {
        align-items: stretch;
        flex-direction: column;
      }
      .transcription-view-tabs {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .transcription-view-btn {
        padding: 0 6px;
      }
      .timestamp-row {
        grid-template-columns: 1fr;
        gap: 4px;
      }
      .elevenlabs-grid {
        grid-template-columns: 1fr;
      }
      .toggle-option {
        grid-template-columns: auto 1fr;
        grid-template-rows: auto auto;
        align-items: start;
      }
      .toggle-option input {
        grid-row: 1 / 3;
        margin-top: 1px;
      }
      .toggle-hint {
        white-space: normal;
        overflow: visible;
        text-overflow: clip;
      }
    }
`;
