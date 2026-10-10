// --- ZERO-LAG HARDWARE OS CURSOR CONTROLLER (DELTA ENGINE v3.6) ---
// Eliminates artificial DOM/Canvas cursor layers to restore pure 0ms OS hardware-accelerated cursor responsiveness.

(function initZeroLagCursor() {
  function cleanupSyntheticCursors() {
    // 1. Remove artificial full-screen canvas if present
    const canvas = document.getElementById('cursor-comet-canvas');
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }

    // 2. Remove synthetic DOM cursor element if present
    const cursor = document.getElementById('custom-tripoint-cursor');
    if (cursor && cursor.parentNode) {
      cursor.parentNode.removeChild(cursor);
    }

    // 3. Remove any injected style overrides that forced cursor: none
    const styleOverride = document.getElementById('custom-cursor-global-override');
    if (styleOverride && styleOverride.parentNode) {
      styleOverride.parentNode.removeChild(styleOverride);
    }

    // 4. Ensure document body and root have default native cursor restored
    if (document.documentElement) {
      document.documentElement.style.removeProperty('cursor');
    }
    if (document.body) {
      document.body.style.removeProperty('cursor');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanupSyntheticCursors);
  } else {
    cleanupSyntheticCursors();
  }
})();
