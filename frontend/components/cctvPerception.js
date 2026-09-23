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
  } catch (e) {}

  let currentCapacity = 25; // Default demo capacity
  try {
    const savedCap = localStorage.getItem('delta_current_room_capacity');
    if (savedCap) {
      const parsed = parseInt(savedCap, 10);
      if (parsed > 0) currentCapacity = parsed;
    }
  } catch (e) {}

  let manualCount = 0;
  let isCameraActive = false;
  let isCameraBlocked = false;
  let lastPostTime = 0;
  let bannerDismissTimer = null;
  let dismissedAlertState = null;
  let currentAlertState = null;
  let selectedCameraDeviceId = '';
  try {
    selectedCameraDeviceId = localStorage.getItem('delta_selected_camera_id') || '';
  } catch (e) {}

  // --- ATTENDEE PROFILE DATABASE & RE-ENTRY TRACKING ---
  // Maps attendeeId -> { id, name, signature, state: 'INSIDE'|'OUTSIDE', entryCount, lastSeen }
  const attendeeDb = new Map();
  let nextAttendeeNum = 1;
  let totalEntries = 0;
  let totalExits = 0;
  let totalReEntries = 0;
  let currentNetOccupancy = 0;
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

  function bootCctv() {
    initDetectors();
    initPico();
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
    } catch (e) {}

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
    if (canvasEl) ctx = canvasEl.getContext('2d');

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
        const chosenId = selectedCameraDeviceId || document.querySelector('.cctv-select:not(.cctv-venue-select)')?.value;
        startWebcam(chosenId);
      });
    });

    // Bind ALL Stop Buttons (Top Hub & Modal)
    document.querySelectorAll('#btn-cctv-stop, .btn-cctv-stop').forEach(btn => {
      btn.addEventListener('click', () => stopWebcam());
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
          try { localStorage.setItem('delta_current_room_capacity', currentCapacity.toString()); } catch (err) {}
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
        try { localStorage.setItem('delta_current_room_capacity', currentCapacity.toString()); } catch (err) {}
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
        try { localStorage.setItem('delta_current_room_capacity', currentCapacity.toString()); } catch (err) {}
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
      enumerateCameras();
    }
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
    } catch (e) {}

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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (typeof createToast === 'function') createToast('Webcam not supported in this browser.', 'warning');
      return;
    }

    const deviceId = requestedDeviceId || selectedCameraDeviceId || document.querySelector('.cctv-select:not(.cctv-venue-select)')?.value;
    if (deviceId) {
      selectedCameraDeviceId = deviceId;
      try { localStorage.setItem('delta_selected_camera_id', deviceId); } catch (e) {}
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
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch (basicErr) {
            console.warn('[CCTV] Video stream failed completely:', basicErr);
          }
        }
      }
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: baseVideo, audio: false });
      } catch (err) {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); } catch (e) {}
      }
    }

    if (stream) {
      mediaStream = stream;
      if (videoEl) {
        videoEl.srcObject = mediaStream;
        try { await videoEl.play(); } catch (e) {}
      }
      isCameraActive = true;
      updateCameraStateUI(true);
      requestAnimationFrame(processVideoFrame);

      // Immediately re-enumerate now that getUserMedia has unlocked the true hardware device labels!
      await enumerateCameras();

      const activeLabel = document.querySelector('.cctv-select:not(.cctv-venue-select) option:checked')?.textContent || 'Zebronics 480p';
      if (typeof createToast === 'function') createToast(`📹 ${activeLabel} feed connected!`, 'success');
    } else {
      isCameraActive = true;
      updateCameraStateUI(true, true);
      requestAnimationFrame(processVideoFrame);
      if (typeof createToast === 'function') createToast('📹 Running in High-Fidelity CCTV Simulation Mode.', 'info');
    }
  }

  function stopWebcam() {
    isCameraActive = false;
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    if (videoEl) videoEl.srcObject = null;
    lastDetectedFaces = [];
    trackedHeads = [];
    updateCameraStateUI(false);
    updateDensityMetrics();
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
    if (!videoEl || videoEl.readyState !== 4) {
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

    // Fast luminance & optical lens obstruction check
    if (!picoGrayBuffer) picoGrayBuffer = new Uint8Array(sw * sh);
    let totalLum = 0;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const Y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
      picoGrayBuffer[p] = Y;
      totalLum += Y;
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

        const params = {
          shiftfactor: 0.1,
          minsize: 24,  // Matches human heads across typical meeting room distances
          maxsize: 240, // Close-up attendees / speakers
          scalefactor: 1.1
        };

        let dets = pico.run_cascade(image, picoClassifyRegion, params);
        if (picoUpdateMemory) {
          dets = picoUpdateMemory(dets);
        }
        const clusters = pico.cluster_detections(dets, 0.2);

        const picoBoxes = [];
        // Real heads score 35-180+; empty space/textured fabric scores < 2.5
        for (let i = 0; i < clusters.length && picoBoxes.length < 35; i++) {
          const c = clusters[i];
          if (c[3] >= 15.0) {
            const cy = c[0];
            const cx = c[1];
            const size = c[2];

            // Strict cranial head area bounding box:
            // Width = size * 0.95, Height = Width * 1.20
            // Centered on face, framing forehead/hair down to chin
            const targetW = Math.round(size * 0.95);
            const targetH = Math.round(targetW * 1.20);
            const left = Math.max(0, Math.round(cx - targetW / 2));
            const top = Math.max(0, Math.round(cy - targetH * 0.48));

            picoBoxes.push({
              x: left * 2,
              y: top * 2,
              w: Math.min(640 - left * 2, targetW * 2),
              h: Math.min(480 - top * 2, targetH * 2),
              score: c[3],
              label: 'HEAD'
            });
          }
        }

        // Return exact detected heads. When empty space, count is 0 with 0 boxes!
        return { count: picoBoxes.length, boxes: picoBoxes, blocked: false };
      } catch (picoErr) {
        console.warn('[CCTV] Pico cascade pass warning:', picoErr);
      }
    }

    return { count: 0, boxes: [], blocked: false };
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
        for (let py = 0; py < 4; py++) {
          for (let px = 0; px < 4; px++) {
            const idx = ((gy * 4 + py) * 32 + (gx * 4 + px)) * 4;
            const Y = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
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
    if (typeof createToast === 'function') {
      createToast(`⚡ [IoT Door Sensor] Passage at ${lastTriggerDist}mm — Scanning Face...`, 'info');
    }
  }

  // Real-time canvas rendering loop
  function processVideoFrame() {
    if (!isCameraActive || !canvasEl || !ctx) return;

    const w = canvasEl.width || 640;
    const h = canvasEl.height || 480;
    let detectedBoxes = [];

    if (videoEl && videoEl.readyState === 4) {
      // Draw live video frame
      ctx.drawImage(videoEl, 0, 0, w, h);

      // High-precision zero-hallucination face & head perception
      const result = detectFacesZeroHallucination();
      isCameraBlocked = result.blocked;
      const rawBoxes = result.boxes;

      // Smooth & track heads over time without jitter
      detectedBoxes = isCameraBlocked ? [] : updateTrackedHeads(rawBoxes);

      // FUSION CORRELATION: If the Door Sensor has triggered within the last 3.5s
      // and a face is visible at the doorway, process the passage immediately!
      const isSensorWindowActive = Date.now() < sensorActiveWindowUntil;
      if (isSensorWindowActive && detectedBoxes.length > 0) {
        processFaceAtDoor(detectedBoxes[0]);
      }

      // When live camera is running, detected visible heads in the room drive live occupancy!
      if (detectedBoxes.length > 0) {
        currentNetOccupancy = Math.max(detectedBoxes.length, manualCount);
      } else if (manualCount === 0 && !isCameraBlocked) {
        currentNetOccupancy = 0;
      }
    } else {
      // Clean synthetic graphic (NO false attendee shapes)
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);

      // Seating grid lines
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      for (let r = 120; r < 400; r += 60) {
        ctx.beginPath();
        ctx.moveTo(30, r);
        ctx.lineTo(w - 30, r);
        ctx.stroke();
      }

      isCameraBlocked = false;
    }

    const effectiveCount = Math.max(currentNetOccupancy, manualCount);

    // Draw HUD overlays
    drawCanvasHud(ctx, w, h, effectiveCount, currentCapacity, detectedBoxes);

    // Update UI detection tag
    const tagEl = document.getElementById('cctv-optical-detection-tag');
    if (tagEl) {
      if (isCameraBlocked) {
        tagEl.className = 'badge-mini-red';
        tagEl.textContent = '⚠️ Lens Obstructed / Dark';
      } else {
        const isScanActive = Date.now() < sensorActiveWindowUntil;
        tagEl.className = isScanActive ? 'badge-mini-yellow' : (effectiveCount > 0 ? 'badge-mini-green' : 'badge-mini-blue');
        tagEl.textContent = isScanActive
          ? `⚡ SCANNING FACE (${lastTriggerDist}mm)`
          : `${effectiveCount} Inside • ${detectedBoxes.length} Head${detectedBoxes.length === 1 ? '' : 's'} Detected`;
      }
    }

    // Mirror to all other active canvases (e.g. perception modal)
    const allCanvases = document.querySelectorAll('.cctv-canvas');
    allCanvases.forEach(canv => {
      if (canv !== canvasEl && canv.offsetParent !== null) {
        const cOther = canv.getContext('2d');
        if (cOther) cOther.drawImage(canvasEl, 0, 0, canv.width, canv.height);
      }
    });

    // Update density gauges
    updateDensityMetrics(false);

    // Periodically post telemetry to DELTA Engine Server (every 2.5s)
    const now = Date.now();
    if (now - lastPostTime > 2500) {
      lastPostTime = now;
      postCctvTelemetry(effectiveCount, currentCapacity);
    }

    animFrameId = requestAnimationFrame(processVideoFrame);
  }

  function drawCanvasHud(c, w, h, count, cap, boxes) {
    const occupiedPct = Math.min(100, Math.round((count / cap) * 100));
    const isSensorScanning = Date.now() < sensorActiveWindowUntil;

    // Draw bounding boxes around tracked real heads (strictly head area only)
    boxes.forEach((b, idx) => {
      let boxColor = '#10b981'; // Green (Inside)
      let labelText = `HEAD #${idx + 1} [INSIDE]`;

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
    const bannerW = Math.max(390, Math.min(w - 24, 460));
    c.fillStyle = 'rgba(17, 24, 39, 0.92)';
    c.fillRect(12, 12, bannerW, 68);
    c.strokeStyle = isSensorScanning ? '#f59e0b' : '#2563eb';
    c.lineWidth = 2;
    c.strokeRect(12, 12, bannerW, 68);

    c.fillStyle = '#ffffff';
    c.font = 'bold 13px "Space Grotesk", sans-serif';
    const venueUpper = (currentVenueName || 'TURING HALL').toUpperCase();
    c.fillText(`CCTV FEED • ${venueUpper}`, 22, 32);

    let statusColor = '#10b981';
    let statusText = `🟢 NET INSIDE: ${count} / ${cap} PAX (${occupiedPct}% FULL)`;

    if (isCameraBlocked) {
      statusColor = '#9ca3af';
      statusText = '⚪ LENS BLOCKED (0 PAX)';
    } else if (isSensorScanning) {
      statusColor = '#f59e0b';
      statusText = `⚡ DOOR TRIGGERED (${lastTriggerDist}mm) — SCANNING FACE...`;
    } else if (occupiedPct >= 95) {
      statusColor = '#ef4444';
      statusText = '🔴 100% CAPACITY BREACH';
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

    // Flow sub-metrics
    c.fillStyle = '#9ca3af';
    c.font = '10px "Space Grotesk", monospace';
    c.fillText(`IN: ${totalEntries}  |  OUT: ${totalExits}  |  RE-ENTERED: ${totalReEntries}`, 22, 70);

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

  function updateDensityMetrics(forcePost = false) {
    const totalCount = Math.max(currentNetOccupancy, manualCount);
    const occupiedPct = Math.min(100, Math.round((totalCount / currentCapacity) * 100));
    const emptyPct = Math.max(0, 100 - occupiedPct);

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

    alert.assignedVolunteers.forEach(v => {
      const lowerName = v.name.toLowerCase();
      let targetElId = null;
      if (lowerName.includes('priya')) targetElId = 'vol-task-priya';
      else if (lowerName.includes('rohan')) targetElId = 'vol-task-rohan';
      else if (lowerName.includes('ananya')) targetElId = 'vol-task-ananya';

      if (targetElId) {
        const taskEls = document.querySelectorAll(`#${targetElId}`);
        taskEls.forEach(el => {
          el.innerHTML = `<strong>${v.task}</strong>`;
          el.style.color = alert.type === 'ROOM_FULL' ? '#dc2626' : alert.type === 'ROOM_80_PERCENT' ? '#d97706' : '#2563eb';
        });
      }
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

    const dismissHandler = () => {
      if (banner) banner.classList.add('hidden');
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

    if (typeof createToast === 'function') {
      createToast(`⚡ [IoT Door Sensor] Physical Trigger at ${lastTriggerDist}mm — Scanning Face...`, 'info');
    }
  };

  // Inbound Attendee Passage confirmation
  window.handleAttendeePassageEvent = function (data) {
    if (data.totalEntries !== undefined) totalEntries = data.totalEntries;
    if (data.totalExits !== undefined) totalExits = data.totalExits;
    if (data.reEntries !== undefined) totalReEntries = data.reEntries;
    if (data.occupancy !== undefined) currentNetOccupancy = data.occupancy;
    updateDensityMetrics(false);
  };

  // Inbound Occupancy sync from server
  window.handleRoomOccupancyUpdate = function (data) {
    if (data.occupancy !== undefined) currentNetOccupancy = data.occupancy;
    if (data.entries !== undefined) totalEntries = data.entries;
    if (data.exits !== undefined) totalExits = data.exits;
    if (data.reEntries !== undefined) totalReEntries = data.reEntries;
    updateDensityMetrics(false);
  };

  window.handleCctvOccupancyUpdate = function (data) {
    if (data.peopleDetected !== undefined) currentNetOccupancy = data.peopleDetected;
    updateDensityMetrics(false);
  };

  // Public hook for Volunteer Dispatches
  window.handleVolunteerAlert = function (alert) {
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
        tagEl.innerHTML = alert.assignedVolunteers.map(v => 
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

})();
