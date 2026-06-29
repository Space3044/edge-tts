export const POLISH_UNDO_SCRIPT = `
    (function() {
      let polishUndoSnapshot = null;
      let polishUndoPending = false;

      function getTextInput() {
        return document.getElementById('text');
      }

      function getUndoButton() {
        return document.getElementById('polishUndoBtn');
      }

      function setUndoVisible(visible) {
        const button = getUndoButton();
        if (!button) return;
        button.style.display = visible ? 'inline-flex' : 'none';
        button.disabled = !visible;
      }

      function clearPolishUndo() {
        polishUndoSnapshot = null;
        polishUndoPending = false;
        setUndoVisible(false);
      }

      function captureBeforePolish() {
        const textInput = getTextInput();
        if (!textInput || !textInput.value.trim()) {
          clearPolishUndo();
          return;
        }
        polishUndoSnapshot = textInput.value;
        polishUndoPending = true;
        setUndoVisible(false);
      }

      function maybeShowPolishUndo() {
        const textInput = getTextInput();
        if (!textInput) return;
        if (polishUndoSnapshot !== null && textInput.value !== polishUndoSnapshot) {
          polishUndoPending = false;
          setUndoVisible(true);
        }
      }

      function restorePolishUndo() {
        const textInput = getTextInput();
        if (!textInput || polishUndoSnapshot === null) return;
        textInput.value = polishUndoSnapshot;
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        textInput.focus();
        clearPolishUndo();
      }

      document.addEventListener('DOMContentLoaded', function() {
        const polishButton = document.getElementById('polishBtn');
        const undoButton = getUndoButton();
        const textInput = getTextInput();
        if (polishButton) polishButton.addEventListener('click', captureBeforePolish, true);
        if (undoButton) undoButton.addEventListener('click', restorePolishUndo);
        if (textInput) {
          textInput.addEventListener('input', function() {
            if (polishUndoPending) maybeShowPolishUndo();
          });
        }
        setUndoVisible(false);
      });
    })();
`;
