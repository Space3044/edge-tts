export const AUDIO_PREVIEW_SCRIPT = `
    (function() {
      let audioPreviewUrl = null;

      function clearAudioPreview() {
        const shell = document.getElementById('audioPreviewShell');
        const player = document.getElementById('audioPreviewPlayer');
        if (audioPreviewUrl) {
          URL.revokeObjectURL(audioPreviewUrl);
          audioPreviewUrl = null;
        }
        if (player) {
          player.removeAttribute('src');
          player.load();
        }
        if (shell) shell.style.display = 'none';
      }

      function showAudioPreview(file) {
        const shell = document.getElementById('audioPreviewShell');
        const player = document.getElementById('audioPreviewPlayer');
        if (!shell || !player || !file) return;
        clearAudioPreview();
        audioPreviewUrl = URL.createObjectURL(file);
        player.src = audioPreviewUrl;
        shell.style.display = 'block';
      }

      document.addEventListener('voicecraft:audio-file-selected', function(event) {
        showAudioPreview(event.detail && event.detail.file);
      });

      document.addEventListener('voicecraft:audio-file-cleared', clearAudioPreview);

      document.addEventListener('DOMContentLoaded', function() {
        window.addEventListener('pagehide', clearAudioPreview);
      });
    })();
`;
