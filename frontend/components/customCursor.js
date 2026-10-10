// --- 2D FLAT LEFT-TILTED ELECTRIC BLUE TRIPOINT CURSOR WITH AUTO-FADING COMET TAIL ---
// Zero-lag 60fps tracking, precision tip hotspot, and smooth electric comet trail.

(function initCustomCursor() {
  // Only disable custom cursor on small mobile phones to preserve pure touch UI
  const isMobilePhone = (window.innerWidth < 600) && window.matchMedia('(pointer: coarse) and not (pointer: fine)').matches;
  if (isMobilePhone) {
    return;
  }

  function setupCursor() {
    // 0. Inject Global Absolute Cursor Killer Stylesheet to eliminate native hand/finger pointer leaks everywhere
    let styleEl = document.getElementById('custom-cursor-global-override');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'custom-cursor-global-override';
      styleEl.textContent = `
        *, *::before, *::after,
        html, body, :root,
        html body *, html body *:hover, html body *:active, html body *:focus,
        html body [class], html body [class]:hover,
        html body [id], html body [id]:hover,
        a, a:hover, button, button:hover, input, select, textarea, label, div, span, p,
        svg, svg *, circle, path, polygon, rect, line,
        table, tr, td, th, section, header, footer, nav, aside, main, ul, li,
        .drag-zone, .drag-zone *, .card, .dash-card, .btn, .btn:hover,
        [role="button"], [style*="cursor"], :hover, :active, :focus {
          cursor: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(styleEl);

      // Force inline style on root elements
      if (document.documentElement) document.documentElement.style.setProperty('cursor', 'none', 'important');
      if (document.body) document.body.style.setProperty('cursor', 'none', 'important');
    }

    // 1. Create Meteor Trail Canvas Overlay
    let canvas = document.getElementById('cursor-comet-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'cursor-comet-canvas';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '99999997';
      document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    // 2. Create Tripoint Electric Blue Cursor Element (24px)
    let cursor = document.getElementById('custom-tripoint-cursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = 'custom-tripoint-cursor';
      cursor.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 40 40" style="display:block; overflow:visible;">
          <!-- 2D Flat Tripoint Inverted Triangle (Electric Google Blue - Tilted -45° Left) -->
          <polygon points="20,2 38,36 20,26 2,36" fill="#4285f4" stroke="#000000" stroke-width="3.5" stroke-linejoin="round" />
          <!-- 2D Inner Core Accent (Light Blue Highlight) -->
          <polygon points="20,8 31,31 20,23 9,31" fill="#8ab4f8" opacity="0.95" />
        </svg>
      `;
      cursor.style.position = 'fixed';
      cursor.style.top = '0';
      cursor.style.left = '0';
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '99999999';
      cursor.style.willChange = 'transform';
      cursor.style.filter = 'drop-shadow(2px 3px 0px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 8px rgba(66, 133, 244, 0.65))';
      cursor.style.transformOrigin = '12px 1.2px';
      document.body.appendChild(cursor);
    }

    let mouseX = -100;
    let mouseY = -100;
    let lastMoveTime = Date.now();
    let isMouseDown = false;
    let isInsideWindow = false;

    // Helper to position cursor with its sharp apex tip pinned directly to (mouseX, mouseY)
    function updateCursorPosition(scale = 1.0) {
      cursor.style.transform = `translate3d(${mouseX - 12}px, ${mouseY - 1.2}px, 0) rotate(-45deg) scale(${scale})`;
    }

    // Meteor Trail Point History Buffer
    const points = [];
    const MAX_POINTS = 12;

    // Clear trail immediately on scroll
    window.addEventListener('scroll', () => {
      points.length = 0;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, { passive: true });

    // Zero-lag instant position update on direct mousemove
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      lastMoveTime = Date.now();
      isInsideWindow = true;

      cursor.style.display = 'block';

      // Instant 0ms transform update with the apex tip aligned to the click point
      updateCursorPosition(isMouseDown ? 0.85 : 1.0);

      // Append point to meteor tail buffer
      points.push({ x: mouseX, y: mouseY });
      if (points.length > MAX_POINTS) points.shift();
      wakeCometTail();
    }, { passive: true });

    window.addEventListener('mousedown', () => {
      isMouseDown = true;
      if (isInsideWindow) {
        updateCursorPosition(0.85);
      }
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
      if (isInsideWindow) {
        updateCursorPosition(1.0);
      }
    });

    document.addEventListener('mouseleave', () => {
      isInsideWindow = false;
      cursor.style.display = 'none';
      points.length = 0;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      isCometLoopActive = false;
    });

    document.addEventListener('mouseenter', (e) => {
      isInsideWindow = true;
      cursor.style.display = 'block';
      mouseX = e.clientX;
      mouseY = e.clientY;
      updateCursorPosition(1.0);
      wakeCometTail();
    });

    let isCometLoopActive = false;

    function wakeCometTail() {
      if (isCometLoopActive) return;
      isCometLoopActive = true;
      requestAnimationFrame(renderCometTail);
    }

    // High-performance sleepable render loop for the comet tail
    function renderCometTail() {
      // If mouse stopped moving for 80ms, decay trail points so it cleanly disappears
      if (Date.now() - lastMoveTime > 80 && points.length > 0) {
        points.shift();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (points.length > 1 && isInsideWindow) {
        for (let i = 0; i < points.length - 1; i++) {
          const pt1 = points[i];
          const pt2 = points[i + 1];
          const ratio = (i + 1) / points.length;

          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);

          // Meteor tail tapering width and electric blue glowing gradient
          ctx.lineWidth = ratio * 4.5 + 1.2;
          ctx.strokeStyle = `rgba(66, 133, 244, ${ratio * 0.65})`;
          ctx.lineCap = 'round';
          ctx.shadowBlur = ratio * 7;
          ctx.shadowColor = '#4285f4';
          ctx.stroke();
        }
      }

      // If trail has vanished, sleep loop completely (0% CPU/GPU idle usage)
      if (points.length === 0) {
        isCometLoopActive = false;
        return;
      }

      requestAnimationFrame(renderCometTail);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCursor);
  } else {
    setupCursor();
  }
})();
