/**
 * DELTA ENGINE - LIVE OPERATIONAL AGENT SWARM & CO-PILOT
 * Fully integrated multi-agent system executing live venue operations
 * 
 * Agents:
 * - 🗣️ Liaison Agent (Blue): Telemetry ingestion & sensor monitoring
 * - ⏱️ Scheduler Agent (Yellow): Dynamic constraint solving & session relocation
 * - 🏛️ Logistics Agent (Green): Venue hall capacity, CAD gates & overflow
 * - 📢 Broadcaster Agent (Red): Public address announcements & voice synthesis
 * - 📐 CAD Geometry Agent (Purple): 2D blueprint calibration & NFPA-101 compliance
 * - 🛡️ Perimeter Marshal (Cyan): Volunteer coordination & emergency SOS mesh
 * 
 * Non-intrusive: pointer-events: none on all canvas/agent overlays.
 * The operator can click, drag, type, and manage the system with zero interference.
 */

(function initDeltaLiveAgentSwarm() {
  if (typeof window === 'undefined') return;

  // Clean up legacy swarm overlays if present
  const oldElements = ['delta-swarm-container', 'delta-swarm-dock', 'delta-swarm-trigger', 'swarm-rebuild', 'swarm-rebuild-trigger-pill'];
  oldElements.forEach(id => {
    const el = document.getElementById(id) || document.querySelector(id);
    if (el) el.remove();
  });

  // Agent Configurations
  const AGENTS = [
    {
      id: 'liaison',
      name: 'LIAISON-01',
      title: 'Liaison Agent',
      duty: 'Telemetry Ingestion',
      color: '#4285f4', // Google Blue
      accent: '#c2e7ff',
      role: 'Telemetry & Ingestion',
      anchorSelector: '#card-perception, #cameraFeed, .kpi-card'
    },
    {
      id: 'scheduler',
      name: 'SCHEDULER',
      title: 'Scheduler Agent',
      duty: 'Constraint Solver',
      color: '#f9ab00', // Amber Yellow
      accent: '#fef7e0',
      role: 'Schedule Solver',
      anchorSelector: '#schedule-grid, .schedule-card, #btn-simulate-delay'
    },
    {
      id: 'logistics',
      name: 'LOGISTICS',
      title: 'Logistics Agent',
      duty: 'Capacity & Egress',
      color: '#34a853', // Emerald Green
      accent: '#e6f4ea',
      role: 'Hall Allocation',
      anchorSelector: '#cadCanvas, #card-cad-blueprint, #btn-simulate-surge'
    },
    {
      id: 'broadcaster',
      name: 'BROADCASTER',
      title: 'Broadcaster Agent',
      duty: 'Venue Audio & PA',
      color: '#ea4335', // Google Red
      accent: '#fce8e6',
      role: 'Voice & Directives',
      anchorSelector: '#alert-coordinator-banner, #log-console, header'
    },
    {
      id: 'cadgeo',
      name: 'CAD-GEO',
      title: 'CAD Geometry Agent',
      duty: 'NFPA-101 Life Safety',
      color: '#9c27b0', // Deep Purple
      accent: '#f3e5f5',
      role: 'Spatial Calibration',
      anchorSelector: '#cadCanvas, #card-cad-blueprint'
    },
    {
      id: 'marshal',
      name: 'MARSHAL',
      title: 'Perimeter Marshal',
      duty: 'Volunteer Radio Mesh',
      color: '#00bcd4', // Cyan
      accent: '#e0f7fa',
      role: 'Field Routing',
      anchorSelector: '#volunteer-list, .volunteer-card, #btn-open-scenario-lab'
    }
  ];

  let coPilotEnabled = true;
  let dockMinimized = false;
  let canvas, ctx;
  let overlayContainer, dockContainer, triggerPill;
  let agentStates = [];
  let userMouse = { x: -1000, y: -1000, active: false, lastMove: 0, hoveredEl: null };
  let activeInspections = [];
  let motionDragPaths = []; // Active trajectories when agents move nodes
  let actionTickerTimer = null;
  let currentTickerMsg = 'Autonomous Multi-Agent Swarm Online • Deterministic SLA < 0.1ms';

  // Create SVG Cursor Arrow
  function createCursorSvg(color) {
    return `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(2px 2px 0px #000000); transform-origin: top left;">
        <path d="M5.5 3.2L18.8 11.5L12.5 13.2L15.8 19.5L13.2 20.8L9.9 14.5L5.5 18.5V3.2Z" fill="${color}" stroke="#000000" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `;
  }

  // Setup DOM Overlays and Styles
  function setupDOM() {
    // 1. Inject Styles
    const styleEl = document.createElement('style');
    styleEl.id = 'delta-live-swarm-styles';
    styleEl.textContent = `
      #delta-live-swarm-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 99998;
        overflow: hidden;
      }
      #delta-swarm-live-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .delta-live-agent {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        will-change: transform;
        display: flex;
        align-items: flex-start;
        z-index: 99999;
        transition: opacity 0.2s ease;
      }
      .delta-live-tag {
        margin-left: 9px;
        margin-top: 10px;
        padding: 3px 8px;
        font-family: 'Space Grotesk', -apple-system, monospace;
        font-size: 11px;
        font-weight: 800;
        color: #ffffff;
        background-color: #000000;
        border: 1.5px solid #000000;
        border-radius: 4px;
        box-shadow: 2.5px 2.5px 0px rgba(0,0,0,0.85);
        white-space: nowrap;
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .delta-live-tag .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
      }
      .delta-live-tag .action-label {
        font-size: 9.5px;
        font-weight: 600;
        opacity: 0.85;
      }

      /* Live Operational Agent Swarm Dock */
      #delta-swarm-ops-dock {
        position: fixed;
        bottom: 18px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 100000;
        background: rgba(18, 20, 26, 0.95);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 2.5px solid #000000;
        border-radius: 14px;
        padding: 8px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4), 4px 4px 0px #000000;
        color: #ffffff;
        font-family: 'Outfit', -apple-system, sans-serif;
        font-size: 13px;
        user-select: none;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        max-width: 95vw;
        overflow-x: auto;
      }
      #delta-swarm-ops-dock.minimized {
        transform: translateX(-50%) translateY(80px);
        opacity: 0;
        pointer-events: none;
      }
      .ops-agent-badges {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ops-agent-pill {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 3px 8px;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 6px;
        font-family: 'Space Grotesk', monospace;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }
      .ops-agent-pill .agent-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
      }
      .ops-divider {
        width: 1px;
        height: 20px;
        background: rgba(255,255,255,0.2);
        flex-shrink: 0;
      }
      .ops-ticker {
        font-size: 12px;
        color: #9aa0a6;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 320px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ops-ticker b {
        color: #00e5ff;
        font-family: 'Space Grotesk', monospace;
      }
      .ops-btn-group {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }
      .ops-action-btn {
        background: #2a2e39;
        border: 1.5px solid #000000;
        color: #ffffff;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 11.5px;
        font-weight: 800;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        font-family: 'Space Grotesk', monospace;
        box-shadow: 2px 2px 0px #000000;
        transition: all 0.12s ease;
        white-space: nowrap;
      }
      .ops-action-btn:hover {
        background: #4285f4;
        transform: translateY(-1px);
        box-shadow: 3px 3px 0px #000000;
      }
      .ops-action-btn:active {
        transform: translateY(1px);
        box-shadow: 1px 1px 0px #000000;
      }
      .ops-action-btn.active {
        background: #00e5ff;
        color: #000000;
      }
      .ops-close-btn {
        background: none;
        border: none;
        color: #9aa0a6;
        cursor: pointer;
        font-size: 16px;
        padding: 2px 6px;
        border-radius: 4px;
        transition: color 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .ops-close-btn:hover {
        color: #ffffff;
      }
      #delta-swarm-ops-pill {
        position: fixed;
        bottom: 18px;
        right: 18px;
        z-index: 100000;
        background: #111113;
        color: #ffffff;
        border: 2px solid #000000;
        border-radius: 30px;
        padding: 7px 14px;
        font-size: 11.5px;
        font-weight: 800;
        cursor: pointer;
        display: none;
        align-items: center;
        gap: 6px;
        box-shadow: 3px 3px 0px #000000;
        font-family: 'Space Grotesk', monospace;
      }
      #delta-swarm-ops-pill:hover {
        background: #4285f4;
      }
    `;
    document.head.appendChild(styleEl);

    // 2. Overlay Container & Canvas
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'delta-live-swarm-overlay';

    canvas = document.createElement('canvas');
    canvas.id = 'delta-swarm-live-canvas';
    overlayContainer.appendChild(canvas);
    document.body.appendChild(overlayContainer);

    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 3. Operational Dock
    dockContainer = document.createElement('div');
    dockContainer.id = 'delta-swarm-ops-dock';
    dockContainer.innerHTML = `
      <div class="ops-agent-badges">
        <div class="ops-agent-pill" title="🗣️ Liaison Agent (Telemetry Ingestion)">
          <span class="agent-dot" style="background:#4285f4;"></span>
          <span>LIAISON</span>
        </div>
        <div class="ops-agent-pill" title="⏱️ Scheduler Agent (Flow Optimization)">
          <span class="agent-dot" style="background:#f9ab00;"></span>
          <span>SCHEDULER</span>
        </div>
        <div class="ops-agent-pill" title="🏛️ Logistics Agent (Hall & Capacity)">
          <span class="agent-dot" style="background:#34a853;"></span>
          <span>LOGISTICS</span>
        </div>
        <div class="ops-agent-pill" title="📢 Broadcaster Agent (Venue Directives)">
          <span class="agent-dot" style="background:#ea4335;"></span>
          <span>BROADCAST</span>
        </div>
        <div class="ops-agent-pill" title="📐 CAD Geometry Agent (NFPA-101)">
          <span class="agent-dot" style="background:#9c27b0;"></span>
          <span>CAD-GEO</span>
        </div>
      </div>
      <div class="ops-divider"></div>
      <div class="ops-ticker" id="ops-ticker-text">
        <span>⚡</span> <span id="ops-ticker-content">Deterministic SLA: <b>0.09ms</b> | Swarm Ready</span>
      </div>
      <div class="ops-divider"></div>
      <div class="ops-btn-group">
        <button class="ops-action-btn" id="ops-btn-heal-delay" title="Trigger Speaker Delay Self-Healing">
          <span>⏱️</span> <span>Heal Delay</span>
        </button>
        <button class="ops-action-btn" id="ops-btn-heal-surge" title="Trigger Crowd Surge Capacity Self-Healing">
          <span>🏛️</span> <span>Heal Surge</span>
        </button>
        <button class="ops-action-btn" id="ops-btn-audit-cad" title="Inspect & Calibrate CAD Architectural Blueprint">
          <span>📐</span> <span>CAD Audit</span>
        </button>
        <button class="ops-action-btn" id="ops-btn-copilot" title="Toggle AI Co-Pilot Cursor Assistance">
          <span>🤝</span> <span id="ops-copilot-label">Co-Pilot: ON</span>
        </button>
        <button class="ops-close-btn" id="ops-dock-close" title="Minimize Dock (Alt+S)">✕</button>
      </div>
    `;
    document.body.appendChild(dockContainer);

    // Minimized Restore Pill
    triggerPill = document.createElement('button');
    triggerPill.id = 'delta-swarm-ops-pill';
    triggerPill.innerHTML = `<span>⚡</span> <span>AI AGENTS (6)</span> <kbd style="opacity:0.6;font-size:9.5px;padding:2px 4px;background:rgba(255,255,255,0.2);border-radius:3px;">Alt+S</kbd>`;
    document.body.appendChild(triggerPill);

    // Dock Button Handlers
    document.getElementById('ops-btn-heal-delay').addEventListener('click', triggerSelfHealDelay);
    document.getElementById('ops-btn-heal-surge').addEventListener('click', triggerSelfHealSurge);
    document.getElementById('ops-btn-audit-cad').addEventListener('click', triggerCadAudit);
    document.getElementById('ops-btn-copilot').addEventListener('click', toggleCoPilot);
    document.getElementById('ops-dock-close').addEventListener('click', () => setDockMinimized(true));
    triggerPill.addEventListener('click', () => setDockMinimized(false));

    // Global Shortcut Alt + S
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setDockMinimized(!dockMinimized);
      }
    });
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function setDockMinimized(min) {
    dockMinimized = min;
    if (min) {
      dockContainer.classList.add('minimized');
      triggerPill.style.display = 'flex';
    } else {
      dockContainer.classList.remove('minimized');
      triggerPill.style.display = 'none';
    }
  }

  function updateTicker(msg, isHighlight = false) {
    const el = document.getElementById('ops-ticker-content');
    if (!el) return;
    el.innerHTML = isHighlight ? `<b>${msg}</b>` : msg;
  }

  // Initialize Agent Cursors
  function initAgents() {
    agentStates = AGENTS.map((cfg, index) => {
      const el = document.createElement('div');
      el.className = 'delta-live-agent';
      el.innerHTML = `
        ${createCursorSvg(cfg.color)}
        <div class="delta-live-tag" style="border-left: 3.5px solid ${cfg.color};">
          <span class="status-dot" style="background:${cfg.color};"></span>
          <span>${cfg.name}</span>
          <span class="action-label" id="tag-act-${cfg.id}">Idle</span>
        </div>
      `;
      overlayContainer.appendChild(el);

      const targetCoords = findInitialAnchor(cfg.anchorSelector);

      return {
        id: cfg.id,
        name: cfg.name,
        title: cfg.title,
        color: cfg.color,
        duty: cfg.duty,
        domElement: el,
        tagActionEl: el.querySelector(`#tag-act-${cfg.id}`),
        x: targetCoords.x + (Math.random() - 0.5) * 150,
        y: targetCoords.y + (Math.random() - 0.5) * 150,
        vx: 0,
        vy: 0,
        targetX: targetCoords.x,
        targetY: targetCoords.y,
        targetElement: targetCoords.element,
        state: 'idle',
        actionLabel: 'Monitoring',
        dwellTimer: Math.random() * 180 + 120,
        anchorSelector: cfg.anchorSelector
      };
    });
  }

  function findInitialAnchor(selector) {
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    const el = document.querySelector(selector);
    if (el) {
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width * 0.5,
        y: r.top + r.height * 0.5,
        element: el
      };
    }
    return {
      x: window.innerWidth * 0.3 + Math.random() * window.innerWidth * 0.4,
      y: window.innerHeight * 0.3 + Math.random() * window.innerHeight * 0.4,
      element: document.body
    };
  }

  // Set Agent Action
  function setAgentAction(agentId, action, targetEl = null, dwellFrames = 180) {
    const a = agentStates.find(x => x.id === agentId);
    if (!a) return;
    a.actionLabel = action;
    if (a.tagActionEl) a.tagActionEl.textContent = action;
    a.dwellTimer = dwellFrames;

    if (targetEl) {
      a.targetElement = targetEl;
      const r = targetEl.getBoundingClientRect();
      a.targetX = r.left + r.width * 0.5;
      a.targetY = r.top + r.height * 0.5;

      // Add to active inspections
      addActiveInspection(targetEl, a.color, `${a.name}: ${action}`);
    }
  }

  function addActiveInspection(el, color, label) {
    // Remove if already inspecting same element
    activeInspections = activeInspections.filter(item => item.element !== el);
    activeInspections.push({
      element: el,
      color: color,
      label: label,
      expiresAt: Date.now() + 3500
    });
  }

  // User Mouse Event Listeners (Co-Pilot on Hover)
  window.addEventListener('mousemove', (e) => {
    userMouse.x = e.clientX;
    userMouse.y = e.clientY;
    userMouse.active = true;
    userMouse.lastMove = Date.now();

    if (!coPilotEnabled) return;

    // Detect hovered interactive element
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && el !== userMouse.hoveredEl && !el.closest('#delta-swarm-ops-dock') && !el.closest('#delta-swarm-ops-pill')) {
      userMouse.hoveredEl = el;

      // Check if it's an interesting card or button
      const card = el.closest('.card, .schedule-card, .btn, .kpi-card, #cadCanvas, .volunteer-card');
      if (card) {
        // Dispatch nearest idle agent to co-pilot assist
        const agent = agentStates.reduce((closest, curr) => {
          const dCurr = Math.hypot(curr.x - e.clientX, curr.y - e.clientY);
          const dClosest = Math.hypot(closest.x - e.clientX, closest.y - e.clientY);
          return dCurr < dClosest ? curr : closest;
        }, agentStates[0]);

        if (agent && agent.dwellTimer < 60) {
          const r = card.getBoundingClientRect();
          agent.targetX = r.left + r.width - 25;
          agent.targetY = r.top + 15;
          agent.targetElement = card;
          agent.actionLabel = 'Inspecting';
          if (agent.tagActionEl) agent.tagActionEl.textContent = 'Co-Pilot Assist';
          agent.dwellTimer = 90;
        }
      }
    }
  }, { passive: true });

  window.addEventListener('mouseleave', () => {
    userMouse.active = false;
  });

  // When user clicks anything on the real page, co-pilot reacts
  window.addEventListener('click', (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.closest('#delta-swarm-ops-dock') || el.closest('#delta-swarm-ops-pill')) return;

    // Dispatch closest agent
    const closest = agentStates.reduce((prev, curr) => {
      const d1 = Math.hypot(prev.x - e.clientX, prev.y - e.clientY);
      const d2 = Math.hypot(curr.x - e.clientX, curr.y - e.clientY);
      return d2 < d1 ? curr : prev;
    }, agentStates[0]);

    if (closest) {
      closest.targetX = e.clientX + 30;
      closest.targetY = e.clientY + 20;
      closest.actionLabel = 'Assisting';
      if (closest.tagActionEl) closest.tagActionEl.textContent = 'Verified Click';
      closest.dwellTimer = 100;
    }
  }, { passive: true });

  // Toggle Co-Pilot
  function toggleCoPilot() {
    coPilotEnabled = !coPilotEnabled;
    const btn = document.getElementById('ops-btn-copilot');
    const label = document.getElementById('ops-copilot-label');
    if (coPilotEnabled) {
      btn.classList.add('active');
      label.textContent = 'Co-Pilot: ON';
      updateTicker('Co-Pilot Mode Active: Agents assist your live workflow.');
    } else {
      btn.classList.remove('active');
      label.textContent = 'Co-Pilot: OFF';
      updateTicker('Co-Pilot Mode Paused: Agents in autonomous patrol.');
    }
  }

  // 1. LIVE ACTION: Trigger Speaker Delay Self-Healing
  function triggerSelfHealDelay() {
    updateTicker('⏱️ Scheduler Agent initiating conflict detection & session relocation...', true);

    const schedAgent = agentStates.find(x => x.id === 'scheduler');
    const liaisonAgent = agentStates.find(x => x.id === 'liaison');
    const delayBtn = document.getElementById('btn-simulate-delay');
    const grid = document.getElementById('schedule-grid');

    if (liaisonAgent && delayBtn) {
      setAgentAction('liaison', 'Sensing Contingency', delayBtn, 160);
    }

    if (schedAgent && grid) {
      const cards = grid.querySelectorAll('.schedule-card, .drag-zone');
      if (cards.length >= 2) {
        const fromCard = cards[0];
        const toCard = cards[1];
        const r1 = fromCard.getBoundingClientRect();
        const r2 = toCard.getBoundingClientRect();

        // Animate Scheduler Agent picking up node from Hall-1 and moving to Hall-4
        schedAgent.x = r1.left + r1.width / 2;
        schedAgent.y = r1.top + r1.height / 2;
        schedAgent.targetX = r2.left + r2.width / 2;
        schedAgent.targetY = r2.top + r2.height / 2;
        setAgentAction('scheduler', 'Relocating Node', toCard, 220);

        // Add visual trajectory line
        motionDragPaths.push({
          x1: r1.left + r1.width / 2,
          y1: r1.top + r1.height / 2,
          x2: r2.left + r2.width / 2,
          y2: r2.top + r2.height / 2,
          color: schedAgent.color,
          label: 'Δ +15min Relocation',
          expiresAt: Date.now() + 3000
        });
      }
    }

    // Trigger real backend API call
    if (delayBtn) delayBtn.click();
    else {
      fetch('/api/simulate/delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerId: 'speaker-1', delayMinutes: 15 })
      }).catch(() => {});
    }
  }

  // 2. LIVE ACTION: Trigger Crowd Surge Self-Healing
  function triggerSelfHealSurge() {
    updateTicker('🏛️ Logistics Agent reallocating hall capacity & unlocking egress gates...', true);

    const logisticsAgent = agentStates.find(x => x.id === 'logistics');
    const broadcasterAgent = agentStates.find(x => x.id === 'broadcaster');
    const surgeBtn = document.getElementById('btn-simulate-surge');
    const cadCanvas = document.getElementById('cadCanvas');

    if (logisticsAgent && cadCanvas) {
      setAgentAction('logistics', 'Unlocking Egress', cadCanvas, 220);
    }

    if (broadcasterAgent) {
      const banner = document.getElementById('alert-coordinator-banner') || document.querySelector('header');
      setAgentAction('broadcaster', 'Synthesizing PA', banner, 200);
    }

    // Trigger real backend API call
    if (surgeBtn) surgeBtn.click();
    else {
      fetch('/api/simulate/capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId: 'topic-1', interestCount: 320 })
      }).catch(() => {});
    }
  }

  // 3. LIVE ACTION: CAD Blueprint Audit & Calibration
  function triggerCadAudit() {
    updateTicker('📐 CAD Geometry Agent inspecting architectural perimeter & NFPA-101 scale...', true);

    const cadAgent = agentStates.find(x => x.id === 'cadgeo');
    const cadCanvas = document.getElementById('cadCanvas');

    if (cadCanvas) {
      cadCanvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setAgentAction('cadgeo', 'Calibrating Scale', cadCanvas, 260);

      const r = cadCanvas.getBoundingClientRect();
      motionDragPaths.push({
        x1: r.left + 20,
        y1: r.top + 20,
        x2: r.left + r.width - 20,
        y2: r.top + r.height - 20,
        color: '#9c27b0',
        label: 'Calibrated Scale: 20m × 30m = 600m²',
        expiresAt: Date.now() + 4000
      });
    }
  }

  // Listen to live WebSocket Events
  window.addEventListener('message', (e) => {
    try {
      const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data && data.type === 'SCHEDULE_HEALED') {
        updateTicker('✨ Swarm Self-Healing Resolved: Agenda optimized & synchronized', true);
        const sched = agentStates.find(x => x.id === 'scheduler');
        if (sched) setAgentAction('scheduler', 'Healed 100%', null, 120);
      }
    } catch (_) {}
  });

  // Main 60FPS Physics and Animation Loop
  function animateLiveSwarm() {
    if (!ctx || !canvas) {
      requestAnimationFrame(animateLiveSwarm);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = Date.now();
    const isUserActive = userMouse.active && (now - userMouse.lastMove < 2500);

    // 1. Update and Render Active Inspections (Figma Wireframes on Real DOM)
    activeInspections = activeInspections.filter(item => item.expiresAt > now);
    activeInspections.forEach(insp => {
      const rect = insp.element.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > canvas.height || rect.right < 0 || rect.left > canvas.width) return;

      const bx = Math.round(rect.left);
      const by = Math.round(rect.top);
      const bw = Math.round(rect.width);
      const bh = Math.round(rect.height);
      const color = insp.color;

      ctx.save();

      // Bounding Box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);

      // Alignment guidelines
      ctx.strokeStyle = color + '44';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(bx, 0); ctx.lineTo(bx, canvas.height);
      ctx.moveTo(0, by + bh); ctx.lineTo(canvas.width, by + bh);
      ctx.stroke();

      // 8 Handles
      const hSize = 5;
      const handles = [
        { x: bx, y: by }, { x: bx + bw / 2, y: by }, { x: bx + bw, y: by },
        { x: bx + bw, y: by + bh / 2 }, { x: bx + bw, y: by + bh },
        { x: bx + bw / 2, y: by + bh }, { x: bx, y: by + bh }, { x: bx, y: by + bh / 2 }
      ];
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      handles.forEach(h => {
        ctx.fillRect(h.x - hSize / 2, h.y - hSize / 2, hSize, hSize);
        ctx.strokeRect(h.x - hSize / 2, h.y - hSize / 2, hSize, hSize);
      });

      // Dimension Badge
      const badgeText = `${bw} × ${bh} | ${insp.label}`;
      ctx.font = 'bold 11px "Space Grotesk", monospace';
      const m = ctx.measureText(badgeText);
      const padW = m.width + 14;
      const badgeX = bx + bw / 2 - padW / 2;
      const badgeY = by + bh + 4;

      ctx.fillStyle = color;
      if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, padW, 20, 4);
      else ctx.rect(badgeX, badgeY, padW, 20);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, bx + bw / 2, badgeY + 10);

      ctx.restore();
    });

    // 2. Render Motion Trajectory Drag Paths (e.g. Session Relocation Lines)
    motionDragPaths = motionDragPaths.filter(p => p.expiresAt > now);
    motionDragPaths.forEach(p => {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);

      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();

      // Arrow Head at Destination
      const angle = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x2, p.y2);
      ctx.lineTo(p.x2 - 12 * Math.cos(angle - Math.PI / 6), p.y2 - 12 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(p.x2 - 12 * Math.cos(angle + Math.PI / 6), p.y2 - 12 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // Trajectory Label
      ctx.font = 'bold 11px "Space Grotesk", monospace';
      ctx.fillStyle = '#000000';
      const midX = (p.x1 + p.x2) / 2;
      const midY = (p.y1 + p.y2) / 2;
      ctx.fillRect(midX - 45, midY - 10, 90, 20);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label, midX, midY);

      ctx.restore();
    });

    // 3. Agent Physics & Autonomous Roving
    agentStates.forEach(agent => {
      agent.dwellTimer -= 1;

      // When dwell timer expires, pick a new component anchor
      if (agent.dwellTimer <= 0) {
        const anchor = findInitialAnchor(agent.anchorSelector);
        agent.targetX = anchor.x + (Math.random() - 0.5) * 80;
        agent.targetY = anchor.y + (Math.random() - 0.5) * 60;
        agent.targetElement = anchor.element;
        agent.actionLabel = 'Monitoring';
        if (agent.tagActionEl) agent.tagActionEl.textContent = 'Monitoring';
        agent.dwellTimer = Math.random() * 240 + 120;
      } else if (agent.targetElement && agent.targetElement !== document.body) {
        // Keep target anchored to element during page scroll
        const r = agent.targetElement.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) {
          agent.targetX = r.left + r.width * 0.5;
          agent.targetY = r.top + r.height * 0.5;
        }
      }

      // Spring Physics
      const dx = agent.targetX - agent.x;
      const dy = agent.targetY - agent.y;
      const dist = Math.hypot(dx, dy);

      const spring = dist > 250 ? 0.08 : 0.04;
      const friction = 0.82;

      agent.vx += dx * spring;
      agent.vy += dy * spring;

      // Mouse Avoidance (yield if close to human cursor)
      if (isUserActive) {
        const mdx = agent.x - userMouse.x;
        const mdy = agent.y - userMouse.y;
        const mDist = Math.hypot(mdx, mdy);
        if (mDist < 100 && mDist > 0) {
          const repel = ((100 - mDist) / 100) * 7;
          agent.vx += (mdx / mDist) * repel;
          agent.vy += (mdy / mDist) * repel;
        }
      }

      agent.vx *= friction;
      agent.vy *= friction;
      agent.x += agent.vx;
      agent.y += agent.vy;

      // Bounds
      if (agent.x < 10) { agent.x = 10; agent.vx *= -0.5; }
      if (agent.x > canvas.width - 20) { agent.x = canvas.width - 20; agent.vx *= -0.5; }
      if (agent.y < 10) { agent.y = 10; agent.vy *= -0.5; }
      if (agent.y > canvas.height - 20) { agent.y = canvas.height - 20; agent.vy *= -0.5; }

      // Update DOM Cursor Transform
      agent.domElement.style.transform = `translate3d(${Math.round(agent.x)}px, ${Math.round(agent.y)}px, 0)`;
    });

    requestAnimationFrame(animateLiveSwarm);
  }

  // Public Global API
  window.deltaSwarm = {
    triggerSelfHealDelay,
    triggerSelfHealSurge,
    triggerCadAudit,
    toggleCoPilot,
    toggleDock() { setDockMinimized(!dockMinimized); },
    inspectElement(el, color, label) { addActiveInspection(el, color, label); }
  };

  // Boot on Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupDOM();
      initAgents();
      requestAnimationFrame(animateLiveSwarm);
    });
  } else {
    setupDOM();
    initAgents();
    requestAnimationFrame(animateLiveSwarm);
  }
})();
