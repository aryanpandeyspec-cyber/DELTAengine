// --- NEUBRUTALISM TRIPOINT INVERSUS HARDWARE CURSOR CONTROLLER (DELTA ENGINE v3.6) ---
// High-performance hardware-accelerated Neubrutalist inverted triangle pointer with hard drop shadow, zero canvas trail, zero CPU/GPU overhead.

(function initNeubrutalismTripointCursor() {
  function setupHardwareCursor() {
    // 1. Purge legacy canvas trail if present in DOM (Eliminates all canvas overhead)
    const canvas = document.getElementById('cursor-comet-canvas');
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }

    // 2. Purge synthetic DOM cursor element if present in DOM
    const cursor = document.getElementById('custom-tripoint-cursor');
    if (cursor && cursor.parentNode) {
      cursor.parentNode.removeChild(cursor);
    }

    // 3. Purge obsolete cursor: none style overrides
    const oldOverride = document.getElementById('custom-cursor-global-override');
    if (oldOverride && oldOverride.parentNode) {
      oldOverride.parentNode.removeChild(oldOverride);
    }

    // 4. Ensure root elements do not have custom-cursor-active class hiding native pointers
    if (document.documentElement) document.documentElement.classList.remove('custom-cursor-active');
    if (document.body) document.body.classList.remove('custom-cursor-active');

    // 5. Inject the Neubrutalism Tripoint Inversus CSS rules directly to document head for instant frame-0 readiness
    let styleEl = document.getElementById('delta-tripoint-inversus-cursor-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'delta-tripoint-inversus-cursor-style';
      styleEl.textContent = `
        :root, html, body {
          cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%0A%20%20%3Cg%20transform%3D%22translate(-8%2C%201)%20rotate(-45%2013%202)%22%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2213%2C2%2025%2C25%2013%2C18%201%2C25%22%20fill%3D%22%23000000%22%20stroke%3D%22%23000000%22%20stroke-width%3D%222.5%22%20stroke-linejoin%3D%22round%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%20transform%3D%22translate(-10%2C%20-1)%20rotate(-45%2013%202)%22%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2213%2C2%2025%2C25%2013%2C18%201%2C25%22%20fill%3D%22%234285f4%22%20stroke%3D%22%23000000%22%20stroke-width%3D%222.5%22%20stroke-linejoin%3D%22round%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2213%2C6%2020%2C21%2013%2C16%206%2C21%22%20fill%3D%22%238ab4f8%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E") 3 1, auto !important;
        }

        a, button, .btn, [role="button"], select, summary, .color-btn, .stepper-btn, .auth-tab-btn, .btn-close-modal, .scenario-card-select, .vol-zone-select, .clickable, label[for], input[type="submit"], input[type="button"], input[type="reset"] {
          cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%0A%20%20%3Cg%20transform%3D%22translate(-8%2C%201)%20rotate(-45%2013%202)%22%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2213%2C2%2025%2C25%2013%2C18%201%2C25%22%20fill%3D%22%23000000%22%20stroke%3D%22%23000000%22%20stroke-width%3D%222.5%22%20stroke-linejoin%3D%22round%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%20%20%3Cg%20transform%3D%22translate(-10%2C%20-1)%20rotate(-45%2013%202)%22%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2213%2C2%2025%2C25%2013%2C18%201%2C25%22%20fill%3D%22%232563eb%22%20stroke%3D%22%23000000%22%20stroke-width%3D%222.5%22%20stroke-linejoin%3D%22round%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2213%2C6%2020%2C21%2013%2C16%206%2C21%22%20fill%3D%22%23facc15%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2213%22%20cy%3D%222%22%20r%3D%222.5%22%20fill%3D%22%2322c55e%22%20stroke%3D%22%23000000%22%20stroke-width%3D%221%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E") 3 1, pointer !important;
        }

        input[type="text"], input[type="password"], input[type="number"], input[type="email"], textarea, [contenteditable="true"] {
          cursor: text !important;
        }

        [draggable="true"], .drag-handle, .kanban-card, .schedule-block {
          cursor: grab !important;
        }

        [draggable="true"]:active, .drag-handle:active, .kanban-card:active, .schedule-block:active {
          cursor: grabbing !important;
        }
      `;
      (document.head || document.documentElement).appendChild(styleEl);
    }
  }

  if (document.documentElement || document.body) {
    setupHardwareCursor();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupHardwareCursor);
  }
})();
