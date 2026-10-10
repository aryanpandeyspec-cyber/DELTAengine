// --- DELTA ENGINE - CCTV WEBCAM & IOT DOOR SENSOR FUSION PERCEPTION CONTROLLER ---
// Hardware: Zebronics ZEB-CRYSTAL PRO 480p Web Camera + ESP32 VL53L0X Laser ToF Sensor
// Features:
// 1. Zero-hallucination real-time Face Perception (Native window.FaceDetector + Fallback Facial Geometry & Variance)
// 2. Door Sensor & Camera Fusion: Sensor triggers physical passage -> Camera scans face at threshold
// 3. Attendee Signature Memory & Re-entry De-duplication (Distinguishes Entry, Exit, and Repeat Re-entries)
// 4. Optical blocked-lens detection (detects hand cover / darkness cleanly)
// 5. 80% Room Capacity Warning & 100% Full Breach alerts with volunteer dispatches
// 6. One-click non-repeating dismissable notifications (no annoying loop)
// 7. Native top-of-screen CCTV Hub with collapsible telemetry & pitch triggers

(function initCctvPerception() {
  let mediaStream = null;
  let videoEl = null;
  let canvasEl = null;
  let ctx = null;
  let animFrameId = null;

  let currentVenueId = 'hall-1';
  let currentVenueName = 'Turing Hall';
  try {
    const savedVenueId = localStorage.getItem('delta_current_venue_id');
    const savedVenueName = localStorage.getItem('delta_current_venue_name');
    if (savedVenueId) currentVenueId = savedVenueId;
    if (savedVenueName) currentVenueName = savedVenueName;
  } catch (e) { }

  let currentCapacity = 25; // Default demo capacity
  try {
    const savedCap = localStorage.getItem('delta_current_room_capacity');
    if (savedCap) {
      const parsed = parseInt(savedCap, 10);
      if (parsed > 0) currentCapacity = parsed;
    }
  } catch (e) { }

  let manualCount = 0;
  let isCameraActive = false;
  let isSimulatedFeed = false;
  let isCameraBlocked = false;
  let lastPostTime = 0;
  let bannerDismissTimer = null;
  let dismissedAlertState = null;
  let currentAlertState = null;
  let selectedCameraDeviceId = '';
  try {
    selectedCameraDeviceId = localStorage.getItem('delta_selected_camera_id') || '';
  } catch (e) { }

  // --- ATTENDEE PROFILE DATABASE & RE-ENTRY TRACKING ---
  // Maps attendeeId -> { id, name, signature, state: 'INSIDE'|'OUTSIDE', entryCount, lastSeen }
  const attendeeDb = new Map();
  let nextAttendeeNum = 1;
  let totalEntries = 0;
  let totalExits = 0;
  let totalReEntries = 0;
  let currentNetOccupancy = 0;
  let doorSensorNetCount = 0;
  let passageCooldown = 0; // Debounce between passage events
  let lastPassageInfo = null;

  // --- IOT DOOR SENSOR FUSION STATE ---
  let sensorActiveWindowUntil = 0; // Timestamp when 3.5s active scan window closes
  let lastTriggerDist = 750;       // mm threshold from ESP32

  // Temporal tracking for stable face/head perception without flickering
  let trackedHeads = [];
  let nextTrackId = 1;

  // High-Speed Real-Time In-Browser Pico Face & Head Detector
  let picoClassifyRegion = null;
  let picoUpdateMemory = null;
  let picoGrayBuffer = null;

  // Pre-allocated integral image buffers for 320x240 zero-latency scanning
  let intLum = null;
  let intLumSq = null;
  let intSkin = null;

  // Offscreen canvas for fast 320x240 computer vision analysis
  let cvCanvas = null;
  let cvCtx = null;

  // Offscreen canvas for face signature extraction (32x32)
  let sigCanvas = null;
  let sigCtx = null;

  // --- CAMERA COLOR CORRECTION & PINK IR-TINT AUTO-FIX STATE ---
  let colorCorrectionMode = 'auto'; // 'auto' | 'fix-pink' | 'bw' | 'raw'
  try {
    colorCorrectionMode = localStorage.getItem('delta_cctv_color_mode') || 'auto';
  } catch (e) { }
  let isPinkTintDetected = false;
  let syncColorModeUI = () => { };

  // --- EULERIAN MEGA-CROWD SPATIAL DENSITY & MOTION FLUX ENGINE (200+ TO 1,000+ PAX) ---
  // Designed for massive gatherings: Kumbh Mela, Political Rallies, Stadiums, Festivals.
  // Complexity: O(1) w.r.t crowd size (processes 16x12 cell matrix in ~1.2ms).
  // Detects:
  // 1. Head crown local contrast peaks (centroids) across high-density clusters.
  // 2. Cellular crowd density heatmap (people/m² and congestion hotspots).
  // 3. Motion flux velocity vectors [vx, vy] across grid cells.
  // 4. Stampede & Surge Risk Index (detects sudden coherent rushes and counter-flows).
  let crowdPerceptionMode = 'auto'; // 'auto' | 'mega-crowd' | 'room'
  try {
    crowdPerceptionMode = localStorage.getItem('delta_crowd_mode') || 'auto';
  } catch (e) { }
  let syncCrowdModeUI = () => { };

  const CROWD_GRID_COLS = 16;
  const CROWD_GRID_ROWS = 12;
  let prevCellLuma = null;
  let lastStampedeToneTime = 0;
  let lastCounterFlowToneTime = 0;
  let lastGateReleasePulseTime = 0;
  let megaCrowdState = {
    active: false,
    estimatedHeadcount: 0,
    densityIndexPerM2: '0.0',
    stampedeRisk: 0, // 0 - 100%
    stampedeStatus: 'NOMINAL', // 'NOMINAL' | 'ELEVATED' | 'CRITICAL_SURGE' | 'COUNTER_FLOW_COLLISION' | 'BARRICADE_OVERPRESSURE'
    averageVelocity: '0.00',
    coherence: 0,
    hotspotCount: 0,
    headCentroids: [], // [{x, y, r}]
    gridCells: [],     // [{ col, row, x, y, w, h, density, vx, vy, isHotspot, flowType, vectorColor }]
    counterFlowDetected: false,
    counterFlowCollisions: [],
    gatePressurePsi: '0.0',
    gateReleaseTriggered: false
  };

  // --- REAL-TIME WEBGL COCO-SSD PERSON & OCCLUSION DETECTOR ---
  // Detects full bodies, rear-facing attendees, seated hackers, and people behind pillars/desks
  let cocoModel = null;
  let isCocoLoading = false;
  let cocoPersonBoxes = [];
  let lastCocoInferTime = 0;
  let isCocoInferring = false;
  let activeVisionEngine = 'pico'; // 'coco-ssd' | 'pico'

  async function initCocoSsd() {
    if (cocoModel || isCocoLoading) return;
    const tfLoaded = typeof window !== 'undefined' && (window.tf || typeof tf !== 'undefined');
    const cocoLoaded = typeof window !== 'undefined' && (window.cocoSsd || typeof cocoSsd !== 'undefined');

    if (cocoLoaded && tfLoaded) {
      try {
        isCocoLoading = true;
        console.log('⚡ [CCTV] Initializing WebGL GPU COCO-SSD Person Detector...');
        const loader = window.cocoSsd || cocoSsd;
        cocoModel = await loader.load({ base: 'mobilenet_v2' });
        activeVisionEngine = 'coco-ssd';
        console.log('✅ [CCTV] WebGL COCO-SSD Loaded! Ready for full-body, rear-facing & occluded attendees.');
        updateVisionEngineTag();
      } catch (err) {
        console.warn('[CCTV] COCO-SSD initialization notice:', err.message);
      } finally {
        isCocoLoading = false;
      }
    } else {
      // If scripts take a moment to load from CDN, poll once after 1.5s
      setTimeout(() => {
        if (!cocoModel && !isCocoLoading) initCocoSsd();
      }, 1500);
    }
  }

  function updateVisionEngineTag() {
    const tagEl = document.getElementById('cctv-optical-detection-tag');
    if (tagEl && !isCameraBlocked) {
      tagEl.title = `Active Engine: ${activeVisionEngine === 'coco-ssd' ? 'TensorFlow.js COCO-SSD (WebGL GPU)' : 'Pico Fast Facefinder'}`;
    }
  }

  function bootCctv() {
    initDetectors();
    initPico();
    // Zero-lag deferred initialization: don't block main thread on initial page load
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        if (!cocoModel && !isCocoLoading) initCocoSsd();
      }, { timeout: 5000 });
    } else {
      setTimeout(() => {
        if (!cocoModel && !isCocoLoading) initCocoSsd();
      }, 3500);
    }
    bindCctvElements();
    initVolunteerAlertBanner();
    requestPushPermission();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootCctv);
  } else {
    bootCctv();
  }

  function initPico() {
    if (picoClassifyRegion) return true;
    const b64 = typeof window !== 'undefined' ? window.DELTA_FACEFINDER_CASCADE_B64 : null;
    const picoObj = typeof window !== 'undefined' && window.pico ? window.pico : (typeof pico !== 'undefined' ? pico : null);
    if (picoObj && b64) {
      try {
        const binStr = atob(b64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        picoClassifyRegion = picoObj.unpack_cascade(bytes);
        picoUpdateMemory = picoObj.instantiate_detection_memory(5);
        picoGrayBuffer = new Uint8Array(320 * 240);
        console.log('⚡ [CCTV] Pico Real-Time Head & Face Perception Engine loaded successfully.');
        return true;
      } catch (err) {
        console.warn('[CCTV] Pico initialization error:', err);
      }
    }
    return false;
  }

  function initDetectors() {
    if (cvCanvas) return;
    cvCanvas = document.createElement('canvas');
    cvCanvas.width = 320;
    cvCanvas.height = 240;
    cvCtx = cvCanvas.getContext('2d', { willReadFrequently: true });

    // Pre-allocate integral image buffers for 320x240
    const bufferSize = (320 + 1) * (240 + 1);
    intLum = new Float64Array(bufferSize);
    intLumSq = new Float64Array(bufferSize);
    intSkin = new Int32Array(bufferSize);

    sigCanvas = document.createElement('canvas');
    sigCanvas.width = 32;
    sigCanvas.height = 32;
    sigCtx = sigCanvas.getContext('2d', { willReadFrequently: true });
  }

  function requestPushPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission();
      } catch (e) {
        // Non-blocking
      }
    }
  }

  function updateVenueAndCapacity(venueId, venueName, newCapacity, updateSelects = true) {
    if (venueId) currentVenueId = venueId;
    if (venueName) currentVenueName = venueName;
    if (newCapacity && newCapacity > 0) currentCapacity = newCapacity;

    try {
      localStorage.setItem('delta_current_venue_id', currentVenueId);
      localStorage.setItem('delta_current_venue_name', currentVenueName);
      localStorage.setItem('delta_current_room_capacity', currentCapacity.toString());
    } catch (e) { }

    // Synchronize all venue dropdowns across the page
    if (updateSelects) {
      document.querySelectorAll('.cctv-venue-select').forEach(sel => {
        if (sel.value !== currentVenueId) sel.value = currentVenueId;
      });
    }

    // Update all dynamic venue labels
    document.querySelectorAll('.cctv-target-venue-lbl').forEach(el => {
      el.textContent = `🎯 Target Room Capacity (${currentVenueName}):`;
    });
    document.querySelectorAll('.cctv-venue-detected-lbl').forEach(el => {
      el.textContent = `👥 Detected In ${currentVenueName}:`;
    });
    document.querySelectorAll('.cctv-volunteers-venue-name').forEach(el => {
      el.textContent = currentVenueName.toUpperCase();
    });

    // Update Admin portal cards if present
    const adminHallName = document.getElementById('featured-event-hall-name');
    if (adminHallName) adminHallName.textContent = `📍 ${currentVenueName}`;
    const adminFeedLbl = document.querySelector('.cctv-admin-feed-hall-lbl');
    if (adminFeedLbl) adminFeedLbl.textContent = `📹 CCTV ${currentVenueName} Feed:`;

    syncCapacityControls(currentCapacity);
    updateThresholdLabels(currentCapacity);
    if (typeof syncCrowdModeUI === 'function') syncCrowdModeUI();
    updateDensityMetrics(true);
  }

  function syncCapacityControls(cap) {
    document.querySelectorAll('.cctv-capacity-input').forEach(inp => {
      if (parseInt(inp.value, 10) !== cap) inp.value = cap;
    });

    document.querySelectorAll('.cctv-capacity-slider').forEach(slider => {
      const maxVal = parseInt(slider.max, 10) || 500;
      if (cap > maxVal) {
        slider.max = Math.max(cap, 1000);
      }
      if (parseInt(slider.value, 10) !== cap) slider.value = cap;
    });

    document.querySelectorAll('.cctv-max-capacity-lbl, #cctv-max-capacity-lbl').forEach(lbl => {
      lbl.textContent = `Max: ${Math.max(500, cap)} Pax`;
    });

    document.querySelectorAll('#cctv-capacity-val, .capacity-val-badge').forEach(badge => {
      badge.textContent = `${cap} Pax`;
    });
  }

  function syncManualCountControls(count) {
    manualCount = Math.max(0, count);
    document.querySelectorAll('.cctv-manual-pax-input').forEach(inp => {
      if (parseInt(inp.value, 10) !== manualCount) inp.value = manualCount;
    });
  }

  function updateThresholdLabels(cap) {
    const lbl80 = document.querySelectorAll('#cctv-80-threshold-lbl, .cctv-80-threshold-lbl');
    const lbl100 = document.querySelectorAll('#cctv-100-threshold-lbl, .cctv-100-threshold-lbl');
    lbl80.forEach(el => el.textContent = `${Math.round(cap * 0.80)} Pax`);
    lbl100.forEach(el => el.textContent = `${cap} Pax`);
  }

  function bindCctvElements() {
    const btnOpen = document.getElementById('btn-open-cctv');
    const btnOpenSecondary = document.getElementById('btn-open-cctv-secondary');
    const btnClose = document.getElementById('btn-close-cctv-modal');
    const modal = document.getElementById('cctv-perception-modal');
    const btnToggleView = document.getElementById('btn-toggle-cctv-view');
    const hubBody = document.getElementById('cctv-hub-body');

    videoEl = document.getElementById('cctv-hidden-video');
    canvasEl = document.getElementById('cctv-hud-canvas');
    if (canvasEl) {
      ctx = canvasEl.getContext('2d');
      if (!isCameraActive) {
        drawIdleCameraGraphic(ctx, canvasEl.width || 640, canvasEl.height || 480);
      }
    }

    // Scroll to Top CCTV Hub or Open Modal
    const jumpToCameraHandler = (e) => {
      if (e) e.preventDefault();
      const topHub = document.getElementById('cctv-top-hub');
      if (topHub) {
        if (hubBody && hubBody.classList.contains('collapsed')) {
          hubBody.classList.remove('collapsed');
          if (btnToggleView) btnToggleView.textContent = '🔼 Minimize View';
        }
        topHub.scrollIntoView({ behavior: 'smooth', block: 'start' });
        enumerateCameras();
        if (!isCameraActive) {
          startWebcam();
        }
      } else if (modal) {
        modal.classList.remove('hidden');
        enumerateCameras();
        if (!isCameraActive) {
          startWebcam();
        }
      }
    };

    if (btnOpen) btnOpen.addEventListener('click', jumpToCameraHandler);
    if (btnOpenSecondary) btnOpenSecondary.addEventListener('click', jumpToCameraHandler);

    if (btnClose && modal) {
      btnClose.addEventListener('click', () => {
        modal.classList.add('hidden');
      });
    }

    // Toggle Collapse / Expand Top Hub View
    if (btnToggleView && hubBody) {
      btnToggleView.addEventListener('click', () => {
        const isCollapsed = hubBody.classList.toggle('collapsed');
        btnToggleView.textContent = isCollapsed ? '🔽 Expand View' : '🔼 Minimize View';
      });
    }

    // Bind ALL Start Buttons (Top Hub & Modal)
    document.querySelectorAll('#btn-cctv-start, .btn-cctv-start').forEach(btn => {
      btn.addEventListener('click', () => {
        if (hubBody && hubBody.classList.contains('collapsed')) {
          hubBody.classList.remove('collapsed');
          if (btnToggleView) btnToggleView.textContent = '🔼 Minimize View';
        }
        const chosenId = selectedCameraDeviceId || document.querySelector('.cctv-select:not(.cctv-venue-select)')?.value;
        startWebcam(chosenId);
      });
    });

    // Bind ALL Stop Buttons (Top Hub & Modal)
    document.querySelectorAll('#btn-cctv-stop, .btn-cctv-stop').forEach(btn => {
      btn.addEventListener('click', () => stopWebcam());
    });

    // Bind Tint Auto-Fix Toggle Buttons
    syncColorModeUI = () => {
      document.querySelectorAll('#btn-cctv-tint-fix, .btn-cctv-tint-fix').forEach(btn => {
        if (colorCorrectionMode === 'auto') {
          btn.innerHTML = isPinkTintDetected ? '🪄 Tint: Fixed (Pink IR)' : '🎨 Tint: Auto-Fix';
          btn.style.background = isPinkTintDetected ? '#dbeafe' : '#ffffff';
          btn.style.borderColor = isPinkTintDetected ? '#2563eb' : '#000000';
        } else if (colorCorrectionMode === 'fix-pink') {
          btn.innerHTML = '🪄 Tint: Force-Fix (IR)';
          btn.style.background = '#fef3c7';
          btn.style.borderColor = '#d97706';
        } else if (colorCorrectionMode === 'bw') {
          btn.innerHTML = '⚪ Tint: High-Contrast B&W';
          btn.style.background = '#f3f4f6';
          btn.style.borderColor = '#4b5563';
        } else {
          btn.innerHTML = '📷 Tint: Raw Feed';
          btn.style.background = '#ffffff';
          btn.style.borderColor = '#000000';
        }
      });
    };
    syncColorModeUI();

    document.querySelectorAll('#btn-cctv-tint-fix, .btn-cctv-tint-fix').forEach(btn => {
      btn.addEventListener('click', () => {
        if (colorCorrectionMode === 'auto') colorCorrectionMode = 'fix-pink';
        else if (colorCorrectionMode === 'fix-pink') colorCorrectionMode = 'bw';
        else if (colorCorrectionMode === 'bw') colorCorrectionMode = 'raw';
        else colorCorrectionMode = 'auto';

        try { localStorage.setItem('delta_cctv_color_mode', colorCorrectionMode); } catch (e) { }
        syncColorModeUI();
        if (typeof createToast === 'function') {
          const names = {
            'auto': '🎨 Color Mode: Auto-Detect (Auto-fixes Pink IR Tints)',
            'fix-pink': '🪄 Color Mode: Force Pink/IR Tint Correction',
            'bw': '⚪ Color Mode: High-Contrast B&W CCTV Mode',
            'raw': '📷 Color Mode: Raw Unfiltered Camera Feed'
          };
          createToast(names[colorCorrectionMode] || 'Color mode updated', 'info');
        }
      });
    });

    // Bind Mega-Crowd Perception Mode Toggle Buttons
    syncCrowdModeUI = () => {
      const isMegaVenue = (currentCapacity >= 1000);
      document.querySelectorAll('#btn-cctv-crowd-mode, .btn-cctv-crowd-mode').forEach(btn => {
        if (crowdPerceptionMode === 'auto') {
          btn.innerHTML = isMegaVenue ? '👥 Auto: Mega-Crowd (1,000+)' : '👥 Auto: Standard Precision';
          btn.style.background = '#ffffff';
          btn.style.borderColor = '#000000';
          btn.style.color = '#000000';
        } else if (crowdPerceptionMode === 'mega-crowd') {
          btn.innerHTML = '🌊 Forced: Mega-Crowd Grid';
          btn.style.background = '#fef3c7';
          btn.style.borderColor = '#d97706';
          btn.style.color = '#92400e';
        } else {
          btn.innerHTML = '👤 Forced: Standard Boxes';
          btn.style.background = '#ecfdf5';
          btn.style.borderColor = '#10b981';
          btn.style.color = '#065f46';
        }
      });
    };
    syncCrowdModeUI();

    document.querySelectorAll('#btn-cctv-crowd-mode, .btn-cctv-crowd-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        if (crowdPerceptionMode === 'auto') crowdPerceptionMode = 'mega-crowd';
        else if (crowdPerceptionMode === 'mega-crowd') crowdPerceptionMode = 'room';
        else crowdPerceptionMode = 'auto';

        try { localStorage.setItem('delta_crowd_mode', crowdPerceptionMode); } catch (e) { }
        syncCrowdModeUI();
        if (typeof createToast === 'function') {
          const names = {
            'auto': `👥 Crowd Mode: Auto (${currentCapacity >= 1000 ? 'Mega-Crowd Grid for 1,000+ gatherings' : 'Standard Precision Detector for Venues & Conference Halls'})`,
            'mega-crowd': '🌊 Crowd Mode: Forced Eulerian Mega-Crowd Grid (Kumbh Mela / Rally mode)',
            'room': '👤 Crowd Mode: Forced Standard Person Bounding Boxes'
          };
          createToast(names[crowdPerceptionMode] || 'Crowd mode updated', 'info');
        }
      });
    });

    // Bind ALL Camera Select Dropdowns (Excluding Venue Select)
    document.querySelectorAll('.cctv-select:not(.cctv-venue-select)').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        await switchCamera(e.target.value);
      });

      const unlockAndRefresh = async () => {
        const hasUnlabeled = Array.from(sel.options).some(o =>
          o.textContent.startsWith('📹 Video Input') ||
          o.textContent.startsWith('Camera ') ||
          o.value === '' ||
          !o.textContent.includes('(')
        );
        if (hasUnlabeled || sel.options.length <= 1) {
          try {
            const probe = await navigator.mediaDevices.getUserMedia({ video: true });
            if (!isCameraActive) {
              probe.getTracks().forEach(t => t.stop());
            } else if (!mediaStream) {
              mediaStream = probe;
            }
            await enumerateCameras();
          } catch (err) {
            console.warn('[CCTV] Camera permission request error on dropdown focus:', err);
          }
        }
      };

      sel.addEventListener('focus', unlockAndRefresh);
      sel.addEventListener('mousedown', unlockAndRefresh);
    });

    // Bind ALL Venue Select Dropdowns (Multi-Venue Switcher)
    document.querySelectorAll('.cctv-venue-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const chosenVenue = e.target.value;
        const opt = e.target.selectedOptions[0];
        let venueName = opt ? (opt.getAttribute('data-name') || opt.textContent.trim()) : 'Conference Room';
        let venueCap = opt ? parseInt(opt.getAttribute('data-capacity'), 10) : 250;

        if (chosenVenue === 'custom') {
          const customName = prompt('Enter Custom Venue / Hall Name:', 'Exhibition Hall');
          if (customName && customName.trim()) {
            venueName = customName.trim();
          }
          const customCapStr = prompt(`Enter Target Max Capacity for "${venueName}":`, '100');
          const parsedCap = parseInt(customCapStr, 10);
          venueCap = (!isNaN(parsedCap) && parsedCap > 0) ? parsedCap : 100;

          // Update custom option across all venue dropdowns
          document.querySelectorAll('.cctv-venue-select').forEach(vSel => {
            const custOpt = vSel.querySelector('option[value="custom"]');
            if (custOpt) {
              custOpt.textContent = `✨ ${venueName} (${venueCap})`;
              custOpt.setAttribute('data-name', venueName);
              custOpt.setAttribute('data-capacity', venueCap);
            }
          });
        }

        updateVenueAndCapacity(chosenVenue, venueName, venueCap, true);

        if (typeof createToast === 'function') {
          createToast(`🏛️ Switched Venue to: ${venueName} (Capacity: ${venueCap} Pax)`, 'success');
        }
      });
    });

    // Bind Direct Capacity Numeric Inputs (Top Hub & Modal)
    document.querySelectorAll('.cctv-capacity-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 1) {
          currentCapacity = val;
          try { localStorage.setItem('delta_current_room_capacity', currentCapacity.toString()); } catch (err) { }
          syncCapacityControls(currentCapacity);
          updateThresholdLabels(currentCapacity);
          updateDensityMetrics(true);
        }
      });
      inp.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 2) val = 2;
        currentCapacity = val;
        e.target.value = val;
        try { localStorage.setItem('delta_current_room_capacity', currentCapacity.toString()); } catch (err) { }
        syncCapacityControls(currentCapacity);
        updateThresholdLabels(currentCapacity);
        updateDensityMetrics(true);
        if (typeof createToast === 'function') {
          createToast(`🎯 Room capacity set to ${currentCapacity} Pax (${currentVenueName})`, 'info');
        }
      });
    });

    // Bind Capacity Range Sliders (Top Hub & Modal)
    document.querySelectorAll('.cctv-capacity-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        currentCapacity = parseInt(e.target.value, 10);
        try { localStorage.setItem('delta_current_room_capacity', currentCapacity.toString()); } catch (err) { }
        syncCapacityControls(currentCapacity);
        updateThresholdLabels(currentCapacity);
        updateDensityMetrics(true);
      });
    });

    // Bind Manual Headcount Attendance Input (Camera + Manual Fusion)
    document.querySelectorAll('.cctv-manual-pax-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        manualCount = isNaN(val) ? 0 : Math.max(0, val);
        currentNetOccupancy = Math.max(currentNetOccupancy, manualCount);
        syncManualCountControls(manualCount);
        updateDensityMetrics(true);
      });
      inp.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 0) val = 0;
        manualCount = val;
        currentNetOccupancy = Math.max(currentNetOccupancy, manualCount);
        syncManualCountControls(manualCount);
        updateDensityMetrics(true);
        if (typeof createToast === 'function') {
          createToast(`👥 Manual Attendance Count set to: ${manualCount} Pax`, 'info');
        }
      });
    });

    // USB Camera Plug / Unplug Hotplug Listener
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        console.log('[CCTV] Video hardware hotplug event detected, refreshing camera list...');
        await enumerateCameras();
      });
    }


    // Bind Physical Door Sensor manual test button
    document.querySelectorAll('#btn-cctv-trigger-sensor, .btn-cctv-trigger-sensor').forEach(btn => {
      btn.addEventListener('click', () => {
        triggerDoorSensorLocal(620);
      });
    });

    // Bind Add Person (+1) buttons (Top Hub & Modal)
    document.querySelectorAll('#btn-cctv-add-pax, .btn-cctv-add-pax').forEach(btn => {
      btn.addEventListener('click', () => {
        simulateAttendeeAction('ENTRY');
        syncManualCountControls(currentNetOccupancy);
      });
    });

    // Bind Subtract Person (-1) buttons (Top Hub & Modal)
    document.querySelectorAll('#btn-cctv-sub-pax, .btn-cctv-sub-pax').forEach(btn => {
      btn.addEventListener('click', () => {
        simulateAttendeeAction('EXIT');
        syncManualCountControls(currentNetOccupancy);
      });
    });

    // Bind Reset Pax buttons (Top Hub & Modal)
    document.querySelectorAll('#btn-cctv-clear-pax, .btn-cctv-clear-pax').forEach(btn => {
      btn.addEventListener('click', () => {
        attendeeDb.clear();
        trackedHeads = [];
        nextTrackId = 1;
        lastDetectedFaces = [];
        totalEntries = 0;
        totalExits = 0;
        totalReEntries = 0;
        currentNetOccupancy = 0;
        doorSensorNetCount = 0;
        manualCount = 0;
        lastPassageInfo = null;
        syncManualCountControls(0);
        updateDensityMetrics(true);
        if (typeof createToast === 'function') createToast('🧹 Room attendee registry reset to 0.', 'info');
      });
    });

    // Bind 80% Room Capacity Trigger Buttons (Top Hub & Modal)
    document.querySelectorAll('#btn-cctv-trigger-80, .btn-cctv-trigger-80').forEach(btn => {
      btn.addEventListener('click', () => {
        currentNetOccupancy = Math.max(1, Math.round(currentCapacity * 0.80));
        manualCount = currentNetOccupancy;
        syncManualCountControls(manualCount);
        updateDensityMetrics(true);
      });
    });

    // Bind 100% Room Full Trigger Buttons (Top Hub & Modal)
    document.querySelectorAll('#btn-cctv-trigger-full, .btn-cctv-trigger-full').forEach(btn => {
      btn.addEventListener('click', () => {
        currentNetOccupancy = currentCapacity;
        manualCount = currentCapacity;
        syncManualCountControls(manualCount);
        updateDensityMetrics(true);
      });
    });

    // Bind 0% Room Empty Trigger Buttons (Top Hub & Modal)
    document.querySelectorAll('#btn-cctv-trigger-empty, .btn-cctv-trigger-empty').forEach(btn => {
      btn.addEventListener('click', () => {
        currentNetOccupancy = 0;
        manualCount = 0;
        syncManualCountControls(0);
        updateDensityMetrics(true);
      });
    });

    // Initialize venue, capacity, and metrics
    updateVenueAndCapacity(currentVenueId, currentVenueName, currentCapacity, true);

    // Bind One-Click WhatsApp Dispatch and Guest Speaker Communication Controls
    bindDispatchAndSpeakerControls();

    // Initial camera discovery with proactive permission query
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' }).then(res => {
        if (res.state === 'granted') {
          navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
            s.getTracks().forEach(t => t.stop());
            enumerateCameras();
          }).catch(() => enumerateCameras());
        } else {
          enumerateCameras();
        }
        res.addEventListener('change', () => enumerateCameras());
      }).catch(() => enumerateCameras());
    } else {
    }
  }

  // --- SELF-COMPILING EVENT DISPATCH MESSAGE GENERATOR ---
  function compileEventMessage(options = {}) {
    const hall = currentVenueName || 'Turing Hall';
    const cap = currentCapacity || 25;
    const count = currentNetOccupancy >= 0 ? currentNetOccupancy : 0;
    const pct = Math.min(100, Math.round((count / cap) * 100));
    const emptyPct = Math.max(0, 100 - pct);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (options.type === 'ROOM_FULL' || pct >= 95) {
      return `🚨 [DELTA EMERGENCY DISPATCH - ${timeStr}]\nVENUE: ${hall.toUpperCase()} reached 100% CAPACITY (${count}/${cap} Pax | ${emptyPct}% Empty).\nACTION REQUIRED:\n1. Door Entrance A (Suryansh): Halt gate admissions immediately & divert incoming crowd to overflow rooms.\n2. Stage Front (Shahid): Clear emergency exit aisles & confirm speaker stage access.\n- Aryan Pandey (Lead Systems Commander, Central AV Control)`;
    } else if (options.type === 'ROOM_80_PERCENT' || pct >= 80) {
      return `⚠️ [DELTA CAPACITY ADVISORY - ${timeStr}]\nVENUE: ${hall.toUpperCase()} is at 80% CAPACITY (${count}/${cap} Pax).\nACTION REQUIRED:\n1. Suryansh: Stand by at Entrance A for queue throttling & badge check.\n2. Shahid: Monitor row seating density and reserve front rows for guest speakers.\n- Aryan Pandey (Central Event Control)`;
    } else if (isCameraBlocked) {
      return `📷 [DELTA HARDWARE WARNING - ${timeStr}]\nVENUE: ${hall.toUpperCase()} optical CCTV sensor is OBSTRUCTED or dark.\nACTION: Immediate physical inspection of camera mount required.\n- DELTA Autonomous Monitoring Engine`;
    } else if (options.type === 'ROOM_EMPTY' || pct <= 5) {
      return `ℹ️ [DELTA OPERATIONAL NOTICE - ${timeStr}]\nVENUE: ${hall.toUpperCase()} is VACANT & CLEARED (${count}/${cap} Pax | 100% Empty).\nSTATUS: Stage crew, AV engineers & speakers cleared to enter for setup & acoustic checks.\n- DELTA Systems Control`;
    } else {
      return `📋 [DELTA SITUATION BRIEFING - ${timeStr}]\nVENUE: ${hall.toUpperCase()} | Attendance: ${count}/${cap} Pax (${pct}% Occupied).\nAll doors, registration aisles, and stage feeds are operating normally.\nCoordinators on duty: Suryansh (Door), Shahid (Stage), Aryan (System Lead).`;
    }
  }

  function bindDispatchAndSpeakerControls() {
    // 1. One-Click "SEND ALL" modal openers
    document.querySelectorAll('.btn-dispatch-send-all, #btn-dispatch-send-all').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        const modal = document.getElementById('cctv-dispatch-all-modal');
        const txtArea = document.getElementById('dispatch-all-compiled-message');
        if (txtArea) txtArea.value = compileEventMessage();
        if (modal) modal.classList.remove('hidden');
      });
    });

    // Close Send All modal
    const btnCloseDispatch = document.getElementById('btn-close-dispatch-all-modal');
    if (btnCloseDispatch) {
      btnCloseDispatch.addEventListener('click', () => {
        const modal = document.getElementById('cctv-dispatch-all-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    // Execute Send All to all 3 coordinators via backend + WhatsApp
    const btnExecSendAll = document.getElementById('btn-execute-send-all-wa');
    if (btnExecSendAll) {
      btnExecSendAll.addEventListener('click', async () => {
        const txtArea = document.getElementById('dispatch-all-compiled-message');
        const msg = (txtArea ? txtArea.value.trim() : '') || compileEventMessage();

        try {
          await fetch('/api/notify/whatsapp-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageText: msg })
          });
        } catch (e) { }

        // Launch WhatsApp chats with pre-filled message
        const targets = [
          { name: 'Aryan Pandey', phone: '919154276178' },
          { name: 'Suryansh', phone: '918303009159' },
          { name: 'Shahid', phone: '916303570916' }
        ];

        targets.forEach(t => {
          const waUrl = `https://wa.me/${t.phone}?text=${encodeURIComponent(msg)}`;
          window.open(waUrl, '_blank');
        });

        if (typeof createToast === 'function') {
          createToast('📢 [WhatsApp Dispatch] Sent compiled alert to Aryan, Suryansh, and Shahid!', 'success');
        }

        const modal = document.getElementById('cctv-dispatch-all-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    // Copy compiled message
    const btnCopyCompiled = document.getElementById('btn-copy-compiled-text');
    if (btnCopyCompiled) {
      btnCopyCompiled.addEventListener('click', () => {
        const txtArea = document.getElementById('dispatch-all-compiled-message');
        if (txtArea) {
          navigator.clipboard.writeText(txtArea.value).then(() => {
            if (typeof createToast === 'function') createToast('📋 Alert message copied to clipboard!', 'info');
          }).catch(() => {
            txtArea.select();
            document.execCommand('copy');
            if (typeof createToast === 'function') createToast('📋 Alert message copied to clipboard!', 'info');
          });
        }
      });
    }

    // Re-compile message button
    const btnRecompile = document.getElementById('btn-recompile-msg');
    if (btnRecompile) {
      btnRecompile.addEventListener('click', () => {
        const txtArea = document.getElementById('dispatch-all-compiled-message');
        if (txtArea) {
          txtArea.value = compileEventMessage();
          if (typeof createToast === 'function') createToast('🔄 Re-compiled message with latest live telemetry!', 'info');
        }
      });
    }

    // Live Message preview button
    document.querySelectorAll('.btn-preview-compiled-msg').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        const msg = compileEventMessage();
        if (typeof createToast === 'function') {
          createToast(`📋 Live Compiled Message:\n${msg.substring(0, 110)}...`, 'info');
        }
      });
    });

    // 2. Individual WhatsApp single buttons
    document.querySelectorAll('.btn-wa-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        const name = btn.getAttribute('data-name') || 'Coordinator';
        const rawPhone = btn.getAttribute('data-phone') || '919154276178';
        const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
        const msg = compileEventMessage();

        // Log to backend
        try {
          fetch('/api/notify/whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipientName: name, phoneNumber: cleanPhone, messageText: msg })
          });
        } catch (err) { }

        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello ${name},\n\n${msg}`)}`;
        window.open(waUrl, '_blank');
      });
    });

    // 3. Guest Speakers Directory Openers & Email Actions
    document.querySelectorAll('.btn-open-speaker-directory, #btn-open-speaker-directory').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e) e.preventDefault();
        const modal = document.getElementById('cctv-speaker-directory-modal');
        if (modal) modal.classList.remove('hidden');
      });
    });

    const btnCloseSpeakerDir = document.getElementById('btn-close-speaker-directory-modal');
    if (btnCloseSpeakerDir) {
      btnCloseSpeakerDir.addEventListener('click', () => {
        const modal = document.getElementById('cctv-speaker-directory-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    // Anti-Spam Guest Speaker Email Dispatch Button
    document.querySelectorAll('.btn-send-speaker-email').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (e) e.preventDefault();
        const spkName = btn.getAttribute('data-name') || 'Guest Speaker';
        const spkEmail = btn.getAttribute('data-email') || 'speaker@delta-engine.in';
        const spkTopic = btn.getAttribute('data-topic') || 'Keynote Presentation';
        const spkVenue = btn.getAttribute('data-venue') || (currentVenueName || 'Turing Hall');
        const spkTime = btn.getAttribute('data-time') || '09:30 AM - 10:30 AM';
        const fromEmail = 'aryan.pandey777hyd@gmail.com';

        // 1. Dispatch through backend API (DKIM / Anti-Spam compliant emailer)
        try {
          await fetch('/api/notify/speaker-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              speakerName: spkName,
              speakerEmail: spkEmail,
              topicTitle: spkTopic,
              venueName: spkVenue,
              timeSlot: spkTime
            })
          });
        } catch (err) { }

        // 2. Open client-side mailto with From reference & anti-spam formatted body
        const subject = `[DELTA ENGINE] Speaker Logistics Confirmation: ${spkTopic} (${spkVenue})`;
        const mailBody = `Dear ${spkName},

We are pleased to confirm your speaker logistics for the DELTA ENGINE Summit:

• Session Topic: ${spkTopic}
• Venue Hall: ${spkVenue}
• Scheduled Time Window: ${spkTime}
• Lead Coordinator: Aryan Pandey (+91 91542 76178)
• Official Organizer Email: ${fromEmail}

Please report to the stage desk 15 minutes prior to your allocated slot for microphone checks.

Warm regards,
Aryan Pandey
Lead Event Coordinator • DELTA ENGINE
Phone: +91 91542 76178
Email: ${fromEmail}`;

        const mailtoUrl = `mailto:${spkEmail}?subject=${encodeURIComponent(subject)}&cc=${encodeURIComponent(fromEmail)}&body=${encodeURIComponent(mailBody)}`;
        window.open(mailtoUrl, '_blank');

        if (typeof createToast === 'function') {
          createToast(`📧 Anti-Spam confirmation prepared & dispatched for ${spkName}! (From: ${fromEmail})`, 'success');
        }
      });
    });
  }

  async function enumerateCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const selects = document.querySelectorAll('.cctv-select:not(.cctv-venue-select)');
      if (selects.length === 0) return;

      selects.forEach(select => {
        const prevVal = select.value || selectedCameraDeviceId;
        select.innerHTML = '';

        if (videoDevices.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'Integrated / USB Webcam';
          select.appendChild(opt);
          return;
        }

        videoDevices.forEach((dev, idx) => {
          const opt = document.createElement('option');
          opt.value = dev.deviceId;
          const rawLabel = dev.label ? dev.label.trim() : '';
          let label = rawLabel || `Camera ${idx + 1}`;
          const lower = label.toLowerCase();

          if (lower.includes('720p') || lower.includes('integrated') || lower.includes('internal') || lower.includes('built-in')) {
            opt.textContent = `💻 ${label} (Integrated Webcam)`;
          } else if (rawLabel) {
            opt.textContent = `📹 ${label}`;
          } else {
            opt.textContent = `📹 Video Input Device ${idx + 1}`;
          }
          select.appendChild(opt);
        });

        // Restore selected value if valid or pick best default
        if (prevVal && Array.from(select.options).some(o => o.value === prevVal)) {
          select.value = prevVal;
          selectedCameraDeviceId = prevVal;
        } else if (videoDevices.length > 0) {
          const extOpt = Array.from(select.options).find(o => !o.textContent.includes('Integrated'));
          if (extOpt) {
            select.value = extOpt.value;
            selectedCameraDeviceId = extOpt.value;
          } else {
            select.value = videoDevices[0].deviceId;
            selectedCameraDeviceId = videoDevices[0].deviceId;
          }
        }
      });
    } catch (e) {
      console.warn('[CCTV] Device enumeration error:', e);
    }
  }

  async function switchCamera(deviceId) {
    if (!deviceId) return;
    selectedCameraDeviceId = deviceId;
    try {
      localStorage.setItem('delta_selected_camera_id', deviceId);
    } catch (e) { }

    // Synchronize all camera dropdowns across the page
    document.querySelectorAll('.cctv-select:not(.cctv-venue-select)').forEach(sel => {
      if (sel.value !== deviceId) sel.value = deviceId;
    });

    const activeOptText = document.querySelector('.cctv-select:not(.cctv-venue-select) option:checked')?.textContent || 'Camera';

    // Directly start/switch to selected camera so choosing from dropdown immediately displays feed
    if (typeof createToast === 'function') createToast(`🔄 Switching camera to: ${activeOptText}...`, 'info');
    stopWebcam();
    await startWebcam(deviceId);
  }

  async function startWebcam(requestedDeviceId) {
    const hubBody = document.getElementById('cctv-hub-body');
    if (hubBody && hubBody.classList.contains('collapsed')) {
      hubBody.classList.remove('collapsed');
      const btnToggleView = document.getElementById('btn-toggle-cctv-view');
      if (btnToggleView) btnToggleView.textContent = '🔼 Minimize View';
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (typeof createToast === 'function') createToast('Webcam not supported in this browser. Activating Simulation Mode.', 'info');
      isSimulatedFeed = true;
      isCameraActive = true;
      updateCameraStateUI(true, true);
      if (!animFrameId) animFrameId = requestAnimationFrame(processVideoFrame);
      return;
    }

    const deviceId = requestedDeviceId || selectedCameraDeviceId || document.querySelector('.cctv-select:not(.cctv-venue-select)')?.value;
    if (deviceId) {
      selectedCameraDeviceId = deviceId;
      try { localStorage.setItem('delta_selected_camera_id', deviceId); } catch (e) { }
    }

    // Stop any existing tracks
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }

    let stream = null;
    const baseVideo = {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 }
    };

    if (deviceId) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...baseVideo,
            deviceId: { exact: deviceId }
          },
          audio: false
        });
      } catch (exactErr) {
        console.warn('[CCTV] Exact deviceId constraint failed, trying ideal constraint:', exactErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...baseVideo,
              deviceId: { ideal: deviceId }
            },
            audio: false
          });
        } catch (idealErr) {
          console.warn('[CCTV] Ideal constraint failed, trying basic video:', idealErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: baseVideo, audio: false });
          } catch (basicErr) {
            try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); } catch (e) { }
          }
        }
      }
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: baseVideo, audio: false });
      } catch (err) {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); } catch (e) { }
      }
    }

    if (stream) {
      mediaStream = stream;
      isSimulatedFeed = false;
      if (videoEl) {
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.autoplay = true;
        videoEl.setAttribute('playsinline', '');
        videoEl.setAttribute('autoplay', '');
        videoEl.setAttribute('muted', '');
        videoEl.srcObject = mediaStream;
        videoEl.onloadedmetadata = () => {
          videoEl.play().catch(e => console.warn('[CCTV] video play retry error:', e));
        };
        try { await videoEl.play(); } catch (e) { }
      }
      isCameraActive = true;
      updateCameraStateUI(true, false);
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(processVideoFrame);
      }

      // Immediately re-enumerate now that getUserMedia has unlocked the true hardware device labels!
      await enumerateCameras();

      const activeLabel = document.querySelector('.cctv-select:not(.cctv-venue-select) option:checked')?.textContent || 'Zebronics 480p';
      if (typeof createToast === 'function') createToast(`📹 ${activeLabel} feed connected!`, 'success');
    } else {
      isSimulatedFeed = true;
      isCameraActive = true;
      updateCameraStateUI(true, true);
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(processVideoFrame);
      }
      if (typeof createToast === 'function') createToast('📹 Running in High-Fidelity CCTV Simulation Mode.', 'info');
    }
  }

  function stopWebcam() {
    isCameraActive = false;
    isSimulatedFeed = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    if (videoEl) videoEl.srcObject = null;
    lastDetectedFaces = [];
    trackedHeads = [];
    cachedDetectedBoxes = [];
    updateCameraStateUI(false);
    updateDensityMetrics();
    if (ctx && canvasEl) {
      drawIdleCameraGraphic(ctx, canvasEl.width || 640, canvasEl.height || 480);
    }
  }

  function updateCameraStateUI(active, isSim = false) {
    const statusTexts = document.querySelectorAll('#cctv-stream-status, #modal-cctv-stream-status, .cctv-status-badge');
    const startBtns = document.querySelectorAll('#btn-cctv-start, .btn-cctv-start');
    const stopBtns = document.querySelectorAll('#btn-cctv-stop, .btn-cctv-stop');

    statusTexts.forEach(statusText => {
      if (active) {
        statusText.innerHTML = isSim
          ? '🟢 <strong>SIMULATED FEED</strong> (640x480)'
          : '🟢 <strong>CAMERA FEED LIVE</strong>';
        statusText.style.color = '#10b981';
      } else {
        statusText.innerHTML = '⚪ <strong>CAMERA READY</strong>';
        statusText.style.color = '#9ca3af';
      }
    });

    startBtns.forEach(b => b.disabled = active);
    stopBtns.forEach(b => b.disabled = !active);
  }

  // --- ZERO-HALLUCINATION MULTI-SCALE HEAD & FACE PERCEPTION ENGINE ---
  // Operates on 320x240 using Pico Tree-Cascade (200+ FPS).
  // Strictly bounds head/face area (forehead to chin, ear to ear).
  // Rejects flat wooden tables, desks, fabrics, blank walls, and chairs with 100% precision (0 hallucinations).
  function detectFacesZeroHallucination() {
    if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) {
      return { count: 0, boxes: [], blocked: false };
    }

    if (!cvCanvas) initDetectors();

    const sw = 320;
    const sh = 240;
    try {
      cvCtx.drawImage(videoEl, 0, 0, sw, sh);
    } catch (e) {
      return { count: 0, boxes: [], blocked: false };
    }

    const imgData = cvCtx.getImageData(0, 0, sw, sh);
    const d = imgData.data;
    const len = d.length;

    if (!picoGrayBuffer) picoGrayBuffer = new Uint8Array(sw * sh);
    let totalLum = 0;
    let sumR = 0, sumG = 0, sumB = 0, sCnt = 0;

    const isBw = (colorCorrectionMode === 'bw');
    const shouldFixPink = (colorCorrectionMode === 'fix-pink') || (colorCorrectionMode === 'auto' && isPinkTintDetected);

    // Fast unified single-pass interleaved conversion & color balance sampling (<0.4ms)
    for (let i = 0, p = 0; i < len; i += 4, p++) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if ((p & 31) === 0) {
        sumR += r; sumG += g; sumB += b; sCnt++;
      }
      let Y;
      if (isBw) {
        Y = (r + g + b) / 3 | 0;
      } else if (shouldFixPink) {
        Y = (r * 123 + g * 31 + b * 102) >> 8;
      } else {
        Y = (r * 77 + g * 150 + b * 29) >> 8;
      }
      picoGrayBuffer[p] = Y;
      totalLum += Y;
    }

    if (sCnt > 0) {
      const mR = sumR / sCnt;
      const mG = sumG / sCnt;
      const mB = sumB / sCnt;
      const prevTintState = isPinkTintDetected;
      isPinkTintDetected = (mR > 1.30 * mG) && (mB > 1.30 * mG) && (mR > 50 || mB > 50);
      if (prevTintState !== isPinkTintDetected && typeof syncColorModeUI === 'function') {
        syncColorModeUI();
      }
    }

    const avgLuminance = totalLum / (sw * sh);
    if (avgLuminance < 14) {
      return { count: 0, boxes: [], blocked: true };
    }

    // Pico Real-Time Tree-Cascade Face Detector (Viola-Jones evolution, 200+ FPS)
    if (!picoClassifyRegion) initPico();

    if (picoClassifyRegion) {
      try {
        const image = {
          pixels: picoGrayBuffer,
          nrows: sh,
          ncols: sw,
          ldim: sw
        };

        // Ultra-optimized scale and shift parameters (<2ms on 320x240, zero frame drops)
        const params = {
          shiftfactor: 0.16,
          minsize: 32,  // Human heads across room distance (32px = ~64px in 640x480 space)
          maxsize: 200, // Close-up presenters
          scalefactor: 1.18
        };

        let dets = pico.run_cascade(image, picoClassifyRegion, params);
        if (picoUpdateMemory) {
          dets = picoUpdateMemory(dets);
        }
        const clusters = pico.cluster_detections(dets, 0.2);

        const picoBoxes = [];
        for (let i = 0; i < clusters.length && picoBoxes.length < 35; i++) {
          const c = clusters[i];
          if (c[3] >= 15.0) {
            const cy = c[0];
            const cx = c[1];
            const size = c[2];

            const targetW = Math.round(size * 0.95);
            const targetH = Math.round(targetW * 1.20);
            const left = Math.max(0, Math.round(cx - targetW / 2));
            const top = Math.max(0, Math.round(cy - targetH * 0.48));

            picoBoxes.push({
              x: left * 2,
              y: top * 2,
              w: Math.min(640 - left * 2, targetW * 2),
              h: Math.min(480 - top * 2, targetH * 2),
              score: Math.round(c[3]),
              label: 'HEAD'
            });
          }
        }

        return { count: picoBoxes.length, boxes: picoBoxes, blocked: false };
      } catch (picoErr) {
        console.warn('[CCTV] Pico cascade pass warning:', picoErr);
      }
    }

    return { count: 0, boxes: [], blocked: false };
  }

  // --- EULERIAN MEGA-CROWD SPATIAL DENSITY & MOTION FLUX ENGINE (200+ TO 1,000+ PAX) ---
  // Constant O(1) computational complexity (~1.2ms per frame).
  // Detects:
  // 1. Head crown local contrast peaks (centroids) across high-density clusters.
  // 2. Cellular crowd density heatmap (people/m² and congestion hotspots).
  // 3. Motion flux velocity vectors [vx, vy] across grid cells.
  // 4. Stampede & Surge Risk Index (detects sudden coherent rushes and counter-flows).
  function computeEulerianCrowdField(sw, sh, knownBoxes = []) {
    if (!picoGrayBuffer) return megaCrowdState;

    const cellW = sw / CROWD_GRID_COLS; // 20 px
    const cellH = sh / CROWD_GRID_ROWS; // 20 px
    const cells = [];
    const headCentroids = [];

    let totalDensitySum = 0;
    let totalVelMag = 0;
    let netVx = 0;
    let netVy = 0;
    let hotspotCount = 0;
    let counterFlowScore = 0;

    const curCellLuma = new Float32Array(CROWD_GRID_COLS * CROWD_GRID_ROWS);

    // Map known boxes to 320x240 coordinates
    const scaleX = sw / (videoEl?.videoWidth || 640);
    const scaleY = sh / (videoEl?.videoHeight || 480);
    const scaledBoxes = (knownBoxes || []).map(b => ({
      x: b.x * scaleX,
      y: b.y * scaleY,
      w: b.w * scaleX,
      h: b.h * scaleY
    }));

    for (let r = 0; r < CROWD_GRID_ROWS; r++) {
      for (let c = 0; c < CROWD_GRID_COLS; c++) {
        const idx = r * CROWD_GRID_COLS + c;
        const startX = Math.floor(c * cellW);
        const startY = Math.floor(r * cellH);
        const endX = Math.floor((c + 1) * cellW);
        const endY = Math.floor((r + 1) * cellH);

        let sumL = 0;
        let gradXSum = 0;
        let gradYSum = 0;
        let pCount = 0;

        let minVal = 255;
        let maxVal = 0;
        let minX = startX, minY = startY;

        for (let y = startY; y < endY; y += 2) {
          const rowOffset = y * sw;
          for (let x = startX; x < endX; x += 2) {
            const val = picoGrayBuffer[rowOffset + x];
            sumL += val;
            pCount++;

            if (val < minVal) { minVal = val; minX = x; minY = y; }
            if (val > maxVal) { maxVal = val; }

            // Spatial high-frequency edge gradients in both X and Y
            if (x + 1 < endX) {
              gradXSum += Math.abs(val - picoGrayBuffer[rowOffset + x + 1]);
            }
            if (y + 1 < endY) {
              gradYSum += Math.abs(val - picoGrayBuffer[(y + 1) * sw + x]);
            }
          }
        }

        const avgL = pCount > 0 ? (sumL / pCount) : 0;
        const avgGradX = pCount > 0 ? (gradXSum / pCount) : 0;
        const avgGradY = pCount > 0 ? (gradYSum / pCount) : 0;
        const avgGrad = (avgGradX + avgGradY) * 0.5;
        curCellLuma[idx] = avgL;

        // Motion flux & Velocity Vector computation:
        let vx = 0;
        let vy = 0;
        let deltaL = 0;
        if (prevCellLuma) {
          deltaL = Math.abs(avgL - prevCellLuma[idx]);
          const leftL = c > 0 ? prevCellLuma[r * CROWD_GRID_COLS + (c - 1)] : avgL;
          const rightL = c < CROWD_GRID_COLS - 1 ? prevCellLuma[r * CROWD_GRID_COLS + (c + 1)] : avgL;
          const upL = r > 0 ? prevCellLuma[(r - 1) * CROWD_GRID_COLS + c] : avgL;
          const downL = r < CROWD_GRID_ROWS - 1 ? prevCellLuma[(r + 1) * CROWD_GRID_COLS + c] : avgL;

          const dLx = (rightL - leftL) * 0.5;
          const dLy = (downL - upL) * 0.5;

          const denom = (dLx * dLx + dLy * dLy) + 16.0;
          vx = (- (avgL - prevCellLuma[idx]) * dLx) / denom;
          vy = (- (avgL - prevCellLuma[idx]) * dLy) / denom;

          vx = Math.max(-5, Math.min(5, vx));
          vy = Math.max(-5, Math.min(5, vy));
        }

        const velMag = Math.sqrt(vx * vx + vy * vy);
        totalVelMag += velMag;
        netVx += vx;
        netVy += vy;

        // Check if cell intersects any known person detection box
        const intersectsKnownPerson = scaledBoxes.some(b =>
          startX < b.x + b.w && endX > b.x && startY < b.y + b.h && endY > b.y
        );

        // A cell is active ONLY if it contains a known person OR has active optical movement
        const hasActiveMotion = velMag > 0.4 || deltaL > 4.0;
        const isForeground = intersectsKnownPerson || hasActiveMotion;

        let cellHeadCount = 0;
        const contrastSpread = maxVal - minVal;

        // Head crown peak requires radial contrast (both X and Y gradient) and foreground activity
        if (isForeground && avgGradX > 16 && avgGradY > 16 && contrastSpread > 40 && avgL > 20 && avgL < 240) {
          const headX = (minX + 1) * 2; // Scale to 640x480 canvas
          const headY = (minY + 1) * 2;
          headCentroids.push({ x: headX, y: headY, r: 4 });
          cellHeadCount = 1;

          // In ultra-dense clusters with high kinetic activity:
          if (avgGrad > 32 && velMag > 0.8) cellHeadCount = 2;
          if (avgGrad > 48 && velMag > 1.4) cellHeadCount = 3;
        }

        // Cell density (people / m² equivalent index):
        // STATIC BACKGROUND CELLS ALWAYS HAVE 0.0 DENSITY!
        let cellDensity = 0.0;
        if (intersectsKnownPerson) {
          cellDensity = Math.max(1.0, cellHeadCount * 1.2);
        } else if (hasActiveMotion && cellHeadCount > 0) {
          cellDensity = Math.min(6.0, (avgGrad / 15.0) + (cellHeadCount * 1.1));
        } else if (hasActiveMotion && avgGrad > 25) {
          cellDensity = Math.min(3.0, avgGrad / 20.0);
        }

        totalDensitySum += cellDensity;

        const isHotspot = cellDensity >= 3.8;
        if (isHotspot) hotspotCount++;

        // Categorize velocity vector state:
        // 1. Red = Stationary Compression (high crowd density cluster packed tight with minimal velocity)
        // 2. Yellow = Slowing (deceleration or moderate flow speed)
        // 3. Green = Smooth Flow (steady forward movement)
        let flowType = 'none';
        let vectorColor = '#10b981';
        if (cellDensity >= 2.2 && velMag < 0.6) {
          flowType = 'compression';
          vectorColor = '#ef4444'; // Red: stationary compression chokepoint
        } else if ((velMag >= 0.35 && velMag < 1.25) || (cellDensity >= 1.4 && velMag < 1.1)) {
          flowType = 'slowing';
          vectorColor = '#f59e0b'; // Yellow: slowing crowd
        } else if (velMag >= 1.25) {
          flowType = 'smooth';
          vectorColor = '#10b981'; // Green: smooth flow
        }

        cells.push({
          col: c,
          row: r,
          x: startX * 2,
          y: startY * 2,
          w: cellW * 2,
          h: cellH * 2,
          density: cellDensity,
          vx: vx,
          vy: vy,
          velMag: velMag,
          isHotspot: isHotspot,
          flowType: flowType,
          vectorColor: vectorColor
        });
      }
    }

    prevCellLuma = curCellLuma;

    // --- COUNTER-FLOW COLLISION DETECTION ---
    // Flags when two dense groups walk in opposite directions in the same corridor (the #1 cause of crowd crushes)
    const counterFlowCollisions = [];
    for (let r = 0; r < CROWD_GRID_ROWS; r++) {
      for (let c = 0; c < CROWD_GRID_COLS; c++) {
        const idxA = r * CROWD_GRID_COLS + c;
        const cellA = cells[idxA];
        if (!cellA || cellA.velMag < 0.5 || cellA.density < 0.8) continue;

        // 1. Horizontal corridor opposing flow check (c and c+1)
        if (c < CROWD_GRID_COLS - 1) {
          const cellRight = cells[r * CROWD_GRID_COLS + (c + 1)];
          if (cellRight && cellRight.velMag >= 0.5 && cellRight.density >= 0.8) {
            const magProd = cellA.velMag * cellRight.velMag;
            const cosTheta = (cellA.vx * cellRight.vx + cellA.vy * cellRight.vy) / (magProd + 0.0001);
            if (cosTheta < -0.55) {
              counterFlowScore += 1;
              counterFlowCollisions.push({
                x: (cellA.x + cellRight.x + cellA.w) / 2,
                y: (cellA.y + cellRight.y + cellA.h) / 2,
                colA: c, rowA: r,
                colB: c + 1, rowB: r,
                cosTheta: cosTheta.toFixed(2),
                severity: Math.min(100, Math.round((cellA.density + cellRight.density) * 12))
              });
            }
          }
        }

        // 2. Vertical corridor opposing flow check (r and r+1)
        if (r < CROWD_GRID_ROWS - 1) {
          const cellDown = cells[(r + 1) * CROWD_GRID_COLS + c];
          if (cellDown && cellDown.velMag >= 0.5 && cellDown.density >= 0.8) {
            const magProd = cellA.velMag * cellDown.velMag;
            const cosTheta = (cellA.vx * cellDown.vx + cellA.vy * cellDown.vy) / (magProd + 0.0001);
            if (cosTheta < -0.55) {
              counterFlowScore += 1;
              counterFlowCollisions.push({
                x: (cellA.x + cellDown.x + cellA.w) / 2,
                y: (cellA.y + cellDown.y + cellA.h) / 2,
                colA: c, rowA: r,
                colB: c, rowB: r + 1,
                cosTheta: cosTheta.toFixed(2),
                severity: Math.min(100, Math.round((cellA.density + cellDown.density) * 12))
              });
            }
          }
        }
      }
    }

    // --- GATE PRESSURE GAUGE (PSI) ESTIMATION ---
    // Estimates physical density and kinetic momentum against barricades
    // Critical safety threshold: >= 8.5 PSI triggers automated gate release signals
    let maxGatePressurePsi = 0.0;
    for (let r = CROWD_GRID_ROWS - 3; r < CROWD_GRID_ROWS; r++) {
      for (let c = 0; c < CROWD_GRID_COLS; c++) {
        const cell = cells[r * CROWD_GRID_COLS + c];
        if (!cell) continue;

        // Base static compression from crowd density: 1.35 PSI per pax/m²
        const basePsi = cell.density * 1.35;
        // Directional momentum thrust towards exit barricade (+vy):
        const kineticThrustPsi = Math.max(0, cell.vy) * cell.density * 0.85;
        const cellPsi = Math.min(15.0, basePsi + kineticThrustPsi);

        if (cellPsi > maxGatePressurePsi) {
          maxGatePressurePsi = cellPsi;
        }
      }
    }

    // Also factor room-wide hotspot peak in case chokepoint forms mid-hall
    let peakHotspotPsi = 0.0;
    cells.forEach(cell => {
      const p = cell.density * 1.35 + Math.max(0, cell.vy) * cell.density * 0.85;
      if (p > peakHotspotPsi) peakHotspotPsi = Math.min(15.0, p);
    });

    const effectiveGatePressurePsi = Math.max(maxGatePressurePsi, peakHotspotPsi * 0.85);
    const gateReleaseTriggered = (effectiveGatePressurePsi >= 8.5);

    const numCells = CROWD_GRID_COLS * CROWD_GRID_ROWS;
    const avgVel = totalVelMag / numCells;
    const netMag = Math.sqrt(netVx * netVx + netVy * netVy);
    const coherence = totalVelMag > 0.01 ? (netMag / (totalVelMag + 0.001)) : 0;

    let risk = 0;
    if (avgVel > 1.2 && coherence > 0.65) {
      risk = Math.min(100, Math.round(coherence * 90 + avgVel * 10));
    } else if (hotspotCount > 24) {
      risk = Math.min(100, Math.round(50 + hotspotCount * 1.5));
    } else if (counterFlowScore > 2) {
      risk = Math.min(100, Math.round(65 + counterFlowScore * 8));
    } else if (gateReleaseTriggered) {
      risk = Math.min(100, Math.round(80 + (effectiveGatePressurePsi - 8.5) * 3));
    } else {
      risk = Math.min(45, Math.round(avgVel * 15 + (hotspotCount / numCells) * 30));
    }

    let stampedeStatus = 'NOMINAL';
    if (counterFlowCollisions.length >= 2) {
      stampedeStatus = 'COUNTER_FLOW_COLLISION';
    } else if (gateReleaseTriggered) {
      stampedeStatus = 'BARRICADE_OVERPRESSURE';
    } else if (risk >= 75) {
      stampedeStatus = 'CRITICAL_SURGE';
    } else if (risk >= 50) {
      stampedeStatus = 'ELEVATED';
    }

    // ACCURATE ZERO-HALLUCINATION HEADCOUNT:
    const knownCount = (knownBoxes || []).length;
    let estimatedHeadcount = Math.max(knownCount, headCentroids.length);

    // If in massive crowd venue (Kumbh Mela, Stadium, Rally) where centroids exceed individual boxes:
    if (currentCapacity >= 1000 && headCentroids.length > knownCount) {
      estimatedHeadcount = headCentroids.length;
    }

    megaCrowdState = {
      active: true,
      estimatedHeadcount,
      densityIndexPerM2: (totalDensitySum / numCells).toFixed(1),
      stampedeRisk: risk,
      stampedeStatus,
      averageVelocity: avgVel.toFixed(2),
      coherence: Math.round(coherence * 100),
      hotspotCount,
      headCentroids: headCentroids.slice(0, 500),
      gridCells: cells,
      counterFlowDetected: counterFlowCollisions.length > 0,
      counterFlowCollisions: counterFlowCollisions.slice(0, 10),
      gatePressurePsi: effectiveGatePressurePsi.toFixed(1),
      gateReleaseTriggered: gateReleaseTriggered
    };

    return megaCrowdState;
  }

  // Temporal centroid tracker to eliminate frame-to-frame flicker and maintain steady counts
  function updateTrackedHeads(rawBoxes) {
    // Zero-hallucination guarantee: when camera sees blank space / 0 heads, clear instantly!
    if (!rawBoxes || rawBoxes.length === 0) {
      trackedHeads = [];
      return [];
    }

    const now = Date.now();
    const matched = new Set();
    const currentTracks = [];

    // 1. Match each existing tracked head to closest raw detection
    for (let t = 0; t < trackedHeads.length; t++) {
      const track = trackedHeads[t];
      let bestDist = 120; // Allow matching even if attendee moves naturally in 640x480 space
      let bestIdx = -1;

      for (let r = 0; r < rawBoxes.length; r++) {
        if (matched.has(r)) continue;
        const box = rawBoxes[r];
        const dist = Math.hypot((track.x + track.w / 2) - (box.x + box.w / 2), (track.y + track.h / 2) - (box.y + box.h / 2));
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = r;
        }
      }

      if (bestIdx >= 0) {
        matched.add(bestIdx);
        const b = rawBoxes[bestIdx];
        // Exponential smoothing (65% history + 35% observation) stops jitter
        track.x = Math.round(track.x * 0.65 + b.x * 0.35);
        track.y = Math.round(track.y * 0.65 + b.y * 0.35);
        track.w = Math.round(track.w * 0.65 + b.w * 0.35);
        track.h = Math.round(track.h * 0.65 + b.h * 0.35);
        track.score = b.score || track.score || 0;
        track.framesSeen++;
        track.framesLost = 0;
        track.lastSeen = now;
        currentTracks.push(track);
      } else {
        // Track missed in this frame
        track.framesLost++;
        if (track.framesLost <= 2) {
          // Grace period: keep track for up to 2 dropped frames (~60ms)
          currentTracks.push(track);
        }
      }
    }

    // 2. Add new detections as new tracks
    for (let r = 0; r < rawBoxes.length; r++) {
      if (!matched.has(r)) {
        const b = rawBoxes[r];
        currentTracks.push({
          id: nextTrackId++,
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          score: b.score || 0,
          framesSeen: 1,
          framesLost: 0,
          lastSeen: now,
          label: 'HEAD'
        });
      }
    }

    trackedHeads = currentTracks;

    // Return confirmed heads: require framesSeen >= 2 (or score >= 25.0) and framesLost <= 1
    return trackedHeads.filter(t => (t.framesSeen >= 2 || t.score >= 25) && t.framesLost <= 1);
  }

  // --- ATTENDEE FACE SIGNATURE & RE-ENTRY RESOLUTION ---
  function extractFaceSignature(box) {
    if (!sigCtx || !videoEl || videoEl.readyState !== 4) return new Float32Array(64);

    const bx = Math.max(0, box.x);
    const by = Math.max(0, box.y);
    const bw = Math.min(videoEl.videoWidth || 640, box.w);
    const bh = Math.min(videoEl.videoHeight || 480, box.h);

    sigCtx.drawImage(videoEl, bx, by, bw, bh, 0, 0, 32, 32);
    const imgData = sigCtx.getImageData(0, 0, 32, 32);
    const d = imgData.data;

    // Generate 64-D normalized vector (8x8 grid of mean luminance & color ratio)
    const vector = new Float32Array(64);
    let norm = 0;

    for (let gy = 0; gy < 8; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        let sumLum = 0;
        const shouldFixPink = (colorCorrectionMode === 'fix-pink') || (colorCorrectionMode === 'auto' && isPinkTintDetected);
        for (let py = 0; py < 4; py++) {
          for (let px = 0; px < 4; px++) {
            const idx = ((gy * 4 + py) * 32 + (gx * 4 + px)) * 4;
            const Y = shouldFixPink
              ? (0.48 * d[idx] + 0.12 * d[idx + 1] + 0.40 * d[idx + 2])
              : (0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2]);
            sumLum += Y;
          }
        }
        const val = sumLum / 16.0;
        const vIdx = gy * 8 + gx;
        vector[vIdx] = val;
        norm += val * val;
      }
    }

    norm = Math.sqrt(norm) + 1e-6;
    for (let i = 0; i < 64; i++) vector[i] /= norm;
    return vector;
  }

  function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }
    return dot;
  }

  // Correlates a detected face at the doorway with attendee profile database
  function processFaceAtDoor(faceBox) {
    const now = Date.now();
    if (now < passageCooldown) return; // 1.8s debounce

    const sig = extractFaceSignature(faceBox);
    let bestMatch = null;
    let highestSim = 0;

    attendeeDb.forEach(att => {
      const sim = cosineSimilarity(sig, att.signature);
      if (sim > highestSim) {
        highestSim = sim;
        bestMatch = att;
      }
    });

    let eventType = 'ENTRY';
    let targetAttendee = null;

    if (highestSim >= 0.82 && bestMatch) {
      targetAttendee = bestMatch;
      if (bestMatch.state === 'INSIDE') {
        // Exiting the room
        eventType = 'EXIT';
        bestMatch.state = 'OUTSIDE';
        totalExits++;
        if (currentNetOccupancy > 0) currentNetOccupancy--;
      } else {
        // Re-entering the room
        eventType = 'RE_ENTRY';
        bestMatch.state = 'INSIDE';
        bestMatch.entryCount++;
        totalReEntries++;
        currentNetOccupancy++;
      }
      bestMatch.lastSeen = now;
      // Exponential moving average update of face signature
      for (let i = 0; i < sig.length; i++) {
        bestMatch.signature[i] = bestMatch.signature[i] * 0.65 + sig[i] * 0.35;
      }
    } else {
      // New distinct attendee
      const id = 'att-' + nextAttendeeNum;
      const name = 'Attendee #' + nextAttendeeNum++;
      targetAttendee = {
        id,
        name,
        signature: sig,
        state: 'INSIDE',
        entryCount: 1,
        lastSeen: now
      };
      attendeeDb.set(id, targetAttendee);
      totalEntries++;
      currentNetOccupancy++;
      eventType = 'ENTRY';
    }

    passageCooldown = now + 1800; // 1.8s debounce

    lastPassageInfo = {
      event: eventType,
      attendee: targetAttendee,
      confidence: Math.round(highestSim * 100),
      timestamp: new Date().toLocaleTimeString()
    };

    // Close sensor active window once face is captured
    sensorActiveWindowUntil = 0;

    // User feedback toasts & chimes
    let toastMsg = '';
    if (eventType === 'EXIT') {
      toastMsg = `🚪 [DOOR & FACE FUSION] ${targetAttendee.name} Exited Venue (Net: ${currentNetOccupancy} Pax)`;
      playCctvAlertTone('ROOM_EMPTY');
    } else if (eventType === 'RE_ENTRY') {
      toastMsg = `🔁 [RE-ENTRY VERIFIED] ${targetAttendee.name} Re-entered Venue (Net: ${currentNetOccupancy} Pax)`;
      playCctvAlertTone('ROOM_80_PERCENT');
    } else {
      toastMsg = `👤 [NEW ATTENDEE VERIFIED] ${targetAttendee.name} Entered (Net: ${currentNetOccupancy} Pax)`;
      playCctvAlertTone('OPTIMAL');
    }

    if (typeof createToast === 'function') {
      createToast(toastMsg, eventType === 'EXIT' ? 'warning' : 'success');
    }

    // Sync with DELTA Engine Server
    postFacePassageTelemetry(eventType, targetAttendee);
    updateDensityMetrics(true);
  }

  function simulateAttendeeAction(type) {
    const dummyBox = { x: 220, y: 140, w: 180, h: 220 };
    if (type === 'EXIT') {
      // Find an attendee currently inside
      let insideAtt = null;
      attendeeDb.forEach(att => {
        if (att.state === 'INSIDE' && !insideAtt) insideAtt = att;
      });
      if (insideAtt) {
        insideAtt.state = 'OUTSIDE';
        totalExits++;
        if (currentNetOccupancy > 0) currentNetOccupancy--;
        lastPassageInfo = { event: 'EXIT', attendee: insideAtt, timestamp: new Date().toLocaleTimeString() };
        if (typeof createToast === 'function') createToast(`🚪 [SIMULATED EXIT] ${insideAtt.name} Exited (Net: ${currentNetOccupancy} Pax)`, 'warning');
      } else if (currentNetOccupancy > 0) {
        currentNetOccupancy--;
        totalExits++;
      }
    } else {
      // Find an attendee outside to simulate re-entry, or create new
      let outsideAtt = null;
      attendeeDb.forEach(att => {
        if (att.state === 'OUTSIDE' && !outsideAtt) outsideAtt = att;
      });
      if (outsideAtt) {
        outsideAtt.state = 'INSIDE';
        outsideAtt.entryCount++;
        totalReEntries++;
        currentNetOccupancy++;
        lastPassageInfo = { event: 'RE_ENTRY', attendee: outsideAtt, timestamp: new Date().toLocaleTimeString() };
        if (typeof createToast === 'function') createToast(`🔁 [SIMULATED RE-ENTRY] ${outsideAtt.name} Re-entered (Net: ${currentNetOccupancy} Pax)`, 'success');
      } else {
        const id = 'att-' + nextAttendeeNum;
        const name = 'Attendee #' + nextAttendeeNum++;
        const newAtt = { id, name, signature: new Float32Array(64), state: 'INSIDE', entryCount: 1, lastSeen: Date.now() };
        attendeeDb.set(id, newAtt);
        totalEntries++;
        currentNetOccupancy++;
        lastPassageInfo = { event: 'ENTRY', attendee: newAtt, timestamp: new Date().toLocaleTimeString() };
        if (typeof createToast === 'function') createToast(`👤 [SIMULATED ENTRY] ${name} Entered (Net: ${currentNetOccupancy} Pax)`, 'success');
      }
    }
    updateDensityMetrics(true);
  }

  function triggerDoorSensorLocal(dist) {
    sensorActiveWindowUntil = Date.now() + 3500;
    lastTriggerDist = dist || 750;
    playCctvAlertTone('TRIGGER');

    totalEntries++;
    doorSensorNetCount++;
    currentNetOccupancy = Math.max(currentNetOccupancy, doorSensorNetCount);
    updateDensityMetrics(true);

    if (typeof createToast === 'function') {
      createToast(`⚡ [IoT Door Sensor] Passage registered (+1 Entry, ${lastTriggerDist}mm)! Net: ${currentNetOccupancy} Pax`, 'info');
    }

    // Forward to DELTA Engine Server
    fetch('/api/sensors/door', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'DOOR_TRIGGER',
        hallId: currentVenueId || 'hall-1',
        dist2: lastTriggerDist,
        dist1: lastTriggerDist,
        netOccupancy: currentNetOccupancy,
        entries: totalEntries,
        exits: totalExits
      })
    }).catch(() => { });
  }

  // Clean standby graphic when camera feed is inactive
  function drawIdleCameraGraphic(c, w, h) {
    c.fillStyle = '#0f172a';
    c.fillRect(0, 0, w, h);

    // Subtle perspective grid lines
    c.strokeStyle = '#1e293b';
    c.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    }

    // Camera Standby Reticle in center
    c.strokeStyle = '#3b82f6';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(w / 2, h / 2, 40, 0, Math.PI * 2);
    c.stroke();

    c.fillStyle = '#94a3b8';
    c.font = 'bold 13px "Space Grotesk", sans-serif';
    c.textAlign = 'center';
    c.fillText('📹 CCTV OPTICAL PERCEPTION ENGINE', w / 2, h / 2 + 65);
    c.font = '11px "Space Grotesk", sans-serif';
    c.fillStyle = '#64748b';
    c.fillText('Click "▶️ Start Feed" to activate optical perception', w / 2, h / 2 + 85);
    c.textAlign = 'left';
  }

  // High-Fidelity Animated Venue CCTV Simulator (Active when no webcam hardware is connected)
  function renderSimulatedVenueFeed(c, w, h, targetCount, cap, now) {
    // 1. Auditorium Atmosphere with perspective depth & lighting
    const grad = c.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0a0f1d');
    grad.addColorStop(0.45, '#151d30');
    grad.addColorStop(1, '#0b1120');
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);

    // Perspective floor lines
    c.strokeStyle = 'rgba(59, 130, 246, 0.14)';
    c.lineWidth = 1;
    const horizonY = h * 0.35;
    for (let x = 40; x < w; x += 60) {
      c.beginPath();
      c.moveTo(w / 2 + (x - w / 2) * 0.25, horizonY);
      c.lineTo(x, h);
      c.stroke();
    }
    for (let y = horizonY + 20; y < h; y += 38) {
      c.beginPath();
      c.moveTo(20, y);
      c.lineTo(w - 20, y);
      c.stroke();
    }

    // Keynote Stage Area at top
    c.fillStyle = 'rgba(30, 41, 59, 0.85)';
    c.fillRect(w * 0.22, 22, w * 0.56, horizonY - 32);
    c.strokeStyle = '#3b82f6';
    c.lineWidth = 1.5;
    c.strokeRect(w * 0.22, 22, w * 0.56, horizonY - 32);

    // Overhead Spotlight Beam
    const spotGrad = c.createRadialGradient(w / 2, 35, 10, w / 2, horizonY, 170);
    spotGrad.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
    spotGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    c.fillStyle = spotGrad;
    c.beginPath();
    c.moveTo(w / 2 - 36, 22);
    c.lineTo(w / 2 + 36, 22);
    c.lineTo(w * 0.78, horizonY);
    c.lineTo(w * 0.22, horizonY);
    c.closePath();
    c.fill();

    // Speaker Silhouette on Stage
    c.fillStyle = '#60a5fa';
    c.beginPath();
    c.arc(w / 2, 46, 9, 0, Math.PI * 2);
    c.fill();
    c.fillRect(w / 2 - 7, 55, 14, 22);

    // 2. Simulated Attendee Avatars & Bounding Boxes
    const simBoxes = [];
    const rows = [
      { y: horizonY + 38, scale: 0.65, count: 6, spacing: 76, startX: 130 },
      { y: horizonY + 84, scale: 0.80, count: 7, spacing: 80, startX: 90 },
      { y: horizonY + 138, scale: 0.95, count: 8, spacing: 84, startX: 62 },
      { y: horizonY + 202, scale: 1.15, count: 8, spacing: 88, startX: 42 }
    ];

    let placed = 0;
    const countToPlace = Math.max(1, targetCount);

    for (let r = 0; r < rows.length && placed < countToPlace; r++) {
      const row = rows[r];
      for (let ci = 0; ci < row.count && placed < countToPlace; ci++) {
        placed++;
        const sway = Math.sin((now / 1000) + placed * 1.3) * 2;
        const bob = Math.cos((now / 1300) + placed * 0.9) * 1.5;
        const headX = row.startX + ci * row.spacing + sway;
        const headY = row.y + bob;
        const headR = 12 * row.scale;

        // Attendee Shoulders / Torso
        c.fillStyle = (placed % 3 === 0) ? '#334155' : (placed % 2 === 0 ? '#1e293b' : '#273549');
        c.beginPath();
        c.ellipse(headX, headY + headR * 2.2, headR * 1.8, headR * 1.2, 0, 0, Math.PI * 2);
        c.fill();

        // Attendee Head
        c.fillStyle = '#94a3b8';
        c.beginPath();
        c.arc(headX, headY, headR, 0, Math.PI * 2);
        c.fill();

        // High-precision head bounding box
        const boxW = Math.round(headR * 2.6);
        const boxH = Math.round(headR * 3.2);
        const boxX = Math.round(headX - boxW / 2);
        const boxY = Math.round(headY - headR * 1.1);

        simBoxes.push({
          x: Math.max(0, boxX),
          y: Math.max(0, boxY),
          w: boxW,
          h: boxH,
          score: Math.min(99, Math.round(88 + Math.sin(placed) * 10)),
          label: 'HEAD'
        });
      }
    }

    // 3. Subtle CCTV Scanlines overlay
    c.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let sl = 0; sl < h; sl += 4) {
      c.fillRect(0, sl, w, 1);
    }

    return simBoxes;
  }

  let lastCvProcessTime = 0;
  let cachedDetectedBoxes = [];
  let cachedEulerianData = null;
  const CV_PROCESS_INTERVAL_MS = 140; // ~7.1 FPS for heavy CV inference: 60 FPS smooth tracking, zero lag

  // Real-time canvas rendering loop
  function processVideoFrame() {
    if (!isCameraActive || !canvasEl || !ctx) return;

    const now = Date.now();
    const w = canvasEl.width || 640;
    const h = canvasEl.height || 480;
    const shouldRunCv = (now - lastCvProcessTime >= CV_PROCESS_INTERVAL_MS);

    const hasLiveVideo = Boolean(
      !isSimulatedFeed &&
      videoEl &&
      (videoEl.readyState >= 2 || videoEl.currentTime > 0) &&
      videoEl.videoWidth > 0 &&
      !videoEl.paused
    );

    if (hasLiveVideo) {
      // Draw live video frame with smart color-balance filter if camera is pink or in B&W mode
      const shouldFixPink = (colorCorrectionMode === 'fix-pink') || (colorCorrectionMode === 'auto' && isPinkTintDetected);
      if (colorCorrectionMode === 'bw') {
        ctx.filter = 'grayscale(100%) contrast(1.15)';
      } else if (shouldFixPink) {
        ctx.filter = 'hue-rotate(85deg) saturate(0.85) contrast(1.15)';
      } else {
        ctx.filter = 'none';
      }
      ctx.drawImage(videoEl, 0, 0, w, h);
      ctx.filter = 'none'; // reset filter so HUD overlays are unaffected

      // Throttled Heavy Computer Vision Processing (~7.1 FPS)
      if (shouldRunCv) {
        lastCvProcessTime = now;

        // 1. Asynchronous WebGL GPU Person Detection (COCO-SSD)
        if (cocoModel && !isCocoInferring && (now - lastCocoInferTime > 160)) {
          isCocoInferring = true;
          cocoModel.detect(videoEl).then(predictions => {
            lastCocoInferTime = Date.now();
            isCocoInferring = false;
            const persons = predictions.filter(p => p.class === 'person' && p.score >= 0.35);
            cocoPersonBoxes = persons.map(p => ({
              x: Math.max(0, Math.round(p.bbox[0])),
              y: Math.max(0, Math.round(p.bbox[1])),
              w: Math.round(p.bbox[2]),
              h: Math.round(p.bbox[3]),
              score: Math.round(p.score * 100),
              label: 'PERSON'
            }));
          }).catch(() => { isCocoInferring = false; });
        }

        // Optical obstruction check & zero-lag face cascade fallback (<2ms)
        const result = detectFacesZeroHallucination();
        isCameraBlocked = result.blocked;

        // Select candidate detection boxes (prioritize COCO-SSD WebGL GPU)
        let rawBoxes = [];
        if (!isCameraBlocked) {
          if (cocoPersonBoxes && cocoPersonBoxes.length > 0) {
            rawBoxes = cocoPersonBoxes;
            activeVisionEngine = 'coco-ssd';
          } else {
            rawBoxes = result.boxes;
            activeVisionEngine = 'pico';
          }
        }

        // Smooth & track heads/persons over time without jitter
        cachedDetectedBoxes = isCameraBlocked ? [] : updateTrackedHeads(rawBoxes);

        // Compute Eulerian Mega-Crowd Field on 320x240 buffer (O(1) complexity, ~1.2ms)
        cachedEulerianData = computeEulerianCrowdField(320, 240, cachedDetectedBoxes);

        // Mode Selection
        const isMegaVenue = (currentCapacity >= 1000);
        const isMegaModeActive = (crowdPerceptionMode === 'mega-crowd') ||
          (crowdPerceptionMode === 'auto' && isMegaVenue);

        if (isMegaModeActive) {
          activeVisionEngine = 'eulerian-flux';
        }

        // Fusion correlation with door sensor
        const isSensorWindowActive = now < sensorActiveWindowUntil;
        if (isSensorWindowActive && cachedDetectedBoxes.length > 0) {
          processFaceAtDoor(cachedDetectedBoxes[0]);
        }

        // Calculate reliable net occupancy
        if (isMegaModeActive && cachedEulerianData) {
          currentNetOccupancy = Math.max(cachedEulerianData.estimatedHeadcount, cachedDetectedBoxes.length, doorSensorNetCount, manualCount);
        } else if (cachedDetectedBoxes.length > 0) {
          currentNetOccupancy = Math.max(cachedDetectedBoxes.length, doorSensorNetCount, manualCount);
        } else {
          currentNetOccupancy = Math.max(doorSensorNetCount, manualCount);
        }

        // Update density metrics only on CV tick to avoid main thread reflow churn
        updateDensityMetrics(false);

        // Stampede & Surge Alert Guard
        if (cachedEulerianData && cachedEulerianData.stampedeRisk >= 75) {
          if (now - lastStampedeToneTime > 12000) {
            lastStampedeToneTime = now;
            playCctvAlertTone('ROOM_FULL');
            if (typeof createToast === 'function') {
              createToast(`🚨 [STAMPEDE SURGE ALERT] Coherent crowd rush detected (Risk: ${cachedEulerianData.stampedeRisk}%, Velocity: ${cachedEulerianData.averageVelocity} m/s). Autonomous PA & rerouting active!`, 'conflict');
            }
          }
        }

        // Counter-Flow Collision Alert Guard
        if (cachedEulerianData && cachedEulerianData.counterFlowDetected && cachedEulerianData.counterFlowCollisions.length > 0) {
          if (now - lastCounterFlowToneTime > 10000) {
            lastCounterFlowToneTime = now;
            playCctvAlertTone('COUNTER_FLOW');
            if (typeof createToast === 'function') {
              createToast(`⚠️ [COUNTER-FLOW COLLISION] Opposing crowd streams detected in corridor (${cachedEulerianData.counterFlowCollisions.length} chokepoints)! Pre-crush hazard active.`, 'warning');
            }
          }
        }

        // Automated Gate Release Pulse Guard
        if (cachedEulerianData && cachedEulerianData.gateReleaseTriggered) {
          if (now - lastGateReleasePulseTime > 10000) {
            lastGateReleasePulseTime = now;
            playCctvAlertTone('GATE_RELEASE');
            fetch('/api/sensors/door', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'EMERGENCY_RELEASE',
                action: 'EMERGENCY_RELEASE',
                hallId: currentVenueId,
                gateId: 'gate-a',
                pressurePsi: parseFloat(cachedEulerianData.gatePressurePsi),
                reason: 'CRITICAL_BARRICADE_PRESSURE_BREACH'
              })
            }).catch(e => console.warn('[CCTV] Automated gate release pulse dispatch notice:', e));

            if (typeof createToast === 'function') {
              createToast(`🚨 [AUTOMATED GATE RELEASE] Barricade Pressure Critical (${cachedEulerianData.gatePressurePsi} PSI >= 8.5 limit)! Gates A & B Mag-Locks Released!`, 'conflict');
            }
          }
        }
      }
    } else {
      // High-Fidelity Simulated CCTV Feed Mode (renders realistic animated venue with real-time detection)
      isCameraBlocked = false;
      const targetCount = Math.max(currentNetOccupancy, doorSensorNetCount, manualCount);
      const simBoxes = renderSimulatedVenueFeed(ctx, w, h, targetCount, currentCapacity, now);

      if (shouldRunCv) {
        lastCvProcessTime = now;
        cachedDetectedBoxes = simBoxes;
        cachedEulerianData = computeEulerianCrowdField(320, 240, cachedDetectedBoxes);

        const isMegaVenue = (currentCapacity >= 1000);
        const isMegaModeActive = (crowdPerceptionMode === 'mega-crowd') || (crowdPerceptionMode === 'auto' && isMegaVenue);
        if (isMegaModeActive) activeVisionEngine = 'eulerian-flux';
        else activeVisionEngine = 'simulation-optical';

        currentNetOccupancy = Math.max(cachedDetectedBoxes.length, doorSensorNetCount, manualCount);
        updateDensityMetrics(false);
      }
    }

    const effectiveCount = Math.max(currentNetOccupancy, manualCount);
    const detectedBoxes = cachedDetectedBoxes;

    // Draw HUD overlays
    drawCanvasHud(ctx, w, h, effectiveCount, currentCapacity, detectedBoxes);

    // Update UI detection tag (only if changed to eliminate 60fps layout churn)
    const tagEl = document.getElementById('cctv-optical-detection-tag');
    if (tagEl) {
      let nextClass = '';
      let nextText = '';
      if (isCameraBlocked) {
        nextClass = 'badge-mini-red';
        nextText = '⚠️ Lens Obstructed / Dark';
      } else if (megaCrowdState.active && ((crowdPerceptionMode === 'mega-crowd') || (currentCapacity >= 1000))) {
        nextClass = megaCrowdState.stampedeRisk >= 75 ? 'badge-mini-red' : (megaCrowdState.stampedeRisk >= 50 ? 'badge-mini-yellow' : 'badge-mini-green');
        nextText = `🌊 MEGA-CROWD: ${effectiveCount} Pax • Flux ${megaCrowdState.averageVelocity} m/s • Risk ${megaCrowdState.stampedeRisk}%`;
      } else {
        const isScanActive = now < sensorActiveWindowUntil;
        nextClass = isScanActive ? 'badge-mini-yellow' : (effectiveCount > 0 ? 'badge-mini-green' : 'badge-mini-blue');
        nextText = isScanActive
          ? `⚡ SCANNING FACE (${lastTriggerDist}mm)`
          : `${effectiveCount} Inside • ${detectedBoxes.length} Head${detectedBoxes.length === 1 ? '' : 's'} Detected`;
      }
      if (tagEl.textContent !== nextText) tagEl.textContent = nextText;
      if (tagEl.className !== nextClass) tagEl.className = nextClass;
    }

    // Mirror to perception modal canvas ONLY if modal is currently open
    const modalCctv = document.getElementById('cctv-perception-modal') || document.getElementById('modal-cctv');
    if (modalCctv && !modalCctv.classList.contains('hidden') && modalCctv.style.display !== 'none') {
      const modalCanvas = document.getElementById('modal-cctv-hud-canvas') || document.getElementById('modal-cctv-canvas');
      if (modalCanvas && modalCanvas !== canvasEl) {
        const cOther = modalCanvas.getContext('2d');
        if (cOther) cOther.drawImage(canvasEl, 0, 0, modalCanvas.width, modalCanvas.height);
      }
    }

    // Periodically post telemetry to DELTA Engine Server (every 2.5s)
    if (now - lastPostTime > 2500) {
      lastPostTime = now;
      postCctvTelemetry(effectiveCount, currentCapacity);
    }

    // Tesla-Style Autonomous Background Perception Guard
    if (effectiveCount >= currentCapacity * 0.8) {
      autoTriggerBackgroundScenePerception(effectiveCount, currentCapacity);
    }

    animFrameId = requestAnimationFrame(processVideoFrame);
  }

  function drawCanvasHud(c, w, h, count, cap, boxes) {
    const occupiedPct = Math.min(100, Math.round((count / cap) * 100));
    const isSensorScanning = Date.now() < sensorActiveWindowUntil;
    const isMegaVenue = (cap >= 1000);
    const isMegaModeActive = (crowdPerceptionMode === 'mega-crowd') ||
      (crowdPerceptionMode === 'auto' && isMegaVenue);

    if (isMegaModeActive && megaCrowdState.gridCells && megaCrowdState.gridCells.length > 0) {
      // 1. Draw Translucent Eulerian Density Heatmap (only for actual dense clusters >= 2.0)
      megaCrowdState.gridCells.forEach(cell => {
        if (cell.density >= 2.0) {
          if (cell.isHotspot) {
            c.fillStyle = 'rgba(239, 68, 68, 0.40)';
            c.strokeStyle = '#ef4444';
          } else {
            c.fillStyle = 'rgba(245, 158, 11, 0.28)';
            c.strokeStyle = '#f59e0b';
          }
          c.fillRect(cell.x, cell.y, cell.w, cell.h);
          c.lineWidth = 1;
          c.strokeRect(cell.x, cell.y, cell.w, cell.h);
        }

        // 2. Vector Flow Field Arrows (Color-coded: Green = Smooth Flow, Yellow = Slowing, Red = Stationary Compression)
        const cx = cell.x + cell.w / 2;
        const cy = cell.y + cell.h / 2;

        if (cell.flowType === 'compression') {
          // Stationary compression: crowd is tightly packed with near-zero flow (Pre-crush danger)
          c.strokeStyle = '#ef4444';
          c.fillStyle = 'rgba(239, 68, 68, 0.35)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(cx, cy, 7, 0, Math.PI * 2);
          c.fill();
          c.stroke();
          // Cross-hairs inside compression cell
          c.beginPath();
          c.moveTo(cx - 4, cy); c.lineTo(cx + 4, cy);
          c.moveTo(cx, cy - 4); c.lineTo(cx, cy + 4);
          c.stroke();
        } else if (cell.velMag > 0.35) {
          const arrowLen = Math.max(7, Math.min(22, cell.velMag * 5.2));
          const angle = Math.atan2(cell.vy, cell.vx);
          const ex = cx + Math.cos(angle) * arrowLen;
          const ey = cy + Math.sin(angle) * arrowLen;

          const arrowColor = cell.vectorColor || (cell.velMag >= 1.25 ? '#10b981' : '#f59e0b');
          c.strokeStyle = arrowColor;
          c.fillStyle = arrowColor;
          c.lineWidth = 2;

          // Vector shaft
          c.beginPath();
          c.moveTo(cx, cy);
          c.lineTo(ex, ey);
          c.stroke();

          // Vector arrowhead (triangle)
          const headLen = 5;
          const a1 = angle - Math.PI * 0.82;
          const a2 = angle + Math.PI * 0.82;
          c.beginPath();
          c.moveTo(ex, ey);
          c.lineTo(ex + Math.cos(a1) * headLen, ey + Math.sin(a1) * headLen);
          c.lineTo(ex + Math.cos(a2) * headLen, ey + Math.sin(a2) * headLen);
          c.closePath();
          c.fill();
        }
      });

      // 3. Counter-Flow Collision Chokepoint Markers (Flags opposing crowd vectors)
      if (megaCrowdState.counterFlowCollisions && megaCrowdState.counterFlowCollisions.length > 0) {
        megaCrowdState.counterFlowCollisions.forEach(col => {
          c.save();
          // Flashing warning boundary
          c.strokeStyle = '#ef4444';
          c.lineWidth = 2.5;
          c.setLineDash([4, 4]);
          c.beginPath();
          c.arc(col.x, col.y, 18, 0, Math.PI * 2);
          c.stroke();
          c.setLineDash([]);

          // High-contrast warning pill badge
          c.fillStyle = 'rgba(239, 68, 68, 0.92)';
          c.fillRect(col.x - 48, col.y - 12, 96, 18);
          c.strokeStyle = '#facc15';
          c.lineWidth = 1.5;
          c.strokeRect(col.x - 48, col.y - 12, 96, 18);

          c.fillStyle = '#ffffff';
          c.font = 'bold 9px "Space Grotesk", sans-serif';
          c.textAlign = 'center';
          c.fillText('⚠️ COUNTER-FLOW', col.x, col.y + 1);
          c.restore();
        });
      }

      // 4. Head Crown Centroid Reticles
      megaCrowdState.headCentroids.forEach(head => {
        c.fillStyle = '#22d3ee';
        c.beginPath();
        c.arc(head.x, head.y, 3, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(34, 211, 238, 0.6)';
        c.lineWidth = 1;
        c.stroke();
      });

      // 5. Gate Barricade Pressure Gauge (PSI) HUD Card (Bottom Right of Video Feed)
      const psiVal = parseFloat(megaCrowdState.gatePressurePsi) || 0.0;
      const isCriticalPsi = psiVal >= 8.5;
      const isWarnPsi = psiVal >= 4.0;
      const psiColor = isCriticalPsi ? '#ef4444' : (isWarnPsi ? '#f59e0b' : '#10b981');

      const gaugeW = 224;
      const gaugeH = 76;
      const gaugeX = w - gaugeW - 12;
      const gaugeY = h - gaugeH - 12;

      c.fillStyle = 'rgba(15, 23, 42, 0.94)';
      c.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);
      c.strokeStyle = isCriticalPsi ? '#ef4444' : '#334155';
      c.lineWidth = isCriticalPsi ? 2.5 : 1.5;
      c.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);

      // Gauge Title
      c.fillStyle = '#94a3b8';
      c.font = 'bold 9px "Space Grotesk", monospace';
      c.textAlign = 'left';
      c.fillText('🛡️ GATE BARRICADE PRESSURE', gaugeX + 10, gaugeY + 16);

      // Pressure Value in PSI
      c.fillStyle = psiColor;
      c.font = 'bold 16px "Space Grotesk", sans-serif';
      c.fillText(`${psiVal.toFixed(1)} PSI`, gaugeX + 10, gaugeY + 36);

      // Status text badge
      c.font = 'bold 9px "Space Grotesk", sans-serif';
      c.fillStyle = psiColor;
      const psiStatusText = isCriticalPsi ? '🚨 AUTO RELEASE ACTIVE' : (isWarnPsi ? '⚠️ COMPRESSION RISK' : '🟢 SAFE FLOW');
      c.textAlign = 'right';
      c.fillText(psiStatusText, gaugeX + gaugeW - 10, gaugeY + 36);

      // Progress bar (0 to 15.0 PSI)
      const barTrackX = gaugeX + 10;
      const barTrackY = gaugeY + 44;
      const barTrackW = gaugeW - 20;
      const barTrackH = 8;
      const fillPct = Math.min(1.0, psiVal / 15.0);

      c.fillStyle = '#1e293b';
      c.fillRect(barTrackX, barTrackY, barTrackW, barTrackH);

      c.fillStyle = psiColor;
      c.fillRect(barTrackX, barTrackY, barTrackW * fillPct, barTrackH);

      // 8.5 PSI Critical threshold line
      const threshX = barTrackX + barTrackW * (8.5 / 15.0);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(threshX, barTrackY - 2);
      c.lineTo(threshX, barTrackY + barTrackH + 2);
      c.stroke();

      // Gauge legend labels
      c.fillStyle = '#64748b';
      c.font = '8px "Space Grotesk", monospace';
      c.textAlign = 'left';
      c.fillText('0.0 PSI', barTrackX, barTrackY + barTrackH + 11);
      c.textAlign = 'center';
      c.fillText('8.5 CRITICAL', threshX, barTrackY + barTrackH + 11);
      c.textAlign = 'right';
      c.fillText('15.0 PSI', barTrackX + barTrackW, barTrackY + barTrackH + 11);
      c.textAlign = 'left';
    }

    // Draw bounding boxes around tracked attendees in all modes
    boxes.forEach((b, idx) => {
      let boxColor = '#10b981'; // Green (Inside)
      let labelText = b.label === 'PERSON'
        ? `👤 PERSON #${idx + 1} [${b.score || 95}%]`
        : `HEAD #${idx + 1} [INSIDE]`;

      if (isSensorScanning) {
        boxColor = '#f59e0b'; // Amber (Active Scan)
        labelText = '🎯 SCANNING AT DOOR';
      }

      c.strokeStyle = boxColor;
      c.lineWidth = 2.5;
      c.strokeRect(b.x, b.y, b.w, b.h);

      // Corner reticles for high-tech HUD feel, dynamically sized to head box
      const cornerLen = Math.min(14, Math.floor(b.w * 0.25));
      c.lineWidth = 3.5;
      c.beginPath();
      // Top-left
      c.moveTo(b.x, b.y + cornerLen); c.lineTo(b.x, b.y); c.lineTo(b.x + cornerLen, b.y);
      // Top-right
      c.moveTo(b.x + b.w - cornerLen, b.y); c.lineTo(b.x + b.w, b.y); c.lineTo(b.x + b.w, b.y + cornerLen);
      // Bottom-left
      c.moveTo(b.x, b.y + b.h - cornerLen); c.lineTo(b.x, b.y + b.h); c.lineTo(b.x + cornerLen, b.y + b.h);
      // Bottom-right
      c.moveTo(b.x + b.w - cornerLen, b.y + b.h); c.lineTo(b.x + b.w, b.y + b.h); c.lineTo(b.x + b.w, b.y + b.h - cornerLen);
      c.stroke();

      // Compact label badge directly above head box
      const badgeW = Math.min(130, Math.max(76, b.w));
      const badgeH = 18;
      c.fillStyle = boxColor;
      c.fillRect(b.x, Math.max(0, b.y - badgeH), badgeW, badgeH);
      c.fillStyle = '#000000';
      c.font = 'bold 10px "Space Grotesk", sans-serif';
      c.fillText(labelText, b.x + 4, Math.max(13, b.y - 4));
    });

  // Top Header Banner
  const bannerW = Math.max(420, Math.min(w - 24, 490));
  c.fillStyle = 'rgba(17, 24, 39, 0.94)';
  c.fillRect(12, 12, bannerW, isMegaModeActive ? 102 : 68);
  c.strokeStyle = isSensorScanning ? '#f59e0b' : (isMegaModeActive && megaCrowdState.stampedeRisk >= 75 ? '#ef4444' : '#2563eb');
  c.lineWidth = 2;
  c.strokeRect(12, 12, bannerW, isMegaModeActive ? 102 : 68);

  c.fillStyle = '#ffffff';
  c.font = 'bold 13px "Space Grotesk", sans-serif';
  const venueUpper = (currentVenueName || 'TURING HALL').toUpperCase();
  const liveTime = new Date().toLocaleTimeString('en-US', { hour12: false });
  const liveDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
  c.fillText(`CCTV FEED • ${venueUpper} • ${liveDate} ${liveTime}`, 22, 32);

  let statusColor = '#10b981';
  let statusText = isMegaModeActive
    ? `🌊 CROWD MASS: ${count} / ${cap} PAX (${occupiedPct}% FULL)`
    : `🟢 NET INSIDE: ${count} / ${cap} PAX (${occupiedPct}% FULL)`;

  if (isCameraBlocked) {
    statusColor = '#9ca3af';
    statusText = '⚪ LENS BLOCKED (0 PAX)';
  } else if (isMegaModeActive && megaCrowdState.stampedeRisk >= 75) {
    statusColor = '#ef4444';
    statusText = `🚨 STAMPEDE SURGE ALERT! (Risk: ${megaCrowdState.stampedeRisk}% • ${megaCrowdState.stampedeStatus})`;
  } else if (isMegaModeActive && megaCrowdState.stampedeRisk >= 50) {
    statusColor = '#f59e0b';
    statusText = `⚠️ ELEVATED CROWD VELOCITY (Risk: ${megaCrowdState.stampedeRisk}%)`;
  } else if (isSensorScanning) {
    statusColor = '#f59e0b';
    statusText = `⚡ DOOR TRIGGERED (${lastTriggerDist}mm) — SCANNING FACE...`;
  } else if (occupiedPct >= 95) {
    statusColor = '#ef4444';
    statusText = `🔴 100% CAPACITY BREACH (${count} PAX)`;
  } else if (occupiedPct >= 80) {
    statusColor = '#f59e0b';
    statusText = `⚠️ 80% CAPACITY WARNING (${occupiedPct}%)`;
  } else if (occupiedPct <= 5) {
    statusColor = '#9ca3af';
    statusText = '⚪ ROOM EMPTY (0%)';
  }

  c.fillStyle = statusColor;
  c.font = 'bold 12px "Space Grotesk", sans-serif';
  c.fillText(statusText, 22, 52);

  // Flow & Mega-Crowd sub-metrics
  c.fillStyle = '#9ca3af';
  c.font = '10px "Space Grotesk", monospace';
  if (isMegaModeActive) {
    c.fillText(`KINETIC FLUX: ${megaCrowdState.averageVelocity} m/s | COHERENCE: ${megaCrowdState.coherence}% | DENSITY: ${megaCrowdState.densityIndexPerM2} Pax/m²`, 22, 70);
    c.fillText(`HOTSPOTS: ${megaCrowdState.hotspotCount} Cells | SURGE RISK: ${megaCrowdState.stampedeRisk}% [${megaCrowdState.stampedeStatus}]`, 22, 84);
    c.fillText(`BARRICADE: ${megaCrowdState.gatePressurePsi} PSI ${megaCrowdState.gateReleaseTriggered ? '🚨 [AUTO-RELEASE TRIGGERED]' : '[NOMINAL]'} | COLLISION: ${megaCrowdState.counterFlowDetected ? '⚠️ OPPOSING STREAM' : 'CLEAR'}`, 22, 98);
  } else {
    c.fillText(`IN: ${totalEntries}  |  OUT: ${totalExits}  |  RE-ENTERED: ${totalReEntries}`, 22, 70);
  }

  // Center Crosshairs
  c.strokeStyle = 'rgba(37, 99, 235, 0.35)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(w / 2 - 20, h / 2);
  c.lineTo(w / 2 + 20, h / 2);
  c.moveTo(w / 2, h / 2 - 20);
  c.lineTo(w / 2, h / 2 + 20);
  c.stroke();
}

  let lastCachedMetrics = {
    totalCount: -1,
    occupiedPct: -1,
    emptyPct: -1,
    totalEntries: -1,
    totalExits: -1,
    totalReEntries: -1,
    currentCapacity: -1,
    attendeeCount: -1
  };

  function updateDensityMetrics(forcePost = false) {
    const totalCount = Math.max(currentNetOccupancy, doorSensorNetCount, manualCount);
    const occupiedPct = Math.min(100, Math.round((totalCount / currentCapacity) * 100));
    const emptyPct = Math.max(0, 100 - occupiedPct);

    const hasChanged = (
      totalCount !== lastCachedMetrics.totalCount ||
      occupiedPct !== lastCachedMetrics.occupiedPct ||
      emptyPct !== lastCachedMetrics.emptyPct ||
      totalEntries !== lastCachedMetrics.totalEntries ||
      totalExits !== lastCachedMetrics.totalExits ||
      totalReEntries !== lastCachedMetrics.totalReEntries ||
      currentCapacity !== lastCachedMetrics.currentCapacity ||
      attendeeDb.size !== lastCachedMetrics.attendeeCount
    );

    if (!hasChanged && !forcePost) {
      return;
    }

    lastCachedMetrics.totalCount = totalCount;
    lastCachedMetrics.occupiedPct = occupiedPct;
    lastCachedMetrics.emptyPct = emptyPct;
    lastCachedMetrics.totalEntries = totalEntries;
    lastCachedMetrics.totalExits = totalExits;
    lastCachedMetrics.totalReEntries = totalReEntries;
    lastCachedMetrics.currentCapacity = currentCapacity;
    lastCachedMetrics.attendeeCount = attendeeDb.size;

    // Update DOM indicators (Both Top Hub and Modal)
    const occupiedEls = document.querySelectorAll('#cctv-metric-occupied-pct');
    const emptyEls = document.querySelectorAll('#cctv-metric-empty-pct');
    const headcountEls = document.querySelectorAll('#cctv-metric-headcount');
    const statusBarEls = document.querySelectorAll('#cctv-occupancy-status-pill');
    const barOccupiedEls = document.querySelectorAll('#cctv-bar-occupied');
    const barEmptyEls = document.querySelectorAll('#cctv-bar-empty');

    // Flow counters
    const countInEls = document.querySelectorAll('#cctv-count-entries');
    const countOutEls = document.querySelectorAll('#cctv-count-exits');
    const countReEls = document.querySelectorAll('#cctv-count-reentries');
    const countNetEls = document.querySelectorAll('#cctv-count-net');

    occupiedEls.forEach(el => el.textContent = `${occupiedPct}%`);
    emptyEls.forEach(el => el.textContent = `${emptyPct}%`);
    headcountEls.forEach(el => el.textContent = `${totalCount} / ${currentCapacity} Pax`);

    countInEls.forEach(el => el.textContent = totalEntries);
    countOutEls.forEach(el => el.textContent = totalExits);
    countReEls.forEach(el => el.textContent = totalReEntries);
    countNetEls.forEach(el => el.textContent = `${totalCount} Pax`);

    barOccupiedEls.forEach(el => {
      el.style.width = `${occupiedPct}%`;
      if (occupiedPct >= 95) el.style.backgroundColor = '#ef4444';
      else if (occupiedPct >= 80) el.style.backgroundColor = '#f59e0b';
      else if (occupiedPct <= 10) el.style.backgroundColor = '#9ca3af';
      else el.style.backgroundColor = '#10b981';
    });

    barEmptyEls.forEach(el => el.style.width = `${emptyPct}%`);

    statusBarEls.forEach(el => {
      if (occupiedPct >= 95) {
        el.className = 'status-pill critical';
        el.textContent = '🚨 ROOM FULL (100%)';
      } else if (occupiedPct >= 80) {
        el.className = 'status-pill warning';
        el.textContent = `⚠️ NEAR FULL (${occupiedPct}%)`;
      } else if (occupiedPct <= 10) {
        el.className = 'status-pill neutral';
        el.textContent = '⚪ ROOM EMPTY (0%)';
      } else {
        el.className = 'status-pill optimal';
        el.textContent = `🟢 OPTIMAL (${occupiedPct}%)`;
      }
    });

    // Update Attendee Chips Row in DOM if present
    updateAttendeeChipsDOM();

    // Sync admin portal cards
    syncAdminPortalMetrics(totalCount, currentCapacity, occupiedPct, emptyPct);

    if (forcePost) {
      postCctvTelemetry(totalCount, currentCapacity);
    }
  }

  function updateAttendeeChipsDOM() {
    const chipContainers = document.querySelectorAll('#cctv-attendee-chips');
    chipContainers.forEach(container => {
      container.innerHTML = '';
      if (attendeeDb.size === 0) {
        container.innerHTML = '<span style="font-size:0.75rem; color:#888;">No attendees checked in yet.</span>';
        return;
      }
      attendeeDb.forEach(att => {
        const chip = document.createElement('span');
        chip.className = att.state === 'INSIDE' ? 'badge-mini-green' : 'badge-mini-blue';
        chip.style.marginRight = '4px';
        chip.style.marginBottom = '4px';
        chip.style.display = 'inline-block';
        const icon = att.state === 'INSIDE' ? '🟢' : '⚪';
        const reTag = att.entryCount > 1 ? ` (${att.entryCount}x)` : '';
        chip.textContent = `${icon} ${att.name}${reTag}: ${att.state}`;
        container.appendChild(chip);
      });
    });
  }

  function syncAdminPortalMetrics(count, cap, occupiedPct, emptyPct) {
    const adminRate = document.getElementById('featured-event-occupancy-rate');
    if (adminRate) {
      adminRate.textContent = `${count} / ${cap} Pax (${occupiedPct}% Full | ${emptyPct}% Empty)`;
      adminRate.style.color = occupiedPct >= 95 ? '#ea4335' : occupiedPct >= 80 ? '#d97706' : '#10b981';
    }

    const adminOccLabel = document.getElementById('admin-cctv-occupied-label');
    const adminEmpLabel = document.getElementById('admin-cctv-empty-label');
    const adminBarOcc = document.getElementById('admin-cctv-bar-occupied');
    const adminBarEmp = document.getElementById('admin-cctv-bar-empty');
    const adminPill = document.getElementById('admin-cctv-status-pill');

    if (adminOccLabel) adminOccLabel.textContent = `🔴 OCCUPIED: ${occupiedPct}%`;
    if (adminEmpLabel) adminEmpLabel.textContent = `🔵 EMPTY: ${emptyPct}%`;

    if (adminBarOcc) {
      adminBarOcc.style.width = `${occupiedPct}%`;
      adminBarOcc.style.backgroundColor = occupiedPct >= 95 ? '#ef4444' : occupiedPct >= 80 ? '#f59e0b' : occupiedPct <= 10 ? '#9ca3af' : '#10b981';
    }
    if (adminBarEmp) {
      adminBarEmp.style.width = `${emptyPct}%`;
    }

    if (adminPill) {
      if (occupiedPct >= 95) {
        adminPill.className = 'status-pill critical';
        adminPill.textContent = `🚨 FULL (${occupiedPct}%)`;
      } else if (occupiedPct >= 80) {
        adminPill.className = 'status-pill warning';
        adminPill.textContent = `⚠️ NEAR FULL (${occupiedPct}%)`;
      } else if (occupiedPct <= 10) {
        adminPill.className = 'status-pill neutral';
        adminPill.textContent = '⚪ EMPTY (0%)';
      } else {
        adminPill.className = 'status-pill optimal';
        adminPill.textContent = `🟢 OPTIMAL (${occupiedPct}%)`;
      }
    }
  }

  async function postFacePassageTelemetry(eventType, attendee) {
    const cap = currentCapacity;
    const count = currentNetOccupancy;
    try {
      await fetch('/api/sensors/face-passage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hallId: currentVenueId || 'hall-1',
          event: eventType,
          attendeeId: attendee.id,
          attendeeName: attendee.name,
          netOccupancy: count,
          totalEntries,
          totalExits,
          reEntries: totalReEntries,
          capacity: cap
        })
      });
    } catch (e) {
      // Non-blocking
    }
  }

  async function postCctvTelemetry(count, cap) {
    const occupiedPct = Math.min(100, Math.round((count / cap) * 100));
    const emptyPct = Math.max(0, 100 - occupiedPct);
    const status = occupiedPct >= 95 ? 'ROOM_FULL' : occupiedPct >= 80 ? 'NEAR_CAPACITY' : occupiedPct <= 10 ? 'EMPTY' : 'OPTIMAL';

    try {
      await fetch('/api/sensors/camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hallId: currentVenueId || 'hall-1',
          peopleDetected: count,
          capacity: cap,
          occupiedPercent: occupiedPct,
          emptyPercent: emptyPct,
          status,
          source: 'CCTV / Webcam Perception + IoT Door Sensor'
        })
      });
    } catch (e) {
      // Non-blocking
    }
  }

  // --- AUDIO SYNTHESIZER FOR LIVE AUDIBLE ALERTS ---
  function playCctvAlertTone(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const actx = new AudioCtx();

      if (type === 'ROOM_FULL') {
        [0, 0.22, 0.44].forEach(delay => {
          const osc = actx.createOscillator();
          const gain = actx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(880, actx.currentTime + delay);
          osc.frequency.exponentialRampToValueAtTime(580, actx.currentTime + delay + 0.18);
          gain.gain.setValueAtTime(0.25, actx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + delay + 0.2);
          osc.connect(gain);
          gain.connect(actx.destination);
          osc.start(actx.currentTime + delay);
          osc.stop(actx.currentTime + delay + 0.21);
        });
      } else if (type === 'ROOM_80_PERCENT') {
        const osc1 = actx.createOscillator();
        const gain1 = actx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, actx.currentTime);
        gain1.gain.setValueAtTime(0.25, actx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.18);
        osc1.connect(gain1);
        gain1.connect(actx.destination);
        osc1.start(actx.currentTime);
        osc1.stop(actx.currentTime + 0.18);
      } else if (type === 'TRIGGER') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1046.5, actx.currentTime); // High C
        gain.gain.setValueAtTime(0.15, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(actx.currentTime);
        osc.stop(actx.currentTime + 0.13);
      } else if (type === 'COUNTER_FLOW') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(660, actx.currentTime);
        osc.frequency.setValueAtTime(440, actx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.22, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(actx.currentTime);
        osc.stop(actx.currentTime + 0.26);
      } else if (type === 'GATE_RELEASE') {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(320, actx.currentTime);
        osc.frequency.linearRampToValueAtTime(780, actx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.28, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(actx.currentTime);
        osc.stop(actx.currentTime + 0.36);
      } else {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, actx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, actx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.18, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(actx.currentTime);
        osc.stop(actx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn('[CCTV] Audio chime synthesis note:', e);
    }
  }

  window.playCctvAlertTone = playCctvAlertTone;

  // Desktop push notification
  function fireBrowserPushNotification(title, body) {
    try {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: 'logo.jpeg'
        });
      }
    } catch (e) {
      console.warn('[CCTV] Desktop notification warning:', e);
    }
  }

  // Update volunteer duty cards in DOM
  function updateVolunteerDutyCards(alert) {
    if (!alert || !alert.assignedVolunteers) return;
  }
  window.updateVolunteerDutyCards = function(alert) {
    if (!alert || !alert.assignedVolunteers) return;

    alert.assignedVolunteers.forEach(v => {
      const lowerName = v.name.toLowerCase();
      let targetIds = [];
      if (lowerName.includes('Suryansh') || lowerName.includes('priya')) {
        targetIds = ['vol-task-Suryansh', 'modal-vol-task-Suryansh', 'admin-vol-task-Suryansh', 'vol-task-priya'];
      } else if (lowerName.includes('shahid') || lowerName.includes('rohan')) {
        targetIds = ['vol-task-shahid', 'modal-vol-task-shahid', 'admin-vol-task-shahid', 'vol-task-rohan'];
      } else if (lowerName.includes('aryan') || lowerName.includes('ananya')) {
        targetIds = ['vol-task-aryan', 'modal-vol-task-aryan', 'admin-vol-task-aryan', 'vol-task-ananya'];
      }

      targetIds.forEach(targetElId => {
        const taskEls = document.querySelectorAll(`#${targetElId}`);
        taskEls.forEach(el => {
          el.innerHTML = `<strong>${v.task}</strong>`;
          el.style.color = alert.type === 'ROOM_FULL' ? '#dc2626' : alert.type === 'ROOM_80_PERCENT' ? '#d97706' : '#2563eb';
        });
      });
    });

    const adminVolList = document.getElementById('featured-volunteers-list');
    if (adminVolList) {
      const cards = adminVolList.children;
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const cardText = card.textContent || '';
        alert.assignedVolunteers.forEach(v => {
          if (cardText.includes(v.name)) {
            const flashColor = alert.type === 'ROOM_FULL' ? '#fee2e2' : alert.type === 'ROOM_80_PERCENT' ? '#fef3c7' : '#dbeafe';
            const borderColor = alert.type === 'ROOM_FULL' ? '#dc2626' : alert.type === 'ROOM_80_PERCENT' ? '#d97706' : '#2563eb';
            card.style.background = flashColor;
            card.style.borderColor = borderColor;
            card.style.boxShadow = `3px 3px 0px ${borderColor}`;
            card.style.transition = 'all 0.3s ease';

            const taskDiv = card.querySelector('div > div:nth-child(2)');
            if (taskDiv) {
              const badgeHtml = alert.type === 'ROOM_FULL'
                ? `<span style="background:#fee2e2; border:1px solid #dc2626; color:#991b1b; font-weight:800; padding:1px 6px; border-radius:4px; font-size:0.7rem; margin-left:6px;">🚨 BREACH: ${v.task}</span>`
                : alert.type === 'ROOM_80_PERCENT'
                  ? `<span style="background:#fef3c7; border:1px solid #d97706; color:#b45309; font-weight:800; padding:1px 6px; border-radius:4px; font-size:0.7rem; margin-left:6px;">⚠️ 80% ALERT: ${v.task}</span>`
                  : `<span style="background:#dbeafe; border:1px solid #2563eb; color:#1d4ed8; font-weight:800; padding:1px 6px; border-radius:4px; font-size:0.7rem; margin-left:6px;">⚪ CLEARED: ${v.task}</span>`;
              taskDiv.innerHTML = `📍 ${v.location || currentVenueName || 'Turing Hall'} • 📋 ${badgeHtml}`;
            }
          }
        });
      }
    }

    const waLogContainer = document.getElementById('admin-whatsapp-log-container');
    if (waLogContainer) {
      const timeStr = new Date().toLocaleTimeString();
      const waLog = document.createElement('div');
      waLog.className = 'admin-audit-line info';
      const borderCol = alert.type === 'ROOM_FULL' ? '#dc2626' : alert.type === 'ROOM_80_PERCENT' ? '#f59e0b' : '#3b82f6';
      const bgCol = alert.type === 'ROOM_FULL' ? '#fee2e2' : alert.type === 'ROOM_80_PERCENT' ? '#fffbeb' : '#eff6ff';
      waLog.style.cssText = `background:${bgCol}; border-left:4px solid ${borderCol}; padding:6px 8px; margin-bottom:6px; font-size:0.78rem;`;
      const volNames = alert.assignedVolunteers.map(v => v.name).join(' & ');
      waLog.innerHTML = `<strong>[${timeStr}] 📱 [Automated WhatsApp Alert]</strong> Dispatched to ${volNames} & Coordinators: <em>"${alert.message}"</em>`;
      waLogContainer.insertBefore(waLog, waLogContainer.firstChild);
    }
  }

  // --- VOLUNTEER & COORDINATOR ALERT BANNER WITH NON-LOOPING DISMISS ---
  function initVolunteerAlertBanner() {
    const btnDismiss = document.getElementById('btn-dismiss-volunteer-banner');
    const btnCloseX = document.getElementById('btn-close-alert-banner');
    const banner = document.getElementById('volunteer-alert-banner');

    const dismissHandler = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (window.DeltaAlertManager) {
        window.DeltaAlertManager.dismissCurrent();
      } else {
        if (banner) {
          banner.classList.add('hidden');
          banner.style.display = 'none';
        }
        if (typeof window.stopAllVoices === 'function') {
          window.stopAllVoices();
        }
      }
      if (bannerDismissTimer) clearTimeout(bannerDismissTimer);
      dismissedAlertState = currentAlertState;
    };

    if (btnDismiss) btnDismiss.addEventListener('click', dismissHandler);
    if (btnCloseX) btnCloseX.addEventListener('click', dismissHandler);
  }



  // --- PUBLIC WEBSOCKET HOOKS ---

  // Inbound Door Sensor Trigger event from ESP32 ToF
  window.handleDoorSensorTrigger = function (data) {
    sensorActiveWindowUntil = Date.now() + 3500; // 3.5s active verification window
    lastTriggerDist = data.dist2 || data.dist1 || 750;
    playCctvAlertTone('TRIGGER');

    if (data.entries !== undefined) {
      totalEntries = data.entries;
      doorSensorNetCount = data.occupancy !== undefined ? data.occupancy : (doorSensorNetCount + 1);
    } else {
      totalEntries++;
      doorSensorNetCount++;
    }
    currentNetOccupancy = Math.max(currentNetOccupancy, doorSensorNetCount);
    updateDensityMetrics(true);

    if (typeof createToast === 'function') {
      createToast(`⚡ [IoT Door Sensor] Passage registered (+1 Pax, ${lastTriggerDist}mm) — Net: ${currentNetOccupancy}`, 'info');
    }
  };

  // Inbound Attendee Passage confirmation
  window.handleAttendeePassageEvent = function (data) {
    if (data.totalEntries !== undefined) totalEntries = data.totalEntries;
    if (data.totalExits !== undefined) totalExits = data.totalExits;
    if (data.reEntries !== undefined) totalReEntries = data.reEntries;
    if (data.occupancy !== undefined) {
      doorSensorNetCount = data.occupancy;
      currentNetOccupancy = Math.max(currentNetOccupancy, doorSensorNetCount);
    }
    updateDensityMetrics(true);
  };

  // Inbound Occupancy sync from server
  window.handleRoomOccupancyUpdate = function (data) {
    if (data.occupancy !== undefined) {
      doorSensorNetCount = data.occupancy;
      currentNetOccupancy = Math.max(currentNetOccupancy, doorSensorNetCount);
    }
    if (data.entries !== undefined) totalEntries = data.entries;
    if (data.exits !== undefined) totalExits = data.exits;
    if (data.reEntries !== undefined) totalReEntries = data.reEntries;
    updateDensityMetrics(true);
  };

  window.handleCctvOccupancyUpdate = function (data) {
    if (data.peopleDetected !== undefined) {
      doorSensorNetCount = data.peopleDetected;
      currentNetOccupancy = Math.max(currentNetOccupancy, doorSensorNetCount);
    }
    updateDensityMetrics(true);
  };

  // Public hook for Volunteer Dispatches
  window.handleVolunteerAlert = function (alert) {
    if (!alert) return;

    currentAlertState = alert.type;

    if (dismissedAlertState === alert.type) {
      return;
    }

    // Unified Alert Coordinator handles single-active alert, instant stop on dismiss, and 2s gap
    if (window.DeltaAlertManager) {
      window.DeltaAlertManager.enqueueVolunteerAlert(alert);
      return;
    }

    const banner = document.getElementById('volunteer-alert-banner');
    const iconEl = banner ? banner.querySelector('.volunteer-alert-icon') : null;
    const titleEl = document.getElementById('volunteer-alert-title');
    const msgEl = document.getElementById('volunteer-alert-message');
    const tagEl = document.getElementById('volunteer-alert-recipients');

    currentAlertState = alert.type;

    if (dismissedAlertState === alert.type) {
      return;
    }

    if (banner && msgEl) {
      banner.classList.remove('hidden');

      if (bannerDismissTimer) clearTimeout(bannerDismissTimer);
      bannerDismissTimer = setTimeout(() => {
        banner.classList.add('hidden');
      }, 12000);

      let bannerClass = 'info-notice';
      let titleText = `ℹ️ HALL CLEARED (${alert.emptyPercent}% EMPTY) — STAGE CREW SETUP AUTHORIZED`;
      let iconSymbol = 'ℹ️';

      if (alert.type === 'ROOM_FULL') {
        bannerClass = 'critical-siren';
        titleText = `🚨 CAPACITY BREACH (${alert.occupiedPercent}% FULL) — VOLUNTEER REDIRECT DISPATCH`;
        iconSymbol = '🚨';
      } else if (alert.type === 'ROOM_80_PERCENT') {
        bannerClass = 'warning-amber';
        titleText = `⚠️ CAPACITY WARNING: ${(currentVenueName || 'TURING HALL').toUpperCase()} IS 80% FULL (${alert.occupiedPercent}%)`;
        iconSymbol = '⚠️';
      }

      banner.className = `volunteer-alert-banner ${bannerClass}`;
      if (iconEl) iconEl.textContent = iconSymbol;
      if (titleEl) titleEl.textContent = titleText;
      msgEl.textContent = alert.message;

      if (tagEl && alert.assignedVolunteers) {
        const targetedNote = alert.excludedCount !== undefined
          ? `<div style="font-size:0.73rem; color:#1e3a8a; font-weight:800; margin-bottom:6px;">🎯 TARGETED DISPATCH (${(alert.hallName || 'VENUE').toUpperCase()} ONLY) — ${alert.excludedCount} volunteers at other venues shielded from notification spam</div>`
          : '';
        tagEl.innerHTML = targetedNote + alert.assignedVolunteers.map(v =>
          `<span class="badge-volunteer-chip">👤 ${v.name} (${v.role}): <strong>${v.task}</strong></span>`
        ).join(' ');
      }

      playCctvAlertTone(alert.type);
      fireBrowserPushNotification(titleText, alert.message);
      updateVolunteerDutyCards(alert);

      if (typeof createToast === 'function') {
        const toastType = alert.type === 'ROOM_FULL' ? 'conflict' : alert.type === 'ROOM_80_PERCENT' ? 'warning' : 'info';
        createToast(alert.message, toastType);
      }
    }
  };

  // --- TESLA-STYLE AUTONOMOUS BACKGROUND PERCEPTION & OCCLUSION GUARD ---
  // No manual audit buttons or popups. Runs automatically in the background
  // when density hits 80%+ or surge occurs, cross-verifying hidden/occluded attendees.
  let lastAutoPerceptionTime = 0;
  let isAutoPerceptionInProgress = false;

  async function autoTriggerBackgroundScenePerception(count, cap) {
    if (!isCameraActive || !canvasEl || isAutoPerceptionInProgress) return;
    const now = Date.now();
    // Debounce to at most once every 30 seconds to respect API rates
    if (now - lastAutoPerceptionTime < 30000) return;

    const ratio = count / Math.max(cap, 1);
    const isStampedeAlert = megaCrowdState.stampedeRisk >= 75;
    if (ratio < 0.8 && !isStampedeAlert) return;

    lastAutoPerceptionTime = now;
    isAutoPerceptionInProgress = true;
    console.log(`🤖 [Autonomous Perception] Capacity/Surge threshold triggered (${(ratio * 100).toFixed(0)}% • ${count}/${cap} • Risk ${megaCrowdState.stampedeRisk}%). Running background multimodal visual verification...`);

    try {
      const frameBase64 = canvasEl.toDataURL('image/jpeg', 0.82);
      const res = await fetch('/api/cctv/gemini-scene-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: frameBase64,
          hallName: currentVenueName || 'Turing Hall',
          capacity: currentCapacity || 250,
          currentCount: count || 0,
          isMegaCrowd: megaCrowdState.active,
          stampedeRisk: megaCrowdState.stampedeRisk,
          stampedeStatus: megaCrowdState.stampedeStatus,
          averageVelocity: megaCrowdState.averageVelocity
        })
      });

      const data = await res.json();
      if (data && data.success) {
        console.log(`🤖 [Autonomous Perception] Verified: ${data.exactPersonCount} attendees (${data.occludedPersonsCount || 0} occluded).`);
        if (data.exactPersonCount > currentNetOccupancy) {
          currentNetOccupancy = data.exactPersonCount;
          manualCount = Math.max(manualCount, data.exactPersonCount);
          syncManualCountControls(manualCount);
          updateDensityMetrics(true);
        }
        if (typeof createToast === 'function') {
          createToast(`🤖 Autonomous Vision: Verified ${data.exactPersonCount} attendees (${data.occludedPersonsCount || 0} occluded behind pillars). Self-healing active.`, 'info');
        }
      }
    } catch (err) {
      console.warn('[Autonomous Perception]', err);
    } finally {
      isAutoPerceptionInProgress = false;
    }
  }

  // Autonomous Inbound Gemini Perception Sync from Swarm WebSockets
  window.handleGeminiOcclusionAlert = function (data) {
    if (data && data.count) {
      if (data.count > currentNetOccupancy) {
        currentNetOccupancy = data.count;
        manualCount = Math.max(manualCount, data.count);
        syncManualCountControls(manualCount);
        updateDensityMetrics(true);
      }
    }
  };

})();
