/**
 * DELTA ENGINE - LIVE 2D AI MASCOT COMPANION ("AERO")
 * Interactive 2D aerospace drone companion providing dynamic co-pilot guidance,
 * speech bubbles, pointing animations, and situational feedback during live operations.
 */

(function initAeroMascotCompanion() {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'delta_mascot_enabled';
  let isEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';
  let mascotContainer = null;
  let speechBubble = null;
  let targetMarker = null;
  let posX = window.innerWidth - 180;
  let posY = window.innerHeight - 240;
  let targetX = posX;
  let targetY = posY;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let currentEmotion = 'happy'; // 'happy', 'alert', 'thinking', 'pointing', 'wink'
  let speechTimer = null;
  let idleTimer = null;
  let pointingTargetEl = null;

  // Sound generator for cute robotic chirps via Web Audio API
  function playMascotChirp(type = 'blip') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'blip') {
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'alert') {
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(660, now + 0.08);
        osc.frequency.setValueAtTime(990, now + 0.16);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.08);
        osc.frequency.setValueAtTime(880, now + 0.16);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (_) {}
  }

  // Create SVG Mascot Character (Aero the Aerospace Co-Pilot Drone)
  function renderMascotSvg(emotion = 'happy') {
    let eyesSvg = '';
    if (emotion === 'happy') {
      eyesSvg = `
        <path d="M26 36 Q32 30 38 36" stroke="#00f0ff" stroke-width="3" stroke-linecap="round" fill="none" />
        <path d="M52 36 Q58 30 64 36" stroke="#00f0ff" stroke-width="3" stroke-linecap="round" fill="none" />
      `;
    } else if (emotion === 'alert') {
      eyesSvg = `
        <circle cx="32" cy="36" r="6" fill="#ff5252" />
        <circle cx="58" cy="36" r="6" fill="#ff5252" />
        <circle cx="32" cy="36" r="2.5" fill="#ffffff" />
        <circle cx="58" cy="36" r="2.5" fill="#ffffff" />
      `;
    } else if (emotion === 'thinking') {
      eyesSvg = `
        <circle cx="32" cy="34" r="5" fill="#ffd600" />
        <line x1="52" y1="36" x2="64" y2="36" stroke="#ffd600" stroke-width="3" stroke-linecap="round" />
      `;
    } else if (emotion === 'wink') {
      eyesSvg = `
        <circle cx="32" cy="36" r="5" fill="#00f0ff" />
        <circle cx="34" cy="34" r="2" fill="#ffffff" />
        <path d="M52 36 Q58 32 64 36" stroke="#00f0ff" stroke-width="3" stroke-linecap="round" fill="none" />
      `;
    } else { // pointing / focus
      eyesSvg = `
        <circle cx="32" cy="36" r="5" fill="#00f0ff" />
        <circle cx="58" cy="36" r="5" fill="#00f0ff" />
      `;
    }

    return `
      <svg class="aero-svg" width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Floating Thruster Glow -->
        <ellipse cx="45" cy="80" rx="16" ry="5" fill="rgba(0, 240, 255, 0.45)" class="aero-thruster-glow" />
        <ellipse cx="45" cy="78" rx="8" ry="2.5" fill="#ffffff" />

        <!-- Drone Antenna -->
        <line x1="45" y1="14" x2="45" y2="4" stroke="#000000" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="45" cy="4" r="3.5" fill="${emotion === 'alert' ? '#ff5252' : '#00e5ff'}" stroke="#000000" stroke-width="2" class="aero-antenna-bulb" />

        <!-- Outer Ring Thrusters -->
        <rect x="6" y="42" width="10" height="18" rx="5" fill="#2563eb" stroke="#000000" stroke-width="2" />
        <rect x="74" y="42" width="10" height="18" rx="5" fill="#2563eb" stroke="#000000" stroke-width="2" />

        <!-- Main Curved Chassis (Neubrutalist Aerospace) -->
        <rect x="16" y="14" width="58" height="58" rx="22" fill="#1e293b" stroke="#000000" stroke-width="3" />
        
        <!-- Visor Bezel & Digital Screen -->
        <rect x="20" y="22" width="50" height="30" rx="10" fill="#0f172a" stroke="#000000" stroke-width="2" />
        
        <!-- Dynamic Expressive Eyes -->
        <g class="aero-eyes">
          ${eyesSvg}
        </g>

        <!-- Status Cheeks -->
        <circle cx="25" cy="45" r="3" fill="#ff4081" opacity="0.75" />
        <circle cx="65" cy="45" r="3" fill="#ff4081" opacity="0.75" />

        <!-- Front Delta Insignia -->
        <polygon points="45,58 49,65 41,65" fill="#00f0ff" stroke="#000000" stroke-width="1.2" />

        <!-- Articulated Hand (Left/Right) -->
        <g class="aero-hand ${emotion === 'pointing' ? 'pointing' : ''}">
          <circle cx="78" cy="56" r="6" fill="#f8fafc" stroke="#000000" stroke-width="2" />
          <path d="M82 56 L89 54" stroke="#000000" stroke-width="2" stroke-linecap="round" />
        </g>
      </svg>
    `;
  }

  // Setup DOM Elements and Styles
  function setupDOM() {
    if (document.getElementById('delta-mascot-container')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'delta-mascot-styles';
    styleEl.textContent = `
      #delta-mascot-container {
        position: fixed;
        width: 90px;
        height: 90px;
        z-index: 999995;
        cursor: grab;
        user-select: none;
        will-change: transform;
        transition: transform 0.08s ease-out;
        filter: drop-shadow(4px 4px 0px rgba(0,0,0,0.85));
      }
      #delta-mascot-container:active {
        cursor: grabbing;
      }
      .aero-svg {
        animation: aeroFloat 2.6s ease-in-out infinite;
      }
      @keyframes aeroFloat {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-7px) rotate(1.5deg); }
      }
      .aero-thruster-glow {
        animation: thrusterPulse 1.2s ease-in-out infinite alternate;
      }
      @keyframes thrusterPulse {
        0% { opacity: 0.35; transform: scale(0.9); }
        100% { opacity: 0.85; transform: scale(1.15); }
      }
      .aero-antenna-bulb {
        animation: antennaBlink 1.8s infinite;
      }
      @keyframes antennaBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      .aero-hand.pointing {
        transform: translate(-10px, -8px) rotate(-25deg);
        transform-origin: 78px 56px;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      /* Neubrutalist Speech Bubble */
      #delta-mascot-bubble {
        position: fixed;
        max-width: 280px;
        min-width: 180px;
        background: #ffffff;
        color: #000000;
        border: 2.5px solid #000000;
        border-radius: 12px;
        padding: 10px 14px;
        font-family: 'Space Grotesk', -apple-system, sans-serif;
        font-size: 12.5px;
        font-weight: 700;
        line-height: 1.4;
        box-shadow: 4px 4px 0px #000000;
        z-index: 999996;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(10px) scale(0.94);
        transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        display: none;
      }
      #delta-mascot-bubble.visible {
        display: block;
        opacity: 1;
        transform: translateY(0px) scale(1);
      }
      #delta-mascot-bubble::after {
        content: '';
        position: absolute;
        bottom: -11px;
        right: 28px;
        border-width: 11px 9px 0 0;
        border-style: solid;
        border-color: #000000 transparent transparent transparent;
      }
      #delta-mascot-bubble::before {
        content: '';
        position: absolute;
        bottom: -7px;
        right: 29px;
        border-width: 8px 7px 0 0;
        border-style: solid;
        border-color: #ffffff transparent transparent transparent;
        z-index: 1;
      }
      .bubble-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
        font-size: 10.5px;
        font-weight: 800;
        color: #2563eb;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .bubble-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        color: #94a3b8;
        padding: 0 2px;
        line-height: 1;
      }
      .bubble-close:hover {
        color: #000000;
      }

      /* Animated Laser Target Ring */
      #delta-mascot-target-marker {
        position: fixed;
        width: 32px;
        height: 32px;
        border: 2px dashed #00f0ff;
        border-radius: 50%;
        pointer-events: none;
        z-index: 999994;
        display: none;
        animation: targetSpin 2s linear infinite;
        box-shadow: 0 0 12px rgba(0, 240, 255, 0.6);
      }
      @keyframes targetSpin {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }
    `;
    document.head.appendChild(styleEl);

    // Mascot Body
    mascotContainer = document.createElement('div');
    mascotContainer.id = 'delta-mascot-container';
    mascotContainer.innerHTML = renderMascotSvg('happy');
    document.body.appendChild(mascotContainer);

    // Speech Bubble
    speechBubble = document.createElement('div');
    speechBubble.id = 'delta-mascot-bubble';
    speechBubble.innerHTML = `
      <div class="bubble-header">
        <span id="mascot-bubble-title">🤖 AERO CO-PILOT</span>
        <button class="bubble-close" id="mascot-bubble-close">✕</button>
      </div>
      <div id="mascot-bubble-text">Ready for operations!</div>
    `;
    document.body.appendChild(speechBubble);

    document.getElementById('mascot-bubble-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hideSpeechBubble();
    });

    // Target Marker
    targetMarker = document.createElement('div');
    targetMarker.id = 'delta-mascot-target-marker';
    document.body.appendChild(targetMarker);

    // Position initially
    updateMascotPosition(posX, posY);

    // Draggable Mascot Logic
    mascotContainer.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragOffset.x = e.clientX - posX;
      dragOffset.y = e.clientY - posY;
      setEmotion('thinking');
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        posX = e.clientX - dragOffset.x;
        posY = e.clientY - dragOffset.y;
        targetX = posX;
        targetY = posY;
        updateMascotPosition(posX, posY);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        setEmotion('happy');
      }
    });

    // Click Mascot for Random Pro-Tip / Mission Briefing
    mascotContainer.addEventListener('click', () => {
      if (!isDragging) {
        sayRandomProTip();
        playMascotChirp('blip');
      }
    });

    if (!isEnabled) {
      mascotContainer.style.display = 'none';
      speechBubble.style.display = 'none';
    }
  }

  function setEmotion(emotion) {
    if (currentEmotion === emotion || !mascotContainer) return;
    currentEmotion = emotion;
    mascotContainer.innerHTML = renderMascotSvg(emotion);
  }

  function updateMascotPosition(x, y) {
    if (!mascotContainer) return;
    mascotContainer.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;

    // Position speech bubble above mascot
    if (speechBubble) {
      const bubbleW = speechBubble.offsetWidth || 220;
      const bubbleH = speechBubble.offsetHeight || 60;
      speechBubble.style.left = `${Math.max(10, Math.min(window.innerWidth - bubbleW - 10, x - bubbleW + 70))}px`;
      speechBubble.style.top = `${Math.max(10, y - bubbleH - 14)}px`;
    }
  }

  function showSpeechBubble(text, title = '🤖 AERO CO-PILOT', duration = 5000) {
    if (!speechBubble || !isEnabled) return;
    const txtEl = document.getElementById('mascot-bubble-text');
    const titleEl = document.getElementById('mascot-bubble-title');
    if (txtEl) txtEl.innerHTML = text;
    if (titleEl) titleEl.textContent = title;

    speechBubble.classList.add('visible');
    updateMascotPosition(posX, posY);

    if (speechTimer) clearTimeout(speechTimer);
    if (duration > 0) {
      speechTimer = setTimeout(() => {
        hideSpeechBubble();
      }, duration);
    }
  }

  function hideSpeechBubble() {
    if (speechBubble) {
      speechBubble.classList.remove('visible');
    }
    if (targetMarker) {
      targetMarker.style.display = 'none';
    }
    setEmotion('happy');
  }

  // Point at specific DOM element and fly over to guide user
  function pointAtElement(targetEl, text, emotion = 'pointing', duration = 5500) {
    if (!targetEl || !isEnabled) return;
    const rect = targetEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Scroll element into view if offscreen
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setTimeout(() => {
      const r = targetEl.getBoundingClientRect();
      // Target position: Hovering just to the right and above target element
      targetX = Math.min(window.innerWidth - 110, r.right + 15);
      targetY = Math.max(20, r.top - 20);

      // Show laser target marker on the element center
      if (targetMarker) {
        targetMarker.style.left = `${r.left + r.width / 2}px`;
        targetMarker.style.top = `${r.top + r.height / 2}px`;
        targetMarker.style.display = 'block';
      }

      setEmotion(emotion);
      playMascotChirp(emotion === 'alert' ? 'alert' : 'blip');
      showSpeechBubble(text, `🎯 TARGET: ${targetEl.id || 'INSPECTION'}`, duration);
    }, 150);
  }

  // Library of proactive situational tips
  const PRO_TIPS = [
    "Tip: Drag session cards in the schedule grid to manually rebalance venue halls!",
    "Telemetry SLA is clocked at < 0.1ms — all deterministic constraint solvers active.",
    "Did you know? Turing Hall capacity is calibrated at 250 pax according to NFPA-101 codes.",
    "Press Alt + S anytime to toggle the Swarm dock or inspect active agent callsigns.",
    "CCTV Perception HUD uses optical headcount tripwires for real-time room density estimation.",
    "Emergency SOS broadcasts are queued offline if connection drops — zero lost packets!"
  ];

  let tipIndex = 0;
  function sayRandomProTip() {
    const tip = PRO_TIPS[tipIndex % PRO_TIPS.length];
    tipIndex++;
    setEmotion('wink');
    showSpeechBubble(tip, '💡 AERO PRO-TIP', 5000);
  }

  // Smooth Flying Animation Loop (Spring Physics toward target)
  function animateMascot() {
    if (!isDragging && mascotContainer && isEnabled) {
      const dx = targetX - posX;
      const dy = targetY - posY;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        posX += dx * 0.12;
        posY += dy * 0.12;
        updateMascotPosition(posX, posY);
      }
    }
    requestAnimationFrame(animateMascot);
  }

  // System Event Listeners
  function attachSystemListeners() {
    // 1. When Speaker Delay contingency is simulated
    const btnDelay = document.getElementById('btn-simulate-delay');
    if (btnDelay) {
      btnDelay.addEventListener('click', () => {
        const grid = document.getElementById('schedule-grid');
        pointAtElement(grid || btnDelay, "⏱️ Speaker delay contingency active! Scheduler Agent is reallocating the slot to an open hall.", 'thinking', 6000);
      });
    }

    // 2. When Crowd Surge contingency is simulated
    const btnSurge = document.getElementById('btn-simulate-surge');
    if (btnSurge) {
      btnSurge.addEventListener('click', () => {
        const cad = document.getElementById('cadCanvas') || btnSurge;
        pointAtElement(cad, "⚠️ Capacity surge alert! Logistics Agent opening East Overflow Park & releasing barricades.", 'alert', 6000);
      });
    }

    // 3. When CAD Blueprint is inspected
    const cadCanvas = document.getElementById('cadCanvas');
    if (cadCanvas) {
      cadCanvas.addEventListener('mouseenter', () => {
        if (Math.random() > 0.6) {
          showSpeechBubble("2D CAD Blueprint calibrated: 20m × 30m = 600m² | Primary life-safety egress route clear.", '📐 CAD ARCHITECTURE', 4000);
        }
      });
    }

    // 4. Listen to WebSockets / custom events
    window.addEventListener('message', (e) => {
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d && d.type === 'SCHEDULE_HEALED') {
          setEmotion('happy');
          playMascotChirp('success');
          showSpeechBubble("✨ Agenda constraint solved! All sessions synchronized with zero delay.", '🎉 SELF-HEALING COMPLETE', 5000);
        }
      } catch (_) {}
    });
  }

  // Public Mascot API
  window.deltaMascot = {
    say(text, duration = 5000) {
      showSpeechBubble(text, '🤖 AERO CO-PILOT', duration);
      playMascotChirp('blip');
    },
    pointAt(el, text, emotion = 'pointing') {
      pointAtElement(el, text, emotion);
    },
    setEmotion(emotion) {
      setEmotion(emotion);
    },
    toggle() {
      isEnabled = !isEnabled;
      localStorage.setItem(STORAGE_KEY, isEnabled ? 'true' : 'false');
      if (mascotContainer) mascotContainer.style.display = isEnabled ? 'block' : 'none';
      if (speechBubble) speechBubble.style.display = isEnabled ? 'block' : 'none';
      const lbl = document.getElementById('lbl-mascot-toggle');
      if (lbl) lbl.textContent = isEnabled ? 'AI Mascot: ON' : 'AI Mascot: OFF';
      if (isEnabled) {
        showSpeechBubble("Systems online! Aero is reporting for duty.", '🤖 AERO ONLINE', 4000);
        playMascotChirp('success');
      }
      return isEnabled;
    },
    onSwarmRebuildComplete() {
      // Called when Swarm Rebuild finishes rebuilding all components
      if (!isEnabled) return;
      setTimeout(() => {
        setEmotion('wink');
        playMascotChirp('success');
        showSpeechBubble("🚀 Mission Ready! Every component has been built. Welcome back to DELTAengine, Commander!", '✨ SYSTEMS BUILT', 6000);
      }, 900);
    }
  };

  // Boot on Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupDOM();
      attachSystemListeners();
      requestAnimationFrame(animateMascot);
    });
  } else {
    setupDOM();
    attachSystemListeners();
    requestAnimationFrame(animateMascot);
  }
})();
