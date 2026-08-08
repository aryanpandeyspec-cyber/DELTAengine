// --- 2D FLAT LEFT-TILTED ELECTRIC BLUE TRIPOINT CURSOR WITH AUTO-FADING COMET TAIL ---

(function initCustomCursor() {
  window.addEventListener('DOMContentLoaded', () => {
    // Hide default browser cursor
    document.body.style.cursor = 'none';

    // 1. Create Meteor Trail Canvas Overlay
    const canvas = document.createElement('canvas');
    canvas.id = 'cursor-comet-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999997';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Clear trail immediately on window scroll so line doesn't persist across scroll frames
    window.addEventListener('scroll', () => {
      points.length = 0;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, { passive: true });

    // 2. Create Tripoint Inversus Electric Blue Cursor Element (Slightly Smaller 24px)
    const cursor = document.createElement('div');
    cursor.id = 'custom-tripoint-cursor';
    cursor.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 40 40">
        <!-- 2D Flat Tripoint Inverted Triangle (Electric Google Blue - Tilted -45° Left) -->
        <polygon points="20,2 38,36 20,26 2,36" fill="#4285f4" stroke="#000000" stroke-width="3.5" stroke-linejoin="round" />
        <!-- 2D Inner Core Accent (Light Blue Highlight) -->
        <polygon points="20,8 31,31 20,23 9,31" fill="#8ab4f8" opacity="0.95" />
      </svg>
    `;
    document.body.appendChild(cursor);

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;
    let lastMoveTime = Date.now();

    // Meteor Trail Point History Buffer
    const points = [];
    const MAX_POINTS = 10; // Sleek comet tail length

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      lastMoveTime = Date.now();

      // Append point to meteor tail buffer
      points.push({ x: mouseX, y: mouseY });
      if (points.length > MAX_POINTS) points.shift();
    });

    // 60FPS High-Performance Render Loop
    function animateCursor() {
      // Hyper-fast direct tracking (0ms lag)
      cursorX += (mouseX - cursorX) * 0.88;
      cursorY += (mouseY - cursorY) * 0.88;

      // Static 2D Flat -45° tilt facing left (Offset by -12px for 24px cursor center)
      cursor.style.transform = `translate3d(${cursorX - 12}px, ${cursorY - 12}px, 0) rotate(-45deg)`;

      // If mouse hasn't moved for 120ms, rapidly clear trail points so trail disappears completely
      if (Date.now() - lastMoveTime > 120 && points.length > 0) {
        points.shift();
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Sleek Electric Blue Comet Tail
      if (points.length > 1) {
        for (let i = 0; i < points.length - 1; i++) {
          const pt1 = points[i];
          const pt2 = points[i + 1];
          const ratio = i / points.length;

          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);

          // Meteor tail tapering width and electric blue glowing gradient
          ctx.lineWidth = ratio * 4.5 + 1; // Tapers smoothly from 1px to 5.5px at cursor head
          ctx.strokeStyle = `rgba(66, 133, 244, ${ratio * 0.55})`; // Vibrant subtle blue glow
          ctx.lineCap = 'round';
          ctx.shadowBlur = ratio * 6;
          ctx.shadowColor = '#4285f4';
          ctx.stroke();
        }
      }

      requestAnimationFrame(animateCursor);
    }

    requestAnimationFrame(animateCursor);
  });
})();
