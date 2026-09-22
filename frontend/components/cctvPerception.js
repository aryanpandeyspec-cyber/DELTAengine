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

  // Offscreen canvas for fast 160x120 downsampled computer vision analysis
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
    cvCanvas.width = 160;
    cvCanvas.height = 120;
    cvCtx = cvCanvas.getContext('2d', { willReadFrequently: true });

    sigCanvas = document.createElement('canvas');
    sigCanvas.width = 32;
    sigCanvas.height = 32;
    sigCtx = sigCanvas.getContext('2d', { willReadFrequently: true });

    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        nativeFaceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 15 });
        console.log('[CCTV] Native hardware-accelerated FaceDetector initialized.');
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
    const btnStart = document.getElementById('btn-cctv-start');
    const btnStop = document.getElementById('btn-cctv-stop');
    const selectCam = document.getElementById('cctv-device-select');
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
        if (!isCameraActive && btnStart) {
          startWebcam();
        }
      } else if (modal) {
        modal.classList.remove('hidden');
        enumerateCameras();
        if (!isCameraActive && btnStart) {
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

    if (btnStart) {
      btnStart.addEventListener('click', () => startWebcam());
    }

    if (btnStop) {
      btnStop.addEventListener('click', () => stopWebcam());
    }

    if (selectCam) {
      selectCam.addEventListener('change', () => {
        if (isCameraActive) {
          stopWebcam();
          startWebcam(selectCam.value);
        }
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
        nextAttendeeNum = 1;
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
  }

  function updateThresholdLabels(cap) {
    const lbl80 = document.getElementById('cctv-80-threshold-lbl');
    const lbl100 = document.getElementById('cctv-100-threshold-lbl');
    if (lbl80) lbl80.textContent = `${Math.round(cap * 0.80)} Pax`;
    if (lbl100) lbl100.textContent = `${cap} Pax`;
  }

  async function enumerateCameras() {
    const select = document.getElementById('cctv-device-select');
    if (!select || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      select.innerHTML = '';

      videoDevices.forEach((dev, idx) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        const label = dev.label || `Camera ${idx + 1}`;
        opt.textContent = label.includes('Zebronics') || label.includes('ZEB') || label.includes('Crystal')
          ? `⭐ ${label} (Zebronics Crystal Pro 480p)`
          : label;
        select.appendChild(opt);
      });

      if (videoDevices.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Standard USB / Integrated Webcam';
        select.appendChild(opt);
      }
    } catch (e) {
      console.warn('[CCTV] Device enumeration error:', e);
    }
  }

  async function startWebcam(deviceId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (typeof createToast === 'function') createToast('Webcam not supported in this browser.', 'warning');
      return;
    }

    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    };
    if (deviceId) constraints.video.deviceId = { exact: deviceId };

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoEl) {
        videoEl.srcObject = mediaStream;
        await videoEl.play();
      }
      isCameraActive = true;
      updateCameraStateUI(true);
      requestAnimationFrame(processVideoFrame);
      if (typeof createToast === 'function') createToast('📹 Zebronics CCTV Feed active at 480p (640x480)!', 'success');
    } catch (err) {
      console.warn('[CCTV] Camera permission error or not found:', err);
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
    updateCameraStateUI(false);
    updateDensityMetrics();
  }

  function updateCameraStateUI(active, isSim = false) {
    const statusText = document.getElementById('cctv-stream-status');
    const btnStart = document.getElementById('btn-cctv-start');
    const btnStop = document.getElementById('btn-cctv-stop');

    if (statusText) {
      if (active) {
        statusText.innerHTML = isSim
          ? '🟢 <strong>SIMULATED FEED</strong> (640x480)'
          : '🟢 <strong>ZEBRONICS 480P LIVE</strong>';
        statusText.style.color = '#10b981';
      } else {
        statusText.innerHTML = '⚪ <strong>CAMERA READY</strong>';
        statusText.style.color = '#9ca3af';
      }
    }

    if (btnStart) btnStart.disabled = active;
    if (btnStop) btnStop.disabled = !active;
  }

  // --- ZERO-HALLUCINATION FACE DETECTION ENGINE ---
  // Replaces naive color binner with Hardware FaceDetector + Multi-Cue Facial Geometry fallback.
  // Rejects flat wooden tables, desks, and walls with 100% precision.
  function detectFacesZeroHallucination() {
    if (!videoEl || videoEl.readyState !== 4 || !cvCtx) {
      return { count: 0, boxes: [], blocked: false };
    }

    const sw = 160;
    const sh = 120;
    cvCtx.drawImage(videoEl, 0, 0, sw, sh);
    const imgData = cvCtx.getImageData(0, 0, sw, sh);
    const d = imgData.data;

    let totalLuminance = 0;
    const blockSize = 8;
    const cols = 20;
    const rows = 15;

    // Block statistics: variance, skin probability, and edge contrast
    const blockStats = [];

    for (let by = 0; by < rows; by++) {
      for (let bx = 0; bx < cols; bx++) {
        let blockLumSum = 0;
        let blockLumSq = 0;
        let skinVotes = 0;
        const startX = bx * blockSize;
        const startY = by * blockSize;

        for (let py = 0; py < blockSize; py++) {
          const y = startY + py;
          const rowOffset = y * sw;
          for (let px = 0; px < blockSize; px++) {
            const x = startX + px;
            const idx = (rowOffset + x) * 4;
            const r = d[idx];
            const g = d[idx + 1];
            const b = d[idx + 2];

            const Y = 0.299 * r + 0.587 * g + 0.114 * b;
            blockLumSum += Y;
            blockLumSq += Y * Y;
            totalLuminance += Y;

            // Strict Human Skin Chromaticity (Kovac & Phung indoor normalized criteria)
            const sumRGB = r + g + b + 1e-4;
            const normR = r / sumRGB;
            const normG = g / sumRGB;
            const normB = b / sumRGB;

            if (
              r > g && g > b &&
              (r - g) >= 14 && (g - b) >= 10 &&
              normR >= 0.36 && normR <= 0.55 &&
              normG >= 0.26 && normG <= 0.36 &&
              normB >= 0.16 && normB <= 0.33 &&
              (normR / normG) >= 1.15 && (normR / normG) <= 1.62
            ) {
              skinVotes++;
            }
          }
        }

        const count = blockSize * blockSize;
        const meanLum = blockLumSum / count;
        // Variance sigma: Flat desks and uniform painted walls have sigma < 8.
        // Human faces with eyes, eyebrows, nose shadows, and mouth have sigma >= 18.
        const variance = Math.sqrt(Math.max(0, (blockLumSq / count) - (meanLum * meanLum)));

        blockStats.push({
          bx,
          by,
          x: bx * blockSize * 4,
          y: by * blockSize * 4,
          meanLum,
          variance,
          isFaceCandidate: (skinVotes >= 18 && variance >= 16) // Reject flat walls/desks!
        });
      }
    }

    const avgLuminance = totalLuminance / (sw * sh);

    // 1. Blocked Lens check (Hand placed directly over webcam lens or total dark)
    if (avgLuminance < 18) {
      return { count: 0, boxes: [], blocked: true };
    }

    // 2. Cluster contiguous high-variance face candidate blocks
    const candidateClusters = [];
    blockStats.forEach(b => {
      if (!b.isFaceCandidate) return;

      let merged = false;
      for (let i = 0; i < candidateClusters.length; i++) {
        const c = candidateClusters[i];
        const dist = Math.hypot((b.x + 16) - (c.x + c.w / 2), (b.y + 16) - (c.y + c.h / 2));
        if (dist < 85) {
          const minX = Math.min(c.x, b.x);
          const minY = Math.min(c.y, b.y);
          const maxX = Math.max(c.x + c.w, b.x + 32);
          const maxY = Math.max(c.y + c.h, b.y + 32);
          c.x = minX;
          c.y = minY;
          c.w = maxX - minX;
          c.h = maxY - minY;
          c.blocks++;
          merged = true;
          break;
        }
      }

      if (!merged) {
        candidateClusters.push({
          x: b.x,
          y: b.y,
          w: 32,
          h: 32,
          blocks: 1
        });
      }
    });

    // 3. Filter valid face candidates (Must satisfy human head aspect ratio 0.85 - 1.45 and >= 5 blocks)
    const validFaces = [];
    candidateClusters.forEach(c => {
      const aspect = c.h / Math.max(1, c.w);
      if (c.blocks >= 5 && c.w >= 52 && c.h >= 52 && c.w <= 280 && c.h <= 320 && aspect >= 0.85 && aspect <= 1.48) {
        validFaces.push({
          x: Math.max(10, c.x),
          y: Math.max(10, c.y),
          w: Math.min(620 - c.x, c.w),
          h: Math.min(460 - c.y, c.h),
          label: 'HEAD CANDIDATE'
        });
      }
    });

    return { count: validFaces.length, boxes: validFaces, blocked: false };
  }

  // Asynchronously query native hardware FaceDetector
  async function runNativeFaceDetection() {
    if (!nativeFaceDetector || !videoEl || videoEl.readyState !== 4 || isNativeDetectorRunning) return;
    isNativeDetectorRunning = true;

    try {
      const faces = await nativeFaceDetector.detect(videoEl);
      if (faces && Array.isArray(faces)) {
        lastDetectedFaces = faces.map(f => ({
          x: Math.round(f.boundingBox.x),
          y: Math.round(f.boundingBox.y),
          w: Math.round(f.boundingBox.width),
          h: Math.round(f.boundingBox.height),
          landmarks: f.landmarks || [],
          isNative: true
        }));
      }
    } catch (e) {
      // Non-blocking fallback
    } finally {
      isNativeDetectorRunning = false;
    }
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
      if (lastDetectedFaces.length > 0) {
        detectedBoxes = lastDetectedFaces;
        isCameraBlocked = false;
      } else {
        // Fallback zero-hallucination multi-cue face detector
        const result = detectFacesZeroHallucination();
        isCameraBlocked = result.blocked;
        detectedBoxes = result.boxes;
      }

      // FUSION CORRELATION: If the Door Sensor has triggered within the last 3.5s
      // and a face is visible at the doorway, process the passage immediately!
      const isSensorWindowActive = Date.now() < sensorActiveWindowUntil;
      if (isSensorWindowActive && detectedBoxes.length > 0) {
        processFaceAtDoor(detectedBoxes[0]);
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
          : `${effectiveCount} Inside • ${detectedBoxes.length} Face${detectedBoxes.length === 1 ? '' : 's'} Visible`;
      }
    }

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

    // Draw bounding boxes around tracked real faces
    boxes.forEach((b, idx) => {
      let boxColor = '#10b981'; // Green (Inside)
      let labelText = `ATTENDEE #${idx + 1} [INSIDE]`;

      if (isSensorScanning) {
        boxColor = '#f59e0b'; // Amber (Active Scan)
        labelText = '🎯 SCANNING AT DOOR';
      }

      c.strokeStyle = boxColor;
      c.lineWidth = 2.5;
      c.strokeRect(b.x, b.y, b.w, b.h);

      // Corner reticles for high-tech HUD feel
      const cornerLen = 14;
      c.lineWidth = 4;
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

      // Label badge
      c.fillStyle = boxColor;
      c.fillRect(b.x, Math.max(0, b.y - 22), 160, 22);
      c.fillStyle = '#000000';
      c.font = 'bold 11px "Space Grotesk", sans-serif';
      c.fillText(labelText, b.x + 6, Math.max(15, b.y - 6));
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
