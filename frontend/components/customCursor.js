// --- ZERO-LAG NATIVE HARDWARE OS CURSOR CONTROLLER (DELTA ENGINE) ---
// Restores clean, natural system hardware mouse pointer with zero lag and no unnatural colors.

(function initNativeHardwareCursor() {
  function cleanupSyntheticCursors() {
    // 1. Remove legacy canvas trail if present
    const canvas = document.getElementById('cursor-comet-canvas');
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);

    // 2. Remove legacy DOM cursor element if present
    const cursor = document.getElementById('custom-tripoint-cursor');
    if (cursor && cursor.parentNode) cursor.parentNode.removeChild(cursor);

    // 3. Remove custom cursor style overrides
    const oldStyles = [
      'custom-cursor-global-override',
      'delta-tripoint-inversus-cursor-style',
      'delta-hardware-svg-cursor-style'
    ];
    oldStyles.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });

    // 4. Ensure root elements do not have custom cursor classes or overrides
    if (document.documentElement) {
      document.documentElement.classList.remove('custom-cursor-active');
      document.documentElement.style.removeProperty('cursor');
    }
    if (document.body) {
      document.body.classList.remove('custom-cursor-active');
      document.body.style.removeProperty('cursor');
    }
  }

  cleanupSyntheticCursors();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanupSyntheticCursors);
  }
})();
