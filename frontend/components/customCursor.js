/**
 * DELTA ENGINE - MULTI-AGENT SWARM CURSOR & BLUEPRINT INSPECTION ENGINE
 * Inspired by Composio Autonomous Multi-Agent Collaborative Canvas
 * 
 * Features:
 * - 16-24 Autonomous AI Agent Cursors with individual callsigns & palette colors
 * - Dynamic Figma/CAD Inspection wireframe bounding boxes with dimension badges (e.g. 1240 × 529, 360 × 209)
 * - Alignment crosshair guides snapping across layout containers
 * - Floating bottom dock controller with agent pills, layer counter, tour mode, speed toggle
 * - Interactive physics: user mouse avoidance, click-to-inspect swarm attraction
 * - Zero interference: pointer-events: none on all canvas/agent overlays
 */

(function initDeltaAgentSwarm() {
  if (typeof window === 'undefined') return;

  // Configuration & Agent Callsigns
  const AGENT_CONFIGS = [
    { callsign: 'OPS-1', color: '#4285f4', role: 'Operations Commander' },
    { callsign: 'SEC-ALPHA', color: '#ea4335', role: 'Security Perimeter' },
    { callsign: 'SYS-MESH', color: '#00e5ff', role: 'Telemetry Mesh' },
    { callsign: 'RADAR-3', color: '#fbbc05', role: 'Spatial Sonar' },
    { callsign: 'CAD-GEO', color: '#b388ff', role: '2D Geometry Engine' },
    { callsign: 'DISPATCH', color: '#ff4081', role: 'Volunteer Routing' },
    { callsign: 'HEALTH-OK', color: '#00e676', role: 'Life Safety SLA' },
    { callsign: 'EVAC-PATH', color: '#ff5252', role: 'NFPA-101 Pathfinder' },
    { callsign: 'CCTV-OCR', color: '#00b0ff', role: 'Perception Biometrics' },
    { callsign: 'AI-LIAISON', color: '#7c4dff', role: 'Liaison Bridge' },
    { callsign: 'SCHEDULER', color: '#ffd600', role: 'Dynamic Flow' },
    { callsign: 'VOL-NET', color: '#ff6d00', role: 'Mesh Field Radio' },
    { callsign: 'SLA-0.09ms', color: '#1de9b6', role: 'Deterministic Engine' },
    { callsign: 'LOGISTICS', color: '#69f0ae', role: 'Supply & Gates' },
    { callsign: 'ACOUSTIC', color: '#e040fb', role: 'Voice Synthesizer' },
    { callsign: 'AUDIT-LOG', color: '#80d8ff', role: 'Cryptographic Ledger' }
  ];

  let isTouring = false;
  let speedMultiplier = 1;
  let userMouse = { x: -1000, y: -1000, active: false, lastMove: 0 };
  let tourInterval = null;
  let tourIndex = 0;
  let inspectedElements = [];
  let agents = [];
  let canvas, ctx;
  let container, dock;

  // Re-usable SVG cursor arrow
  function createCursorSvg(color) {
    return `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(2px 2px 0px #000000); transform-origin: top left;">
        <path d="M5.5 3.2L18.8 11.5L12.5 13.2L15.8 19.5L13.2 20.8L9.9 14.5L5.5 18.5V3.2Z" fill="${color}" stroke="#000000" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `;
  }

  // Scan layout for notable elements to inspect
  function scanTargetElements() {
    const selectors = [
      'header', '.card', '.stat-box', '.kpi-card', '#cadCanvas', '#cameraFeed',
      '.volunteer-card', '#active-scenario-badge', '.scenario-btn', '.btn',
      'table', 'h1', 'h2', 'h3', '.badge', '#stress-bar', '.quick-actions'
    ];
    const elements = [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 20 && rect.height > 15 && rect.bottom > 0 && rect.top < window.innerHeight * 3) {
          elements.push(el);
        }
      });
    });
    return elements.length > 0 ? elements : [document.body];
  }

  // Find random target coordinates inside or around an element
  function getElementTarget(el) {
    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const padding = 10;
    return {
      x: rect.left + scrollX + Math.random() * Math.max(10, rect.width - padding * 2) + padding,
      y: rect.top + scrollY + Math.random() * Math.max(10, rect.height - padding * 2) + padding,
      element: el,
      rect: rect
    };
  }

  // Setup DOM Overlays and Styles
  function setupDOM() {
    // 1. Inject Styles
    const styleEl = document.createElement('style');
    styleEl.id = 'delta-swarm-styles';
    styleEl.textContent = `
      #delta-swarm-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 999998;
        overflow: hidden;
      }
      #delta-swarm-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .delta-agent-cursor {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform;
        display: flex;
        align-items: flex-start;
        z-index: 999999;
        transition: opacity 0.2s ease;
      }
      .delta-agent-tag {
        margin-left: 10px;
        margin-top: 10px;
        padding: 2px 7px;
        font-family: 'Space Grotesk', 'Courier New', monospace;
        font-size: 10.5px;
        font-weight: 800;
        letter-spacing: 0.5px;
        color: #ffffff;
        background-color: #000000;
        border: 1.5px solid #000000;
        border-radius: 4px;
        box-shadow: 2px 2px 0px rgba(0,0,0,0.85);
        white-space: nowrap;
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .delta-agent-tag .role-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
      }

      /* Composio-Style Floating Bottom Dock */
      #delta-swarm-dock {
        position: fixed;
        bottom: 22px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000000;
        background: rgba(18, 20, 26, 0.94);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 2px solid #000000;
        border-radius: 40px;
        padding: 6px 14px 6px 10px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.35), 4px 4px 0px #000000;
        color: #ffffff;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 13px;
        user-select: none;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #delta-swarm-dock.minimized {
        transform: translateX(-50%) translateY(75px);
        opacity: 0;
        pointer-events: none;
      }
      .dock-avatar-group {
        display: flex;
        align-items: center;
      }
      .dock-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid #12141a;
        margin-right: -8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9.5px;
        font-weight: 900;
        color: #000000;
        box-shadow: 1px 1px 0px rgba(0,0,0,0.4);
      }
      .dock-stat {
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
      }
      .dock-pulse-dot {
        width: 7px;
        height: 7px;
        background: #00e676;
        border-radius: 50%;
        box-shadow: 0 0 8px #00e676;
        animation: dockPulse 1.8s infinite;
      }
      @keyframes dockPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
      .dock-divider {
        width: 1px;
        height: 18px;
        background: rgba(255,255,255,0.2);
      }
      .dock-progress {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #9aa0a6;
      }
      .dock-bar {
        width: 48px;
        height: 4px;
        background: rgba(255,255,255,0.15);
        border-radius: 2px;
        overflow: hidden;
        position: relative;
      }
      .dock-bar-fill {
        height: 100%;
        width: 65%;
        background: #4285f4;
        border-radius: 2px;
        animation: dockBarShift 3s infinite alternate ease-in-out;
      }
      @keyframes dockBarShift {
        0% { width: 30%; background: #4285f4; }
        50% { width: 85%; background: #00e5ff; }
        100% { width: 55%; background: #b388ff; }
      }
      .dock-btn {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.2);
        color: #ffffff;
        border-radius: 20px;
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.15s ease;
      }
      .dock-btn:hover {
        background: rgba(255,255,255,0.2);
        border-color: #ffffff;
        transform: translateY(-1px);
      }
      .dock-btn.active {
        background: #4285f4;
        border-color: #4285f4;
        color: #ffffff;
        box-shadow: 0 0 10px rgba(66, 133, 244, 0.5);
      }
      .dock-close-btn {
        background: none;
        border: none;
        color: #9aa0a6;
        cursor: pointer;
        font-size: 15px;
        padding: 2px 6px;
        border-radius: 50%;
        transition: color 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .dock-close-btn:hover {
        color: #ffffff;
      }
      /* Minimized Trigger Pill */
      #delta-swarm-trigger {
        position: fixed;
        bottom: 18px;
        right: 24px;
        z-index: 1000000;
        background: #12141a;
        color: #ffffff;
        border: 2px solid #000000;
        border-radius: 30px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        display: none;
        align-items: center;
        gap: 6px;
        box-shadow: 3px 3px 0px #000000;
        font-family: 'Space Grotesk', monospace;
      }
      #delta-swarm-trigger:hover {
        background: #4285f4;
      }
    `;
    document.head.appendChild(styleEl);

    // 2. Container and Canvas
    container = document.createElement('div');
    container.id = 'delta-swarm-container';

    canvas = document.createElement('canvas');
    canvas.id = 'delta-swarm-canvas';
    container.appendChild(canvas);
    document.body.appendChild(container);

    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 3. Floating Bottom Dock (Composio Style)
    dock = document.createElement('div');
    dock.id = 'delta-swarm-dock';
    dock.innerHTML = `
      <div class="dock-avatar-group">
        <div class="dock-avatar" style="background:#4285f4; z-index:5;">OP</div>
        <div class="dock-avatar" style="background:#ea4335; z-index:4;">SC</div>
        <div class="dock-avatar" style="background:#00e5ff; z-index:3;">MS</div>
        <div class="dock-avatar" style="background:#ffd600; z-index:2;">AI</div>
      </div>
      <div class="dock-stat">
        <div class="dock-pulse-dot"></div>
        <span>${AGENT_CONFIGS.length} agents</span>
      </div>
      <div class="dock-divider"></div>
      <div class="dock-progress">
        <span>218 / 523 nodes</span>
        <div class="dock-bar"><div class="dock-bar-fill"></div></div>
      </div>
      <div class="dock-divider"></div>
      <button class="dock-btn" id="swarm-tour-btn">
        <span id="swarm-tour-icon">▶</span>
        <span id="swarm-tour-label">Tour</span>
      </button>
      <button class="dock-btn" id="swarm-speed-btn">1x</button>
      <button class="dock-close-btn" id="swarm-close-btn" title="Minimize Swarm">✕</button>
    `;
    document.body.appendChild(dock);

    // Minimized restore button
    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'delta-swarm-trigger';
    triggerBtn.innerHTML = `<span>⚡</span> <span>SWARM (${AGENT_CONFIGS.length})</span>`;
    document.body.appendChild(triggerBtn);

    // Event handlers for dock
    const tourBtn = document.getElementById('swarm-tour-btn');
    const speedBtn = document.getElementById('swarm-speed-btn');
    const closeBtn = document.getElementById('swarm-close-btn');

    tourBtn.addEventListener('click', toggleTour);
    speedBtn.addEventListener('click', toggleSpeed);
    closeBtn.addEventListener('click', () => {
      dock.classList.add('minimized');
      triggerBtn.style.display = 'flex';
    });
    triggerBtn.addEventListener('click', () => {
      dock.classList.remove('minimized');
      triggerBtn.style.display = 'none';
    });

    // Keyboard shortcut (Alt + S) to toggle dock
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        if (dock.classList.contains('minimized')) {
          dock.classList.remove('minimized');
          triggerBtn.style.display = 'none';
        } else {
          dock.classList.add('minimized');
          triggerBtn.style.display = 'flex';
        }
      }
    });
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // Initialize Agents
  function initAgents() {
    inspectedElements = scanTargetElements();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    agents = AGENT_CONFIGS.map((cfg, index) => {
      // Pick initial target element
      const targetEl = inspectedElements[index % inspectedElements.length];
      const target = getElementTarget(targetEl);

      const el = document.createElement('div');
      el.className = 'delta-agent-cursor';
      el.innerHTML = `
        ${createCursorSvg(cfg.color)}
        <div class="delta-agent-tag" style="border-left: 3px solid ${cfg.color};">
          <span class="role-dot" style="background:${cfg.color};"></span>
          <span>${cfg.callsign}</span>
        </div>
      `;
      container.appendChild(el);

      return {
        id: index,
        callsign: cfg.callsign,
        color: cfg.color,
        role: cfg.role,
        domElement: el,
        x: target.x - scrollX + (Math.random() - 0.5) * 200,
        y: target.y - scrollY + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
        targetX: target.x - scrollX,
        targetY: target.y - scrollY,
        targetElement: targetEl,
        state: 'inspecting',
        dwellTimer: Math.random() * 180 + 90, // frames to dwell
        typingTimer: 0,
        isTyping: false,
        pulsePhase: Math.random() * Math.PI * 2
      };
    });
  }

  // Autopilot Tour Toggle
  function toggleTour() {
    isTouring = !isTouring;
    const tourBtn = document.getElementById('swarm-tour-btn');
    const tourIcon = document.getElementById('swarm-tour-icon');
    const tourLabel = document.getElementById('swarm-tour-label');

    if (isTouring) {
      tourBtn.classList.add('active');
      tourIcon.textContent = '⏸';
      tourLabel.textContent = 'Touring';
      startTour();
    } else {
      tourBtn.classList.remove('active');
      tourIcon.textContent = '▶';
      tourLabel.textContent = 'Tour';
      stopTour();
    }
  }

  function startTour() {
    stopTour();
    const tourSections = [
      '#active-scenario-badge',
      '#cadCanvas',
      '#cameraFeed',
      '.volunteer-card',
      '#card-stress-testing',
      'table'
    ];
    let validSections = [];
    tourSections.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) validSections.push(el);
    });
    if (validSections.length === 0) validSections = inspectedElements;

    tourIndex = 0;
    function nextTourStep() {
      if (!isTouring) return;
      const targetSec = validSections[tourIndex % validSections.length];
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Direct 6 agents to this target
        for (let i = 0; i < 6; i++) {
          const a = agents[i % agents.length];
          const t = getElementTarget(targetSec);
          a.targetX = t.x - (window.scrollX || window.pageXOffset);
          a.targetY = t.y - (window.scrollY || window.pageYOffset);
          a.targetElement = targetSec;
          a.dwellTimer = 220;
        }
      }
      tourIndex++;
      tourInterval = setTimeout(nextTourStep, 4500 / speedMultiplier);
    }
    nextTourStep();
  }

  function stopTour() {
    if (tourInterval) {
      clearTimeout(tourInterval);
      tourInterval = null;
    }
  }

  // Speed Toggle
  function toggleSpeed() {
    const speedBtn = document.getElementById('swarm-speed-btn');
    if (speedMultiplier === 1) {
      speedMultiplier = 2;
      speedBtn.textContent = '2x';
      speedBtn.style.color = '#00e5ff';
    } else {
      speedMultiplier = 1;
      speedBtn.textContent = '1x';
      speedBtn.style.color = '#ffffff';
    }
  }

  // User Mouse Interaction Listeners
  window.addEventListener('mousemove', (e) => {
    userMouse.x = e.clientX;
    userMouse.y = e.clientY;
    userMouse.active = true;
    userMouse.lastMove = Date.now();
  }, { passive: true });

  window.addEventListener('mouseleave', () => {
    userMouse.active = false;
  });

  // When user clicks anywhere, dispatch 3 nearby agents to inspect that clicked element!
  window.addEventListener('click', (e) => {
    const clickedEl = document.elementFromPoint(e.clientX, e.clientY);
    if (!clickedEl || clickedEl.closest('#delta-swarm-dock') || clickedEl.closest('#delta-swarm-trigger')) return;

    // Pick 3 agents closest to the click
    const sorted = [...agents].sort((a, b) => {
      const distA = Math.hypot(a.x - e.clientX, a.y - e.clientY);
      const distB = Math.hypot(b.x - e.clientX, b.y - e.clientY);
      return distA - distB;
    });

    for (let i = 0; i < Math.min(3, sorted.length); i++) {
      const a = sorted[i];
      a.targetX = e.clientX + (i - 1) * 35;
      a.targetY = e.clientY + (i - 1) * 25;
      a.targetElement = clickedEl;
      a.dwellTimer = 240; // Dwell on inspected element
    }
  }, { passive: true });

  // Main 60FPS Physics and Render Loop
  function animateSwarm() {
    if (!ctx || !canvas) {
      requestAnimationFrame(animateSwarm);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const now = Date.now();
    const isMouseRecent = userMouse.active && (now - userMouse.lastMove < 2500);

    // Track active inspected elements to draw shared Figma bounding boxes
    const activeBoxes = new Map();

    agents.forEach((agent) => {
      // 1. Behavior State Machine
      agent.dwellTimer -= 1 * speedMultiplier;
      agent.pulsePhase += 0.05 * speedMultiplier;

      if (agent.dwellTimer <= 0) {
        // Pick new random target element
        if (inspectedElements.length === 0) inspectedElements = scanTargetElements();
        const randEl = inspectedElements[Math.floor(Math.random() * inspectedElements.length)];
        const target = getElementTarget(randEl);
        agent.targetX = target.x - scrollX;
        agent.targetY = target.y - scrollY;
        agent.targetElement = randEl;
        agent.dwellTimer = Math.floor((Math.random() * 180 + 120) / speedMultiplier);
      } else if (agent.targetElement) {
        // Keep target anchored to element during scrolling
        const rect = agent.targetElement.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          // If element is in viewport, group it for Figma wireframe rendering
          if (!activeBoxes.has(agent.targetElement)) {
            activeBoxes.set(agent.targetElement, {
              rect: rect,
              color: agent.color,
              agent: agent
            });
          }
        }
      }

      // 2. Spring Physics towards Target
      const dx = agent.targetX - agent.x;
      const dy = agent.targetY - agent.y;
      const dist = Math.hypot(dx, dy);

      const spring = (dist > 300 ? 0.08 : 0.04) * speedMultiplier;
      const friction = 0.82;

      agent.vx += dx * spring;
      agent.vy += dy * spring;

      // 3. User Mouse Avoidance (Steer away if near user's real cursor)
      if (isMouseRecent) {
        const mdx = agent.x - userMouse.x;
        const mdy = agent.y - userMouse.y;
        const mDist = Math.hypot(mdx, mdy);
        if (mDist < 120 && mDist > 0) {
          const repelForce = ((120 - mDist) / 120) * 8 * speedMultiplier;
          agent.vx += (mdx / mDist) * repelForce;
          agent.vy += (mdy / mDist) * repelForce;
        }
      }

      // Apply velocity
      agent.vx *= friction;
      agent.vy *= friction;
      agent.x += agent.vx;
      agent.y += agent.vy;

      // Keep within screen boundaries with soft bounce
      if (agent.x < 10) { agent.x = 10; agent.vx *= -0.5; }
      if (agent.x > canvas.width - 20) { agent.x = canvas.width - 20; agent.vx *= -0.5; }
      if (agent.y < 10) { agent.y = 10; agent.vy *= -0.5; }
      if (agent.y > canvas.height - 20) { agent.y = canvas.height - 20; agent.vy *= -0.5; }

      // Update DOM Cursor Transform
      agent.domElement.style.transform = `translate3d(${Math.round(agent.x)}px, ${Math.round(agent.y)}px, 0)`;
    });

    // 4. Draw Figma-Style Bounding Boxes & Dimension Badges on Canvas (Composio Effect)
    activeBoxes.forEach((data) => {
      const rect = data.rect;
      // Only draw if within viewport bounds
      if (rect.right < 0 || rect.left > canvas.width || rect.bottom < 0 || rect.top > canvas.height) return;

      const bx = Math.round(rect.left);
      const by = Math.round(rect.top);
      const bw = Math.round(rect.width);
      const bh = Math.round(rect.height);
      const color = data.color;

      ctx.save();

      // Bounding Box Border (Figma Blue / Agent Accent)
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(bx, by, bw, bh);

      // Alignment Guide Crosshairs (faint red/cyan guidelines extending across canvas)
      ctx.strokeStyle = 'rgba(66, 133, 244, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      // Vertical guideline
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, canvas.height);
      ctx.stroke();

      // Horizontal guideline
      ctx.beginPath();
      ctx.moveTo(0, by + bh);
      ctx.lineTo(canvas.width, by + bh);
      ctx.stroke();

      // 8 Resize Handles (4 Corners + 4 Midpoints)
      const handleSize = 5;
      const handles = [
        { x: bx, y: by }, // top-left
        { x: bx + bw / 2, y: by }, // top-mid
        { x: bx + bw, y: by }, // top-right
        { x: bx + bw, y: by + bh / 2 }, // mid-right
        { x: bx + bw, y: by + bh }, // bot-right
        { x: bx + bw / 2, y: by + bh }, // bot-mid
        { x: bx, y: by + bh }, // bot-left
        { x: bx, y: by + bh / 2 } // mid-left
      ];

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([]);
      handles.forEach(h => {
        ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      });

      // Dimension Badge (e.g. "446 × 21" or "360 × 209" as seen in Composio demo)
      const dimText = `${bw} × ${bh}`;
      ctx.font = 'bold 10px "Space Grotesk", monospace';
      const textMetrics = ctx.measureText(dimText);
      const badgeWidth = textMetrics.width + 12;
      const badgeHeight = 18;
      const badgeX = bx + bw / 2 - badgeWidth / 2;
      const badgeY = by + bh + 4; // Below the box

      // Badge pill background
      ctx.fillStyle = color;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
      } else {
        ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
      }
      ctx.fill();

      // Badge text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dimText, bx + bw / 2, badgeY + badgeHeight / 2);

      ctx.restore();
    });

    requestAnimationFrame(animateSwarm);
  }

  // Boot on Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupDOM();
      initAgents();
      requestAnimationFrame(animateSwarm);
    });
  } else {
    setupDOM();
    initAgents();
    requestAnimationFrame(animateSwarm);
  }
})();
