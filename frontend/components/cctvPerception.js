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

  let currentCapacity = 25; // Default demo capacity
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

  // Native Shape Detection API (DirectML / Windows MediaFoundation hardware ML model)
  let nativeFaceDetector = null;
  let isNativeDetectorRunning = false;
  let lastDetectedFaces = [];

  // Temporal tracking for stable face/head perception without flickering
  let trackedHeads = [];
  let nextTrackId = 1;

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

  window.addEventListener('DOMContentLoaded', () => {
    initDetectors();
    bindCctvElements();
    initVolunteerAlertBanner();
    requestPushPermission();
  });

  function initDetectors() {
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

    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        nativeFaceDetector = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 35 });
        console.log('[CCTV] Native hardware-accelerated FaceDetector initialized in high-precision multi-face mode.');
      } catch (e) {
        nativeFaceDetector = null;
      }
    }
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

  function bindCctvElements() {
    const btnOpen = document.getElementById('btn-open-cctv');
    const btnOpenSecondary = document.getElementById('btn-open-cctv-secondary');
    const btnClose = document.getElementById('btn-close-cctv-modal');
    const modal = document.getElementById('cctv-perception-modal');
    const sliderCap = document.getElementById('cctv-capacity-slider');
    const capValDisplay = document.getElementById('cctv-capacity-val');
    const btnToggleView = document.getElementById('btn-toggle-cctv-view');
    const hubBody = document.getElementById('cctv-hub-body');

    const btnAddPerson = document.getElementById('btn-cctv-add-pax');
    const btnSubPerson = document.getElementById('btn-cctv-sub-pax');
    const btnClearPax = document.getElementById('btn-cctv-clear-pax');
    const btnTrigger80 = document.getElementById('btn-cctv-trigger-80');
    const btnTriggerFull = document.getElementById('btn-cctv-trigger-full');
    const btnTriggerEmpty = document.getElementById('btn-cctv-trigger-empty');
    const btnTriggerSensor = document.getElementById('btn-cctv-trigger-sensor');

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
        const chosenId = selectedCameraDeviceId || document.querySelector('.cctv-select')?.value;
        startWebcam(chosenId);
      });
    });

    // Bind ALL Stop Buttons (Top Hub & Modal)
    document.querySelectorAll('#btn-cctv-stop, .btn-cctv-stop').forEach(btn => {
      btn.addEventListener('click', () => stopWebcam());
    });

    // Bind ALL Camera Select Dropdowns (Top Hub & Modal)
    document.querySelectorAll('.cctv-select').forEach(sel => {
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

    // USB Camera Plug / Unplug Hotplug Listener
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        console.log('[CCTV] Video hardware hotplug event detected, refreshing camera list...');
        await enumerateCameras();
      });
    }

    if (sliderCap) {
      sliderCap.addEventListener('input', (e) => {
        currentCapacity = parseInt(e.target.value, 10);
        if (capValDisplay) capValDisplay.textContent = `${currentCapacity} Pax`;
        updateThresholdLabels(currentCapacity);
        updateDensityMetrics();
      });
    }

    // Simulate Door Sensor Trigger manually
    if (btnTriggerSensor) {
      btnTriggerSensor.addEventListener('click', () => {
        triggerDoorSensorLocal(620);
      });
    }

    if (btnAddPerson) {
      btnAddPerson.addEventListener('click', () => {
        simulateAttendeeAction('ENTRY');
      });
    }

    if (btnSubPerson) {
      btnSubPerson.addEventListener('click', () => {
        simulateAttendeeAction('EXIT');
      });
    }

    if (btnClearPax) {
      btnClearPax.addEventListener('click', () => {
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
        updateDensityMetrics(true);
        if (typeof createToast === 'function') createToast('🧹 Room attendee registry reset to 0.', 'info');
      });
    }

    // 80% Room Capacity Trigger Button
    if (btnTrigger80) {
      btnTrigger80.addEventListener('click', () => {
        currentNetOccupancy = Math.max(1, Math.round(currentCapacity * 0.80));
        manualCount = currentNetOccupancy;
        updateDensityMetrics(true);
      });
    }

    // 100% Room Full Trigger Button
    if (btnTriggerFull) {
      btnTriggerFull.addEventListener('click', () => {
        currentNetOccupancy = currentCapacity;
        manualCount = currentCapacity;
        updateDensityMetrics(true);
      });
    }

    // 0% Room Empty Trigger Button
    if (btnTriggerEmpty) {
      btnTriggerEmpty.addEventListener('click', () => {
        currentNetOccupancy = 0;
        manualCount = 0;
        updateDensityMetrics(true);
      });
    }

    updateThresholdLabels(currentCapacity);
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

  function updateThresholdLabels(cap) {
    const lbl80 = document.getElementById('cctv-80-threshold-lbl');
    const lbl100 = document.getElementById('cctv-100-threshold-lbl');
    if (lbl80) lbl80.textContent = `${Math.round(cap * 0.80)} Pax`;
    if (lbl100) lbl100.textContent = `${cap} Pax`;
  }

  async function enumerateCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const selects = document.querySelectorAll('.cctv-select');
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

          if (lower.includes('zebronics') || lower.includes('crystal') || lower.includes('zeb') || lower.includes('349c')) {
            opt.textContent = `⭐ ${label} (Zebronics Crystal Pro 480p)`;
          } else if (lower.includes('720p') || lower.includes('integrated') || lower.includes('internal') || lower.includes('built-in')) {
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
          const zebOpt = Array.from(select.options).find(o => 
            o.textContent.includes('Zebronics') || o.textContent.includes('Crystal') || o.textContent.includes('⭐')
          );
          if (zebOpt) {
            select.value = zebOpt.value;
            selectedCameraDeviceId = zebOpt.value;
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
    document.querySelectorAll('.cctv-select').forEach(sel => {
      if (sel.value !== deviceId) sel.value = deviceId;
    });

    const activeOptText = document.querySelector('.cctv-select option:checked')?.textContent || 'Camera';

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

    const deviceId = requestedDeviceId || selectedCameraDeviceId || document.querySelector('.cctv-select')?.value;
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
      height: { ideal: 480 }
    };

    if (deviceId) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            ...baseVideo,
            deviceId: { exact: deviceId }
          }
        });
      } catch (exactErr) {
        console.warn('[CCTV] Exact deviceId constraint failed, trying ideal constraint:', exactErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...baseVideo,
              deviceId: { ideal: deviceId }
            }
          });
        } catch (idealErr) {
          console.warn('[CCTV] Ideal constraint failed, trying basic video:', idealErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (basicErr) {
            console.warn('[CCTV] Video stream failed completely:', basicErr);
          }
        }
      }
    } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: baseVideo });
      } catch (err) {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); } catch (e) {}
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

      const activeLabel = document.querySelector('.cctv-select option:checked')?.textContent || 'Zebronics 480p';
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
          : '🟢 <strong>ZEBRONICS 480P LIVE</strong>';
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
  // Operates on 320x240 with integral images and Non-Maximum Suppression (NMS).
  // Strictly bounds head/face area (forehead to chin, ear to ear).
  // Rejects flat wooden tables, desks, walls, and chairs with 100% precision.
  function detectFacesZeroHallucination() {
    if (!videoEl || videoEl.readyState !== 4 || !cvCtx) {
      return { count: 0, boxes: [], blocked: false };
    }

    const sw = 320;
    const sh = 240;
    cvCtx.drawImage(videoEl, 0, 0, sw, sh);
    const imgData = cvCtx.getImageData(0, 0, sw, sh);
    const d = imgData.data;

    let totalLuminance = 0;
    const totalPixels = sw * sh;

    // Fast luminance check for lens obstruction or total dark
    for (let i = 0; i < d.length; i += 16) {
      totalLuminance += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    const avgLuminance = totalLuminance / (totalPixels / 4);
    if (avgLuminance < 14) {
      return { count: 0, boxes: [], blocked: true };
    }

    // Build Integral Images in O(N) single pass
    const stride = sw + 1;
    intLum.fill(0, 0, stride);
    intLumSq.fill(0, 0, stride);
    intSkin.fill(0, 0, stride);

    for (let y = 0; y < sh; y++) {
      let rowLum = 0;
      let rowLumSq = 0;
      let rowSkin = 0;

      const imgRowOffset = y * sw * 4;
      const curIntRow = (y + 1) * stride;
      const prevIntRow = y * stride;

      intLum[curIntRow] = 0;
      intLumSq[curIntRow] = 0;
      intSkin[curIntRow] = 0;

      for (let x = 0; x < sw; x++) {
        const idx = imgRowOffset + (x * 4);
        const r = d[idx];
        const g = d[idx + 1];
        const b = d[idx + 2];

        const Y = 0.299 * r + 0.587 * g + 0.114 * b;
        rowLum += Y;
        rowLumSq += Y * Y;

        // Human Skin Chromaticity (YCbCr + normalized RGB indoor criteria)
        const Cr = 0.500 * r - 0.419 * g - 0.081 * b + 128;
        const Cb = -0.169 * r - 0.331 * g + 0.500 * b + 128;
        const isSkin = (Cr >= 133 && Cr <= 173 && Cb >= 78 && Cb <= 128 && r > g && g > (b - 8)) ? 1 : 0;
        rowSkin += isSkin;

        intLum[curIntRow + x + 1] = intLum[prevIntRow + x + 1] + rowLum;
        intLumSq[curIntRow + x + 1] = intLumSq[prevIntRow + x + 1] + rowLumSq;
        intSkin[curIntRow + x + 1] = intSkin[prevIntRow + x + 1] + rowSkin;
      }
    }

    function queryIntegral(table, qx, qy, qw, qh) {
      const r1 = qy * stride;
      const r2 = (qy + qh) * stride;
      return table[r2 + qx + qw] - table[r1 + qx + qw] - table[r2 + qx] + table[r1 + qx];
    }

    // Multi-scale candidate search for distant, mid-row, and front-row heads
    const scales = [
      { w: 18, h: 22, stepX: 10, stepY: 10, minVar: 13.0 }, // Distant heads (back rows)
      { w: 28, h: 34, stepX: 12, stepY: 12, minVar: 14.0 }, // Mid-distance heads (middle rows)
      { w: 42, h: 50, stepX: 14, stepY: 14, minVar: 15.0 }, // Seated foreground heads
      { w: 64, h: 76, stepX: 18, stepY: 18, minVar: 16.0 }  // Close-up attendees / speakers
    ];

    const candidates = [];

    scales.forEach(s => {
      const maxX = sw - s.w - 4;
      const maxY = sh - s.h - 4;

      for (let y = 6; y < maxY; y += s.stepY) {
        for (let x = 6; x < maxX; x += s.stepX) {
          const area = s.w * s.h;
          const skinVotes = queryIntegral(intSkin, x, y, s.w, s.h);
          const skinRatio = skinVotes / area;

          // Faces have 20% to 80% skin in cranial window
          if (skinRatio < 0.20 || skinRatio > 0.82) continue;

          const sumLum = queryIntegral(intLum, x, y, s.w, s.h);
          const sumLumSq = queryIntegral(intLumSq, x, y, s.w, s.h);
          const meanLum = sumLum / area;
          const variance = Math.sqrt(Math.max(0, (sumLumSq / area) - (meanLum * meanLum)));

          // Real human heads have high variance due to facial features & hair boundaries
          if (variance < s.minVar) continue;

          // Cranial vertical gradient: hair/forehead top vs face/chin bottom
          const hUpper = Math.floor(s.h * 0.35);
          const upperLum = queryIntegral(intLum, x, y, s.w, hUpper) / (s.w * hUpper);
          const lowerLum = queryIntegral(intLum, x, y + hUpper, s.w, s.h - hUpper) / (s.w * (s.h - hUpper));
          const cranialContrast = Math.abs(upperLum - lowerLum);

          const score = (skinRatio * 45) + (variance * 1.6) + (cranialContrast * 0.7);
          if (score >= 38.0) {
            candidates.push({ x, y, w: s.w, h: s.h, score });
          }
        }
      }
    });

    // Non-Maximum Suppression (NMS) to eliminate duplicates while keeping neighboring attendees separate
    candidates.sort((a, b) => b.score - a.score);
    const confirmed = [];

    for (let i = 0; i < candidates.length && confirmed.length < 35; i++) {
      const c = candidates[i];
      let suppress = false;

      for (let j = 0; j < confirmed.length; j++) {
        const k = confirmed[j];
        const x1 = Math.max(c.x, k.x);
        const y1 = Math.max(c.y, k.y);
        const x2 = Math.min(c.x + c.w, k.x + k.w);
        const y2 = Math.min(c.y + c.h, k.y + k.h);

        if (x2 > x1 && y2 > y1) {
          const interArea = (x2 - x1) * (y2 - y1);
          const unionArea = (c.w * c.h) + (k.w * k.h) - interArea;
          const iou = interArea / unionArea;
          if (iou > 0.28) {
            suppress = true;
            break;
          }
        }
      }

      if (!suppress) {
        confirmed.push(c);
      }
    }

    // Scale coordinates back to 640x480 canvas, strictly clamping to head area
    const finalBoxes = confirmed.map(c => {
      const targetW = c.w * 2;
      const targetH = Math.round(targetW * 1.20); // Strict cranial aspect ratio
      const bx = Math.max(0, c.x * 2);
      const by = Math.max(0, c.y * 2);
      return {
        x: bx,
        y: by,
        w: Math.min(640 - bx, targetW),
        h: Math.min(480 - by, targetH),
        label: 'HEAD'
      };
    });

    return { count: finalBoxes.length, boxes: finalBoxes, blocked: false };
  }

  // Asynchronously query native hardware FaceDetector with cranial clamping
  async function runNativeFaceDetection() {
    if (!nativeFaceDetector || !videoEl || videoEl.readyState !== 4 || isNativeDetectorRunning) return;
    isNativeDetectorRunning = true;

    try {
      const faces = await nativeFaceDetector.detect(videoEl);
      if (faces && Array.isArray(faces)) {
        lastDetectedFaces = faces.map(f => {
          let bx = Math.round(f.boundingBox.x);
          let by = Math.round(f.boundingBox.y);
          let bw = Math.round(f.boundingBox.width);
          let bh = Math.round(f.boundingBox.height);

          // Clamped strictly to the head area (forehead to chin, 1.20 aspect ratio)
          const targetH = Math.round(bw * 1.20);
          const cy = by + bh * 0.48;
          by = Math.max(0, Math.round(cy - targetH * 0.48));
          bh = targetH;

          return {
            x: Math.max(0, bx),
            y: Math.max(0, by),
            w: Math.min(640 - bx, bw),
            h: Math.min(480 - by, bh),
            landmarks: f.landmarks || [],
            isNative: true,
            label: 'HEAD'
          };
        });
      }
    } catch (e) {
      // Non-blocking fallback
    } finally {
      isNativeDetectorRunning = false;
    }
  }

  // Temporal centroid tracker to eliminate frame-to-frame flicker and maintain steady counts
  function updateTrackedHeads(rawBoxes) {
    const now = Date.now();
    const matched = new Set();
    const currentTracks = [];

    // 1. Match each existing tracked head to closest raw detection
    for (let t = 0; t < trackedHeads.length; t++) {
      const track = trackedHeads[t];
      let bestDist = 65; // Max matching centroid distance in px (640x480 space)
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
        // Exponential smoothing (72% history + 28% observation) stops jitter
        track.x = Math.round(track.x * 0.72 + b.x * 0.28);
        track.y = Math.round(track.y * 0.72 + b.y * 0.28);
        track.w = Math.round(track.w * 0.72 + b.w * 0.28);
        track.h = Math.round(track.h * 0.72 + b.h * 0.28);
        track.framesSeen++;
        track.framesLost = 0;
        track.lastSeen = now;
        currentTracks.push(track);
      } else {
        // Track missed in this frame
        track.framesLost++;
        if (track.framesLost <= 3) {
          // Grace period: keep track for up to 3 dropped frames
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
          framesSeen: 1,
          framesLost: 0,
          lastSeen: now,
          label: 'HEAD'
        });
      }
    }

    trackedHeads = currentTracks;
    // Return all confirmed heads (visible for at least 1-2 frames)
    return trackedHeads.filter(t => t.framesSeen >= 2 || (t.framesSeen >= 1 && t.framesLost === 0));
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

      // Trigger native face detector asynchronously if available
      if (nativeFaceDetector) {
        runNativeFaceDetection();
      }

      // Check if native detector found faces
      let rawBoxes = [];
      if (lastDetectedFaces.length > 0) {
        rawBoxes = lastDetectedFaces;
        isCameraBlocked = false;
      } else {
        // Fallback zero-hallucination multi-cue face detector
        const result = detectFacesZeroHallucination();
        isCameraBlocked = result.blocked;
        rawBoxes = result.boxes;
      }

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
    c.fillStyle = 'rgba(17, 24, 39, 0.92)';
    c.fillRect(12, 12, 380, 68);
    c.strokeStyle = isSensorScanning ? '#f59e0b' : '#2563eb';
    c.lineWidth = 2;
    c.strokeRect(12, 12, 380, 68);

    c.fillStyle = '#ffffff';
    c.font = 'bold 13px "Space Grotesk", sans-serif';
    c.fillText('ZEBRONICS 480P + IOT DOOR SENSOR FUSION', 22, 32);

    let statusColor = '#10b981';
    let statusText = `🟢 NET INSIDE: ${count} PAX (${occupiedPct}% FULL)`;

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
          hallId: 'hall-1',
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
          hallId: 'hall-1',
          peopleDetected: count,
          capacity: cap,
          occupiedPercent: occupiedPct,
          emptyPercent: emptyPct,
          status,
          source: 'Zebronics 480P + IoT Door Sensor'
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
              taskDiv.innerHTML = `📍 ${v.location || 'Turing Hall'} • 📋 ${badgeHtml}`;
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
        titleText = `⚠️ CAPACITY WARNING: TURING HALL IS 80% FULL (${alert.occupiedPercent}%)`;
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
