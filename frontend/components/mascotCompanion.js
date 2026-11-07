/**
 * DELTA ENGINE - AUTONOMOUS 2D AI MASCOT COMPANION ("AERO")
 * A lively, expressive, autonomous aerospace drone companion that has a "mind of its own":
 * - Freely roams the dashboard visiting key operational cards
 * - Performs joyful aerial tricks (barrel rolls, laser chasing, thruster bursts)
 * - Naps when idle with floating 'z Z Z' bubbles and wakes up when user interacts
 * - Points laser markers at active components during incidents
 * - Reacts with robotic chirps, dynamic emotions, and witty speech bubbles
 * - 100% non-harmful: zero DOM mutations or interference with existing operations.
 */

(function initAeroMascotCompanion() {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'delta_mascot_enabled';
  let isEnabled = localStorage.getItem(STORAGE_KEY) !== 'false';
  let mascotEl = null;
  let speechBubbleEl = null;
  let laserPointerEl = null;
  let zzzBubbleEl = null;

  // Position & Physics state
  let posX = window.innerWidth - 170;
  let posY = window.innerHeight - 230;
  let targetX = posX;
  let targetY = posY;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let currentEmotion = 'happy'; // 'happy', 'alert', 'thinking', 'pointing', 'wink', 'dizzy', 'sleep', 'stars'
  let isSleeping = false;
  let lastUserActivity = Date.now();
  let autonomousActionTimer = null;
  let speechDismissTimer = null;
  let isBusyWithTrick = false;

  // Sound Synthesizer via Web Audio API (Robotic chirps, whooshes, chimes)
  function playAudioChirp(type = 'blip') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'blip') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(920, now + 0.12);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'whoosh') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.22);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.4);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'alert') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(660, now + 0.09);
        osc.frequency.setValueAtTime(990, now + 0.18);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (type === 'celebrate') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'wake') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(840, now + 0.16);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (_) {}
  }

  // Render SVG Robot Body with Dynamic Moods
  function renderAeroSvg(emotion = 'happy') {
    let eyesSvg = '';
    let antennaColor = '#00f0ff';
    let blushOpacity = 0.75;

    if (emotion === 'happy') {
      eyesSvg = `
        <path d="M38 48 Q46 40 54 48" stroke="#00f0ff" stroke-width="4.5" stroke-linecap="round" fill="none" />
        <path d="M72 48 Q80 40 88 48" stroke="#00f0ff" stroke-width="4.5" stroke-linecap="round" fill="none" />
      `;
    } else if (emotion === 'alert') {
      antennaColor = '#ff3344';
      blushOpacity = 0.3;
      eyesSvg = `
        <circle cx="46" cy="48" r="8" fill="#ff3344" />
        <circle cx="80" cy="48" r="8" fill="#ff3344" />
        <circle cx="46" cy="48" r="3.5" fill="#ffffff" />
        <circle cx="80" cy="48" r="3.5" fill="#ffffff" />
      `;
    } else if (emotion === 'stars') {
      eyesSvg = `
        <polygon points="46,40 48,46 54,46 49,50 51,56 46,52 41,56 43,50 38,46 44,46" fill="#ffd600" />
        <polygon points="80,40 82,46 88,46 83,50 85,56 80,52 75,56 77,50 72,46 78,46" fill="#ffd600" />
      `;
    } else if (emotion === 'dizzy') {
      eyesSvg = `
        <path d="M42 48 A4 4 0 1 1 50 48 A4 4 0 1 1 42 48" stroke="#00f0ff" stroke-width="2.5" fill="none" />
        <path d="M76 48 A4 4 0 1 1 84 48 A4 4 0 1 1 76 48" stroke="#00f0ff" stroke-width="2.5" fill="none" />
      `;
    } else if (emotion === 'sleep') {
      antennaColor = '#64748b';
      blushOpacity = 0.5;
      eyesSvg = `
        <line x1="38" y1="50" x2="54" y2="50" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" />
        <line x1="72" y1="50" x2="88" y2="50" stroke="#94a3b8" stroke-width="4" stroke-linecap="round" />
      `;
    } else if (emotion === 'wink') {
      eyesSvg = `
        <circle cx="46" cy="48" r="7" fill="#00f0ff" />
        <circle cx="49" cy="45" r="2.5" fill="#ffffff" />
        <path d="M72 48 Q80 43 88 48" stroke="#00f0ff" stroke-width="4.5" stroke-linecap="round" fill="none" />
      `;
    } else { // thinking / curious
      eyesSvg = `
        <circle cx="46" cy="46" r="6.5" fill="#00f0ff" />
        <line x1="72" y1="48" x2="88" y2="48" stroke="#00f0ff" stroke-width="4.5" stroke-linecap="round" />
      `;
    }

    return `
      <svg class="aero-core-svg" width="126" height="126" viewBox="0 0 126 126" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Antigravity Thruster Flames (Animated Plasma) -->
        <g class="aero-thrusters">
          <ellipse cx="63" cy="112" rx="20" ry="7" fill="rgba(0, 240, 255, 0.45)" class="aero-plasma-outer" />
          <ellipse cx="63" cy="109" rx="11" ry="3.5" fill="#ffffff" class="aero-plasma-inner" />
          <path d="M57 110 L63 122 L69 110 Z" fill="#00e5ff" opacity="0.8" />
        </g>

        <!-- Antenna with Pulsing Beacon Light -->
        <line x1="63" y1="20" x2="63" y2="6" stroke="#000000" stroke-width="3" stroke-linecap="round" />
        <circle cx="63" cy="6" r="4.5" fill="${antennaColor}" stroke="#000000" stroke-width="2.5" class="aero-antenna-glow" />

        <!-- Twin Side Propulsion Pods -->
        <rect x="8" y="58" width="14" height="26" rx="7" fill="#2563eb" stroke="#000000" stroke-width="2.5" />
        <rect x="104" y="58" width="14" height="26" rx="7" fill="#2563eb" stroke="#000000" stroke-width="2.5" />

        <!-- Main Aerodynamic Drone Chassis (Neubrutalist White & Obsidian) -->
        <rect x="22" y="20" width="82" height="82" rx="30" fill="#f8fafc" stroke="#000000" stroke-width="3.5" />
        
        <!-- Curved Visor Screen Bezel -->
        <rect x="28" y="30" width="70" height="42" rx="14" fill="#0f172a" stroke="#000000" stroke-width="2.5" />
        
        <!-- Expressive Digital LED Visor Eyes -->
        <g class="aero-digital-eyes">
          ${eyesSvg}
        </g>

        <!-- Blushing Status Cheeks -->
        <circle cx="34" cy="62" r="4.5" fill="#ff4081" opacity="${blushOpacity}" />
        <circle cx="92" cy="62" r="4.5" fill="#ff4081" opacity="${blushOpacity}" />

        <!-- Front Delta Aerospace Insignia -->
        <polygon points="63,78 68,88 58,88" fill="#00f0ff" stroke="#000000" stroke-width="1.8" />

        <!-- Articulated Mechanical Pointer Hand (Right) -->
        <g class="aero-arm-right ${emotion === 'pointing' ? 'pointing' : ''}">
          <circle cx="108" cy="76" r="8" fill="#ffffff" stroke="#000000" stroke-width="2.5" />
          <path d="M114 76 L124 74" stroke="#000000" stroke-width="3" stroke-linecap="round" />
        </g>

        <!-- Mechanical Hand (Left) -->
        <g class="aero-arm-left">
          <circle cx="18" cy="76" r="8" fill="#ffffff" stroke="#000000" stroke-width="2.5" />
        </g>
      </svg>
    `;
  }

  // Setup DOM Elements and Animations
  function setupDOM() {
    if (document.getElementById('delta-aero-mascot-root')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'delta-aero-mascot-styles';
    styleEl.textContent = `
      #delta-aero-mascot-root {
        position: fixed;
        top: 0;
        left: 0;
        width: 126px;
        height: 126px;
        z-index: 2147483640; /* High priority visibility */
        cursor: grab;
        user-select: none;
        will-change: transform;
        filter: drop-shadow(0 12px 25px rgba(0,0,0,0.3)) drop-shadow(4px 4px 0px #000000);
        pointer-events: auto;
      }
      #delta-aero-mascot-root:active {
        cursor: grabbing;
      }
      .aero-core-svg {
        animation: aeroLevitate 3s ease-in-out infinite;
        transform-origin: 63px 63px;
        transition: transform 0.2s ease;
      }
      @keyframes aeroLevitate {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-10px) rotate(2deg); }
      }
      .aero-core-svg.barrel-roll {
        animation: aeroSpinRoll 0.75s cubic-bezier(0.2, 0.8, 0.2, 1) !important;
      }
      @keyframes aeroSpinRoll {
        0% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(180deg) scale(1.15) translateY(-20px); }
        100% { transform: rotate(360deg) scale(1); }
      }
      .aero-plasma-outer {
        animation: thrusterPuff 1.1s ease-in-out infinite alternate;
      }
      @keyframes thrusterPuff {
        0% { opacity: 0.4; transform: scale(0.9); }
        100% { opacity: 0.9; transform: scale(1.2); }
      }
      .aero-antenna-glow {
        animation: beaconFlicker 1.5s infinite;
      }
      @keyframes beaconFlicker {
        0%, 100% { opacity: 1; filter: drop-shadow(0 0 6px #00f0ff); }
        50% { opacity: 0.35; filter: none; }
      }
      .aero-arm-right.pointing {
        transform: translate(-14px, -12px) rotate(-30deg);
        transform-origin: 108px 76px;
        transition: transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      /* High-Contrast Comic Neubrutalist Speech Bubble */
      #delta-aero-bubble {
        position: fixed;
        max-width: 310px;
        min-width: 200px;
        background: #ffffff;
        color: #000000;
        border: 3px solid #000000;
        border-radius: 14px;
        padding: 12px 16px;
        font-family: 'Space Grotesk', -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 700;
        line-height: 1.45;
        box-shadow: 4px 4px 0px #000000;
        z-index: 2147483645;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(12px) scale(0.92);
        transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        display: none;
      }
      #delta-aero-bubble.visible {
        display: block;
        opacity: 1;
        transform: translateY(0px) scale(1);
      }
      #delta-aero-bubble::after {
        content: '';
        position: absolute;
        bottom: -14px;
        right: 34px;
        border-width: 14px 11px 0 0;
        border-style: solid;
        border-color: #000000 transparent transparent transparent;
      }
      #delta-aero-bubble::before {
        content: '';
        position: absolute;
        bottom: -9px;
        right: 35px;
        border-width: 10px 9px 0 0;
        border-style: solid;
        border-color: #ffffff transparent transparent transparent;
        z-index: 1;
      }
      #delta-aero-bubble.bubble-below::after {
        bottom: auto;
        top: -14px;
        right: 34px;
        border-width: 0 11px 14px 0;
        border-style: solid;
        border-color: transparent #000000 transparent transparent;
      }
      #delta-aero-bubble.bubble-below::before {
        bottom: auto;
        top: -9px;
        right: 35px;
        border-width: 0 9px 10px 0;
        border-style: solid;
        border-color: transparent #ffffff transparent transparent;
      }
      .aero-bubble-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 11px;
        font-weight: 800;
        color: #2563eb;
        text-transform: uppercase;
        letter-spacing: 0.6px;
      }
      .aero-bubble-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        font-weight: 900;
        color: #64748b;
        padding: 0 4px;
        line-height: 1;
        border-radius: 4px;
      }
      .aero-bubble-close:hover {
        color: #000000;
        background: #f1f5f9;
      }

      /* Floating z Z Z sleep particles */
      #delta-aero-zzz {
        position: fixed;
        font-family: 'Space Grotesk', monospace;
        font-size: 20px;
        font-weight: 900;
        color: #60a5fa;
        text-shadow: 2px 2px 0px #000000;
        z-index: 2147483642;
        pointer-events: none;
        display: none;
        animation: floatZzz 2.4s infinite ease-in;
      }
      @keyframes floatZzz {
        0% { opacity: 0; transform: translateY(0px) scale(0.7); }
        50% { opacity: 1; transform: translateY(-25px) scale(1.1); }
        100% { opacity: 0; transform: translateY(-50px) scale(1.4); }
      }

      /* Laser Pointer Marker on active target */
      #delta-aero-laser-point {
        position: fixed;
        width: 36px;
        height: 36px;
        border: 2.5px dashed #00f0ff;
        border-radius: 50%;
        pointer-events: none;
        z-index: 2147483630;
        display: none;
        animation: laserSpin 1.8s linear infinite;
        box-shadow: 0 0 16px rgba(0, 240, 255, 0.75);
      }
      @keyframes laserSpin {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }
    `;
    document.head.appendChild(styleEl);

    // Mascot Root Container
    mascotEl = document.createElement('div');
    mascotEl.id = 'delta-aero-mascot-root';
    mascotEl.setAttribute('role', 'complementary');
    mascotEl.setAttribute('aria-label', 'Aero the 2D AI Mascot Co-Pilot');
    mascotEl.innerHTML = renderAeroSvg('happy');
    document.body.appendChild(mascotEl);

    // Speech Bubble
    speechBubbleEl = document.createElement('div');
    speechBubbleEl.id = 'delta-aero-bubble';
    speechBubbleEl.innerHTML = `
      <div class="aero-bubble-head">
        <span id="aero-bubble-title">🤖 AERO CO-PILOT</span>
        <button class="aero-bubble-close" id="aero-bubble-close" title="Dismiss">✕</button>
      </div>
      <div id="aero-bubble-msg">All systems nominal! Ready for event operations.</div>
    `;
    document.body.appendChild(speechBubbleEl);

    document.getElementById('aero-bubble-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hideBubble();
    });

    // Sleep Bubble
    zzzBubbleEl = document.createElement('div');
    zzzBubbleEl.id = 'delta-aero-zzz';
    zzzBubbleEl.textContent = 'z Z Z';
    document.body.appendChild(zzzBubbleEl);

    // Laser Pointer
    laserPointerEl = document.createElement('div');
    laserPointerEl.id = 'delta-aero-laser-point';
    document.body.appendChild(laserPointerEl);

    // Set initial position
    updatePosition(posX, posY);

    // Draggable Mascot Logic
    mascotEl.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragOffset.x = e.clientX - posX;
      dragOffset.y = e.clientY - posY;
      wakeUp();
      setEmotion('thinking');
    });

    window.addEventListener('mousemove', (e) => {
      lastUserActivity = Date.now();
      if (isSleeping) wakeUp();

      if (isDragging) {
        posX = e.clientX - dragOffset.x;
        posY = e.clientY - dragOffset.y;
        targetX = posX;
        targetY = posY;
        updatePosition(posX, posY);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        setEmotion('happy');
        playAudioChirp('blip');
      }
    });

    // Mobile / Touch Screen Dragging Support
    mascotEl.addEventListener('touchstart', (e) => {
      if (!e.touches || !e.touches[0]) return;
      isDragging = true;
      dragOffset.x = e.touches[0].clientX - posX;
      dragOffset.y = e.touches[0].clientY - posY;
      wakeUp();
      setEmotion('thinking');
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      lastUserActivity = Date.now();
      if (isSleeping) wakeUp();
      if (isDragging && e.touches && e.touches[0]) {
        posX = Math.min(window.innerWidth - 140, Math.max(10, e.touches[0].clientX - dragOffset.x));
        posY = Math.min(window.innerHeight - 150, Math.max(10, e.touches[0].clientY - dragOffset.y));
        targetX = posX;
        targetY = posY;
        updatePosition(posX, posY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (isDragging) {
        isDragging = false;
        setEmotion('happy');
        playAudioChirp('blip');
      }
    });

    // Viewport Resizing & Boundary Clamping
    window.addEventListener('resize', () => {
      posX = Math.min(window.innerWidth - 140, Math.max(20, posX));
      posY = Math.min(window.innerHeight - 150, Math.max(20, posY));
      targetX = Math.min(window.innerWidth - 140, Math.max(20, targetX));
      targetY = Math.min(window.innerHeight - 150, Math.max(20, targetY));
      updatePosition(posX, posY);
    });

    // Click Mascot to perform Joyful Trick & Speak
    mascotEl.addEventListener('click', () => {
      if (!isDragging) {
        wakeUp();
        doPlayfulTrick();
      }
    });

    // Listen to all user activity (keys, mouse, wheel, touch, scroll)
    const onUserInteraction = () => {
      lastUserActivity = Date.now();
      if (isSleeping) wakeUp();
    };
    window.addEventListener('keydown', onUserInteraction, { passive: true });
    window.addEventListener('wheel', onUserInteraction, { passive: true });
    window.addEventListener('scroll', onUserInteraction, { passive: true });
    window.addEventListener('touchstart', onUserInteraction, { passive: true });

    if (!isEnabled) {
      mascotEl.style.display = 'none';
      speechBubbleEl.style.display = 'none';
    }
  }

  function setEmotion(emotion) {
    if (currentEmotion === emotion || !mascotEl) return;
    currentEmotion = emotion;
    mascotEl.innerHTML = renderAeroSvg(emotion);
  }

  function updatePosition(x, y) {
    if (!mascotEl) return;
    mascotEl.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;

    // Position speech bubble above mascot (or flip below if near top of screen)
    if (speechBubbleEl) {
      const bW = speechBubbleEl.offsetWidth || 230;
      const bH = speechBubbleEl.offsetHeight || 65;
      speechBubbleEl.style.left = `${Math.max(15, Math.min(window.innerWidth - bW - 15, x - bW + 90))}px`;
      if (y < bH + 25) {
        speechBubbleEl.style.top = `${y + 130}px`;
        speechBubbleEl.classList.add('bubble-below');
      } else {
        speechBubbleEl.style.top = `${Math.max(15, y - bH - 18)}px`;
        speechBubbleEl.classList.remove('bubble-below');
      }
    }

    // Position zzz bubble
    if (zzzBubbleEl) {
      zzzBubbleEl.style.left = `${x + 65}px`;
      zzzBubbleEl.style.top = `${y - 30}px`;
    }
  }

  function speak(msg, title = '🤖 AERO CO-PILOT', duration = 5000) {
    if (!speechBubbleEl || !isEnabled) return;
    const txtEl = document.getElementById('aero-bubble-msg');
    const titleEl = document.getElementById('aero-bubble-title');
    if (txtEl) txtEl.innerHTML = msg;
    if (titleEl) titleEl.textContent = title;

    speechBubbleEl.classList.add('visible');
    updatePosition(posX, posY);

    if (speechDismissTimer) clearTimeout(speechDismissTimer);
    if (duration > 0) {
      speechDismissTimer = setTimeout(hideBubble, duration);
    }
  }

  function hideBubble() {
    if (speechBubbleEl) speechBubbleEl.classList.remove('visible');
    if (laserPointerEl) laserPointerEl.style.display = 'none';
    if (!isSleeping) setEmotion('happy');
  }

  function wakeUp() {
    if (isSleeping) {
      isSleeping = false;
      if (zzzBubbleEl) zzzBubbleEl.style.display = 'none';
      setEmotion('happy');
      playAudioChirp('wake');
      speak("I'm awake, I'm awake! Scanning venue perimeters.", '⚡ AERO ONLINE', 3500);
    }
    lastUserActivity = Date.now();
  }

  function fallAsleep() {
    if (isSleeping || isDragging || isBusyWithTrick) return;
    isSleeping = true;
    setEmotion('sleep');
    if (zzzBubbleEl) zzzBubbleEl.style.display = 'block';
    hideBubble();
  }

  // Playful Aerial Backflip / 360 Spin
  function doPlayfulTrick() {
    if (isBusyWithTrick) return;
    isBusyWithTrick = true;
    wakeUp();

    const svg = mascotEl.querySelector('.aero-core-svg');
    if (svg) {
      svg.classList.add('barrel-roll');
      playAudioChirp('whoosh');
      setEmotion('stars');

      setTimeout(() => {
        svg.classList.remove('barrel-roll');
        setEmotion('dizzy');
        playAudioChirp('blip');

        setTimeout(() => {
          setEmotion('happy');
          isBusyWithTrick = false;
          sayRandomWittyTip();
        }, 900);
      }, 750);
    }
  }

  // Point laser marker at a DOM element
  function flyAndPointAt(targetEl, text, emotion = 'pointing', duration = 5500) {
    if (!targetEl || !isEnabled) return;
    wakeUp();
    isBusyWithTrick = true;

    // Smooth scroll into view if offscreen
    const rInitial = targetEl.getBoundingClientRect();
    if (rInitial.top < 0 || rInitial.bottom > window.innerHeight) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    setTimeout(() => {
      const r = targetEl.getBoundingClientRect();
      const targetCenterX = r.left + r.width / 2;
      
      // Position Aero near target element within viewport bounds
      targetX = Math.min(window.innerWidth - 140, Math.max(20, targetCenterX - 63));
      targetY = Math.min(window.innerHeight - 150, Math.max(30, r.top - 80));
      if (targetY < 30) targetY = Math.min(window.innerHeight - 150, r.bottom + 15);

      if (laserPointerEl) {
        laserPointerEl.style.left = `${Math.min(window.innerWidth - 50, Math.max(10, r.left + r.width / 2 - 18))}px`;
        laserPointerEl.style.top = `${Math.min(window.innerHeight - 50, Math.max(10, r.top + r.height / 2 - 18))}px`;
        laserPointerEl.style.display = 'block';
      }

      setEmotion(emotion);
      playAudioChirp(emotion === 'alert' ? 'alert' : 'blip');
      speak(text, `🎯 TARGET: ${targetEl.id || 'INSPECTION'}`, duration);

      setTimeout(() => {
        if (laserPointerEl) laserPointerEl.style.display = 'none';
        isBusyWithTrick = false;
        // Return to home float station after duration
        targetX = window.innerWidth - 170;
        targetY = window.innerHeight - 230;
      }, duration + 500);
    }, 200);
  }

  // Autonomous Roaming ("Mind of Its Own")
  const AUTONOMOUS_DESTINATIONS = [
    {
      selector: '.sidebar-brand-card',
      text: "DELTA ENGINE Command Basecamp! All 5 operational scenarios registered & ready.",
      emotion: 'happy'
    },
    {
      selector: '#card-spatial-builder, #spatial-reconstruction-canvas',
      text: "Inspecting 2D CAD Blueprint... calibrated scale 20m × 30m = 600m² conforms with NFPA-101 egress rules!",
      emotion: 'pointing'
    },
    {
      selector: '#cctv-hud-canvas, .cctv-card',
      text: "Checking CCTV Perception Feed... turnstile headcount tracking active with zero frame drop!",
      emotion: 'thinking'
    },
    {
      selector: '#schedule-grid, .schedule-matrix-card',
      text: "Checking conference session grid... all speaker timeslots synchronized with deterministic solver.",
      emotion: 'wink'
    },
    {
      selector: '#autopilot-toggle-pill, #card-autopilot',
      text: "Tesla-grade autonomous autopilot is engaged — keeping venue safety locked in!",
      emotion: 'stars'
    }
  ];

  const WITTY_TIPS = [
    "Whoosh! Look at me fly! Drag me anywhere on screen if I'm in your way.",
    "Deterministic safety engine calculation SLA: < 0.1ms. Faster than a flash of lightning!",
    "Tip: Drag talk cards in the schedule grid to manually rebalance venue halls.",
    "Turing Hall is calibrated at 250 pax maximum capacity according to NFPA-101 life safety.",
    "Offline Field Mesh: Emergency SOS signals are queued offline if radio connectivity drops!",
    "Everything looking good, Commander! Coast is clear across all zones."
  ];

  let tipIndex = 0;
  function sayRandomWittyTip() {
    const tip = WITTY_TIPS[tipIndex % WITTY_TIPS.length];
    tipIndex++;
    speak(tip, '💡 AERO DISPATCH', 5000);
  }

  // Periodic Autonomous Mind (Every 10-15 seconds when idle)
  function startAutonomousMind() {
    if (autonomousActionTimer) clearInterval(autonomousActionTimer);
    autonomousActionTimer = setInterval(() => {
      if (!isEnabled || isDragging || isBusyWithTrick) return;

      const idleDuration = Date.now() - lastUserActivity;

      // If user has been away for > 30s, take a nap!
      if (idleDuration > 30000 && !isSleeping) {
        fallAsleep();
        return;
      }

      if (isSleeping) return;

      // 40% chance: fly to an interesting component on page
      // 30% chance: do an aerial barrel roll trick
      // 30% chance: say a fun operational tip
      const roll = Math.random();
      if (roll < 0.4) {
        const dest = AUTONOMOUS_DESTINATIONS[Math.floor(Math.random() * AUTONOMOUS_DESTINATIONS.length)];
        const el = document.querySelector(dest.selector);
        if (el) {
          flyAndPointAt(el, dest.text, dest.emotion, 4800);
        }
      } else if (roll < 0.7) {
        doPlayfulTrick();
      } else {
        sayRandomWittyTip();
        playAudioChirp('blip');
      }
    }, 12000);
  }

  // 60FPS Flight Physics Animation Loop
  function animateFlight() {
    if (!isDragging && mascotEl && isEnabled) {
      const dx = targetX - posX;
      const dy = targetY - posY;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        posX += dx * 0.14;
        posY += dy * 0.14;
        updatePosition(posX, posY);
      }
    }
    requestAnimationFrame(animateFlight);
  }

  // Listen to Real System Events
  function attachEventListeners() {
    // 1. Speaker Delay Simulation Click
    const btnDelay = document.getElementById('btn-simulate-delay');
    if (btnDelay) {
      btnDelay.addEventListener('click', () => {
        const grid = document.getElementById('schedule-grid');
        flyAndPointAt(grid || btnDelay, "⏱️ Speaker delay simulated! Scheduler Agent is reallocating the slot to an open hall.", 'thinking', 6000);
      });
    }

    // 2. Capacity Surge Simulation Click
    const btnSurge = document.getElementById('btn-simulate-surge');
    if (btnSurge) {
      btnSurge.addEventListener('click', () => {
        const cad = document.getElementById('cadCanvas') || btnSurge;
        flyAndPointAt(cad, "⚠️ Capacity surge alert! Logistics Agent opening East Overflow Park & releasing barricades.", 'alert', 6000);
      });
    }

    // 3. Hovering CAD Blueprint
    const cadCanvas = document.getElementById('cadCanvas');
    if (cadCanvas) {
      cadCanvas.addEventListener('mouseenter', () => {
        if (!isBusyWithTrick && Math.random() > 0.6) {
          speak("2D CAD Blueprint: 20m × 30m = 600m² | Primary life-safety egress corridor verified.", '📐 CAD ARCHITECTURE', 4000);
        }
      });
    }

    // 4. WebSocket Events
    window.addEventListener('message', (e) => {
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d && d.type === 'SCHEDULE_HEALED') {
          wakeUp();
          setEmotion('stars');
          playAudioChirp('celebrate');
          speak("🎉 Self-Healing Complete! All agenda constraints optimized with zero crowd friction.", '✨ RESOLVED', 5500);
        }
      } catch (_) {}
    });
  }

  // Global Mascot Controller
  window.deltaMascot = {
    speak(msg, duration = 5000) {
      wakeUp();
      speak(msg, '🤖 AERO CO-PILOT', duration);
      playAudioChirp('blip');
    },
    pointAt(el, msg, emotion = 'pointing') {
      flyAndPointAt(el, msg, emotion);
    },
    trick() {
      doPlayfulTrick();
    },
    toggle() {
      isEnabled = !isEnabled;
      localStorage.setItem(STORAGE_KEY, isEnabled ? 'true' : 'false');
      if (mascotEl) mascotEl.style.display = isEnabled ? 'block' : 'none';
      if (speechBubbleEl) speechBubbleEl.style.display = isEnabled ? 'block' : 'none';
      if (!isEnabled) {
        if (zzzBubbleEl) zzzBubbleEl.style.display = 'none';
        if (laserPointerEl) laserPointerEl.style.display = 'none';
        if (speechDismissTimer) clearTimeout(speechDismissTimer);
      }
      const lbl = document.getElementById('lbl-mascot-toggle');
      if (lbl) lbl.textContent = isEnabled ? 'AI Mascot: ON' : 'AI Mascot: OFF';
      if (isEnabled) {
        wakeUp();
        speak("Aero reporting for duty! All systems nominal.", '🤖 AERO ONLINE', 4000);
        playAudioChirp('celebrate');
      }
      return isEnabled;
    },
    onSwarmRebuildComplete() {
      // Called when Swarm Rebuild finishes constructing the page
      if (!isEnabled) return;
      setTimeout(() => {
        wakeUp();
        setEmotion('stars');
        playAudioChirp('celebrate');
        speak("🚀 Mission Ready! Every component has been assembled. Welcome back to DELTAengine, Commander!", '✨ SYSTEMS BUILT', 6000);
        doPlayfulTrick();
      }, 950);
    }
  };

  // Boot on Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupDOM();
      attachEventListeners();
      startAutonomousMind();
      requestAnimationFrame(animateFlight);
    });
  } else {
    setupDOM();
    attachEventListeners();
    startAutonomousMind();
    requestAnimationFrame(animateFlight);
  }
})();
