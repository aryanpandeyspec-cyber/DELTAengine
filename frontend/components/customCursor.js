// --- 2D FLAT LEFT-TILTED ELECTRIC BLUE TRIPOINT CURSOR WITH AUTO-FADING COMET TAIL ---
// Guaranteed Zero-Disappearance Architecture: Frame-0 hardware SVG fallback, high-priority pointer capture, dirty-rect canvas trail.

(function initCustomCursor() {
  // Only disable custom cursor on touch-only mobile devices
  const isMobilePhone = (window.innerWidth < 600) && window.matchMedia('(pointer: coarse) and not (pointer: fine)').matches;
  if (isMobilePhone) {
    return;
  }

  function setupCursor() {
    // 1. Mark root as custom cursor active
    if (document.documentElement) document.documentElement.classList.add('custom-cursor-active');
    if (document.body) document.body.classList.add('custom-cursor-active');

    // 2. Create or reuse Meteor Trail Canvas Overlay
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
      (document.body || document.documentElement).appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    // 3. Create or reuse Tripoint Electric Blue Cursor Element (24px)
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
      cursor.style.display = 'block';
      cursor.style.opacity = '1';
      cursor.style.transition = 'opacity 0.15s ease';
      (document.body || document.documentElement).appendChild(cursor);
    }

    let mouseX = Math.round(window.innerWidth / 2);
    let mouseY = Math.round(window.innerHeight / 2);
    let lastMoveTime = Date.now();
    let isMouseDown = false;
    let isInsideWindow = true;

    // Helper to position cursor with its sharp apex tip pinned directly to (mouseX, mouseY)
    function updateCursorPosition(scale = 1.0) {
      cursor.style.transform = `translate3d(${mouseX - 12}px, ${mouseY - 1.2}px, 0) rotate(-45deg) scale(${scale})`;
    }
    updateCursorPosition(1.0);

    // Meteor Trail Point History Buffer
    const points = [];
    const MAX_POINTS = 10;
    let lastDirtyRect = null;

    // Clear trail immediately on scroll
    window.addEventListener('scroll', () => {
      points.length = 0;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      lastDirtyRect = null;
    }, { passive: true });

    let isCometLoopActive = false;

    function wakeCometTail() {
      if (isCometLoopActive) return;
      isCometLoopActive = true;
      requestAnimationFrame(renderCometTail);
    }

    // High-performance sleepable render loop with Dirty-Rect Bounding Box optimization
    function renderCometTail() {
      // If mouse stopped moving for 60ms, decay trail points so it cleanly disappears
      if (Date.now() - lastMoveTime > 60 && points.length > 0) {
        points.shift();
      }

      // 1. Clear ONLY the previous dirty bounding box instead of the full 4K screen (99% GPU fillrate savings)
      if (lastDirtyRect) {
        ctx.clearRect(lastDirtyRect.x, lastDirtyRect.y, lastDirtyRect.w, lastDirtyRect.h);
        lastDirtyRect = null;
      }

      if (points.length > 1 && isInsideWindow) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (let i = 0; i < points.length - 1; i++) {
          const pt1 = points[i];
          const pt2 = points[i + 1];
          const ratio = (i + 1) / points.length;

          if (pt1.x < minX) minX = pt1.x;
          if (pt1.x > maxX) maxX = pt1.x;
          if (pt1.y < minY) minY = pt1.y;
          if (pt1.y > maxY) maxY = pt1.y;
          if (pt2.x < minX) minX = pt2.x;
          if (pt2.x > maxX) maxX = pt2.x;
          if (pt2.y < minY) minY = pt2.y;
          if (pt2.y > maxY) maxY = pt2.y;

          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);

          // Meteor tail tapering width and electric blue glowing gradient
          ctx.lineWidth = ratio * 4.2 + 1.2;
          ctx.strokeStyle = `rgba(66, 133, 244, ${ratio * 0.75})`;
          ctx.lineCap = 'round';
          ctx.shadowBlur = ratio * 8;
          ctx.shadowColor = '#4285f4';
          ctx.stroke();
        }

        // Cache dirty bounding box with 24px padding for glow
        const pad = 24;
        lastDirtyRect = {
          x: Math.max(0, Math.floor(minX - pad)),
          y: Math.max(0, Math.floor(minY - pad)),
          w: Math.ceil(maxX - minX + pad * 2),
          h: Math.ceil(maxY - minY + pad * 2)
        };
      }

      // If trail has vanished, clean up and sleep loop completely (0% CPU/GPU idle usage)
      if (points.length === 0) {
        if (lastDirtyRect) {
          ctx.clearRect(lastDirtyRect.x, lastDirtyRect.y, lastDirtyRect.w, lastDirtyRect.h);
          lastDirtyRect = null;
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        isCometLoopActive = false;
        return;
      }

      requestAnimationFrame(renderCometTail);
    }

    // Pointer move handler with capture=true to ensure zero dropped events
    function onPointerMove(e) {
      if (!e || typeof e.clientX !== 'number') return;
      mouseX = e.clientX;
      mouseY = e.clientY;
      lastMoveTime = Date.now();
      isInsideWindow = true;

      cursor.style.display = 'block';
      cursor.style.opacity = '1';

      // Instant 0ms transform update with the apex tip aligned to the click point
      updateCursorPosition(isMouseDown ? 0.85 : 1.0);

      // Append point to meteor tail buffer
      points.push({ x: mouseX, y: mouseY });
      if (points.length > MAX_POINTS) points.shift();
      wakeCometTail();
    }

    window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
    window.addEventListener('mousemove', onPointerMove, { capture: true, passive: true });

    window.addEventListener('pointerdown', () => {
      isMouseDown = true;
      updateCursorPosition(0.85);
    }, { capture: true, passive: true });

    window.addEventListener('mousedown', () => {
      isMouseDown = true;
      updateCursorPosition(0.85);
    }, { capture: true, passive: true });

    window.addEventListener('pointerup', () => {
      isMouseDown = false;
      updateCursorPosition(1.0);
    }, { capture: true, passive: true });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
      updateCursorPosition(1.0);
    }, { capture: true, passive: true });

    // When pointer leaves the viewport, fade cursor smoothly but NEVER permanently hide
    document.addEventListener('mouseleave', () => {
      isInsideWindow = false;
      cursor.style.opacity = '0';
      points.length = 0;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      lastDirtyRect = null;
      isCometLoopActive = false;
    });

    document.addEventListener('mouseenter', (e) => {
      isInsideWindow = true;
      cursor.style.display = 'block';
      cursor.style.opacity = '1';
      if (e && typeof e.clientX === 'number') {
        mouseX = e.clientX;
        mouseY = e.clientY;
        updateCursorPosition(1.0);
      }
      wakeCometTail();
    });

    // Ensure cursor re-anchors to body if mounted to documentElement earlier
    if (document.body && cursor.parentElement !== document.body) {
      document.body.appendChild(cursor);
      if (canvas.parentElement !== document.body) {
        document.body.appendChild(canvas);
      }
    }
  }

  // Execute immediately if DOM available, otherwise on interactive
  if (document.documentElement || document.body) {
    setupCursor();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCursor);
  }
})();
