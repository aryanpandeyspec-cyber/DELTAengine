// --- ZERO-LAG HARDWARE OS SVG CURSOR CONTROLLER (DELTA ENGINE v3.6) ---
// Hardware-accelerated Electric Blue Tripoint cursor with 0ms latency and 0 CPU/GPU canvas overhead.

(function initZeroLagSvgCursor() {
  function setupHardwareCursor() {
    // 1. Remove artificial laggy full-screen canvas if present
    const canvas = document.getElementById('cursor-comet-canvas');
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }

    // 2. Remove synthetic DOM cursor element if present
    const cursor = document.getElementById('custom-tripoint-cursor');
    if (cursor && cursor.parentNode) {
      cursor.parentNode.removeChild(cursor);
    }

    // 3. Remove any obsolete style overrides that forced cursor: none
    const oldOverride = document.getElementById('custom-cursor-global-override');
    if (oldOverride && oldOverride.parentNode) {
      oldOverride.parentNode.removeChild(oldOverride);
    }

    // 4. Inject or update the canonical zero-lag hardware SVG cursor style
    let styleEl = document.getElementById('delta-hardware-svg-cursor-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'delta-hardware-svg-cursor-style';
      styleEl.textContent = `
        :root, html, body {
          cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%0A%20%20%3Cpolygon%20points%3D%222%2C2%2024%2C10%2016%2C16%2010%2C24%22%20fill%3D%22%234285f4%22%20stroke%3D%22%23000000%22%20stroke-width%3D%222%22%20stroke-linejoin%3D%22round%22%2F%3E%0A%20%20%3Cpolygon%20points%3D%225%2C5%2019%2C11%2014%2C14%2011%2C19%22%20fill%3D%22%238ab4f8%22%2F%3E%0A%3C%2Fsvg%3E") 2 2, auto !important;
        }

        a, button, .btn, [role="button"], select, summary, .color-btn, .stepper-btn, .auth-tab-btn, .btn-close-modal, .scenario-card-select, .vol-zone-select, .clickable, label[for] {
          cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%0A%20%20%3Cpolygon%20points%3D%222%2C2%2024%2C10%2016%2C16%2010%2C24%22%20fill%3D%22%232563eb%22%20stroke%3D%22%23000000%22%20stroke-width%3D%222%22%20stroke-linejoin%3D%22round%22%2F%3E%0A%20%20%3Cpolygon%20points%3D%225%2C5%2019%2C11%2014%2C14%2011%2C19%22%20fill%3D%22%23facc15%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%222%22%20cy%3D%222%22%20r%3D%222.5%22%20fill%3D%22%2322c55e%22%20stroke%3D%22%23000000%22%20stroke-width%3D%221%22%2F%3E%0A%3C%2Fsvg%3E") 2 2, pointer !important;
        }

        input[type="text"], input[type="password"], input[type="number"], input[type="email"], textarea, [contenteditable="true"] {
          cursor: text !important;
        }

        [draggable="true"], .drag-handle, .kanban-card {
          cursor: grab !important;
        }
        [draggable="true"]:active, .drag-handle:active, .kanban-card:active {
          cursor: grabbing !important;
        }
      `;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHardwareCursor);
  } else {
    setupHardwareCursor();
  }
})();
