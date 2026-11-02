export const ROUTE_MODE_SCRIPT = `
    (function() {
      function getModeFromPath() {
        if (window.location.pathname === '/transcription') return 'transcription';
        if (window.location.pathname === '/trancy') return 'trancy';
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
        if (mode === 'trancy' && window.location.pathname !== '/trancy') {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.location.assign('/trancy');
        }
      }
      document.addEventListener('DOMContentLoaded', function() {
        if (typeof switchMode !== 'function') return;
        switchMode(getModeFromPath(), false);
        ['tts', 'transcription', 'trancy'].forEach(function(mode) {
          var button = document.getElementById(mode + 'Mode');
          if (button) button.addEventListener('click', function(event) { navigateModePath(mode, event); }, true);
        });
      });
    })();
`;
