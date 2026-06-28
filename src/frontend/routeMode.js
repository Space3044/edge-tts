export const ROUTE_MODE_SCRIPT = `
    (function() {
      function getModeFromPath() {
        if (window.location.pathname === '/transcription') return 'transcription';
        return 'tts';
      }
      function navigateModePath(mode, event) {
        if (mode === 'tts' && window.location.pathname !== '/tts') {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.location.assign('/tts');
        }
        if (mode === 'transcription' && window.location.pathname !== '/transcription') {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.location.assign('/transcription');
        }
      }
      document.addEventListener('DOMContentLoaded', function() {
        if (typeof switchMode !== 'function') return;
        switchMode(getModeFromPath(), false);
        var ttsMode = document.getElementById('ttsMode');
        var transcriptionMode = document.getElementById('transcriptionMode');
        if (ttsMode) ttsMode.addEventListener('click', function(event) { navigateModePath('tts', event); }, true);
        if (transcriptionMode) transcriptionMode.addEventListener('click', function(event) { navigateModePath('transcription', event); }, true);
      });
    })();
`;
