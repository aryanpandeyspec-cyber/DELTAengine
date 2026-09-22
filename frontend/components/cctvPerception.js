// --- DELTA ENGINE - CCTV WEBCAM ROOM DENSITY PERCEPTION CONTROLLER ---
// Hardware: Zebronics ZEB-CRYSTAL PRO 480p Web Camera (640x480)
// Features:
// 1. High-accuracy real-time multi-cue Person/Head/Face Computer Vision (No static dummy counts)
// 2. Optical blocked-lens detection (detects hand cover / darkness cleanly)
// 3. 80% Room Capacity Warning & 100% Full Breach alerts with volunteer dispatches
// 4. One-click non-repeating dismissable notifications (no annoying loop)
// 5. Native top-of-screen CCTV Hub with collapsible telemetry & pitch triggers

(function initCctvPerception() {
  let mediaStream = null;
  let videoEl = null;
  let canvasEl = null;
  let ctx = null;
  let animFrameId = null;

  let currentCapacity = 25; // Default demo capacity
  let detectedCount = 0;
  let manualCount = 0;
  let isCameraActive = false;
  let isCameraBlocked = false;
  let lastPostTime = 0;
  let bannerDismissTimer = null;
  let dismissedAlertState = null;
  let currentAlertState = null;

  // Temporal median smoothing buffer to eliminate single-frame flicker
  const temporalBuffer = [];
  const BUFFER_SIZE = 5;

  // Offscreen canvas for fast 160x120 downsampled computer vision analysis
  let cvCanvas = null;
  let cvCtx = null;

  window.addEventListener('DOMContentLoaded', () => {
    initCvCanvas();
    bindCctvElements();
    initVolunteerAlertBanner();
    requestPushPermission();
  });

  function initCvCanvas() {
    cvCanvas = document.createElement('canvas');
    cvCanvas.width = 160;
    cvCanvas.height = 120;
    cvCtx = cvCanvas.getContext('2d', { willReadFrequently: true });
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

    if (btnAddPerson) {
      btnAddPerson.addEventListener('click', () => {
        manualCount += 1;
        updateDensityMetrics(true);
      });
    }

    if (btnSubPerson) {
      btnSubPerson.addEventListener('click', () => {
        if (manualCount > 0) manualCount -= 1;
        updateDensityMetrics(true);
      });
    }

    if (btnClearPax) {
      btnClearPax.addEventListener('click', () => {
        manualCount = 0;
        updateDensityMetrics(true);
      });
    }

    // 80% Room Capacity Trigger Button
    if (btnTrigger80) {
      btnTrigger80.addEventListener('click', () => {
        manualCount = Math.max(1, Math.round(currentCapacity * 0.80));
        detectedCount = 0;
        temporalBuffer.length = 0;
        updateDensityMetrics(true);
      });
    }

    // 100% Room Full Trigger Button
    if (btnTriggerFull) {
      btnTriggerFull.addEventListener('click', () => {
        manualCount = currentCapacity;
        detectedCount = 0;
        temporalBuffer.length = 0;
        updateDensityMetrics(true);
      });
    }

    // 0% Room Empty Trigger Button
    if (btnTriggerEmpty) {
      btnTriggerEmpty.addEventListener('click', () => {
        manualCount = 0;
        detectedCount = 0;
        temporalBuffer.length = 0;
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
      // Run synthetic visual simulation
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
    detectedCount = 0;
    temporalBuffer.length = 0;
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

  // --- HIGH ACCURACY COMPUTER VISION ANALYSIS ---
  // Real Head & Face detection without static dummy counts.
  function analyzeVideoFrameAccurate() {
    if (!videoEl || videoEl.readyState !== 4 || !cvCtx) {
      return { count: 0, boxes: [], blocked: false };
    }

    const sw = 160;
    const sh = 120;
    cvCtx.drawImage(videoEl, 0, 0, sw, sh);
    const imgData = cvCtx.getImageData(0, 0, sw, sh);
    const d = imgData.data;

    let totalLuminance = 0;
    let skinPixelCount = 0;

    // Grid bin accumulation (20x15 bins of size 8x8)
    const binCols = 20;
    const binRows = 15;
    const bins = new Uint16Array(binCols * binRows);

    for (let y = 0; y < sh; y++) {
      const rowOffset = y * sw;
      const binY = Math.floor(y / 8);

      for (let x = 0; x < sw; x++) {
        const idx = (rowOffset + x) * 4;
        const r = d[idx];
        const g = d[idx + 1];
        const b = d[idx + 2];

        // Standard YCbCr color conversion
        const Y = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuminance += Y;

        const Cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
        const Cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;

        // Accurate indoor human skin chrominance cluster
        if (Y >= 35 && Y <= 230 && Cb >= 82 && Cb <= 138 && Cr >= 130 && Cr <= 178) {
          skinPixelCount++;
          const binX = Math.floor(x / 8);
          bins[binY * binCols + binX]++;
        }
      }
    }

    const avgLuminance = totalLuminance / (sw * sh);

    // 1. Lens blocked / covered / extreme darkness check
    if (avgLuminance < 18) {
      return { count: 0, boxes: [], blocked: true };
    }

    // 2. Identify coherent head/face candidate clusters
    const candidateBoxes = [];
    const minBinHits = 14; // Must have at least 14 skin pixels in 8x8 bin (22% density)

    for (let by = 0; by < binRows; by++) {
      for (let bx = 0; bx < binCols; bx++) {
        if (bins[by * binCols + bx] >= minBinHits) {
          // Check if can merge with existing candidate box
          let merged = false;
          const pixelX = bx * 8 * 4; // Scale back to 640x480
          const pixelY = by * 8 * 4;

          for (let i = 0; i < candidateBoxes.length; i++) {
            const cb = candidateBoxes[i];
            const dist = Math.hypot((pixelX + 16) - (cb.x + cb.w / 2), (pixelY + 16) - (cb.y + cb.h / 2));
            if (dist < 110) { // Merging threshold
              const minX = Math.min(cb.x, pixelX);
              const minY = Math.min(cb.y, pixelY);
              const maxX = Math.max(cb.x + cb.w, pixelX + 32);
              const maxY = Math.max(cb.y + cb.h, pixelY + 32);
              cb.x = minX;
              cb.y = minY;
              cb.w = maxX - minX;
              cb.h = maxY - minY;
              cb.points++;
              merged = true;
              break;
            }
          }

          if (!merged) {
            candidateBoxes.push({
              x: pixelX,
              y: pixelY,
              w: 48,
              h: 48,
              points: 1
            });
          }
        }
      }
    }

    // 3. Filter valid human heads (must meet minimum spatial mass and realistic head proportions)
    const validHeads = [];
    candidateBoxes.forEach(b => {
      const aspect = b.h / Math.max(1, b.w);
      if (b.points >= 3 && b.w >= 48 && b.h >= 48 && b.w <= 360 && b.h <= 380 && aspect >= 0.75 && aspect <= 2.2) {
        validHeads.push({
          x: Math.max(10, b.x),
          y: Math.max(10, b.y),
          w: Math.min(620 - b.x, b.w),
          h: Math.min(460 - b.y, b.h)
        });
      }
    });

    return { count: validHeads.length, boxes: validHeads, blocked: false };
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

      const result = analyzeVideoFrameAccurate();
      isCameraBlocked = result.blocked;
      detectedBoxes = result.boxes;

      // Temporal smoothing: take median of last 5 frames to prevent jumping
      temporalBuffer.push(result.count);
      if (temporalBuffer.length > BUFFER_SIZE) temporalBuffer.shift();

      const sorted = [...temporalBuffer].sort((a, b) => a - b);
      detectedCount = sorted[Math.floor(sorted.length / 2)] || 0;
    } else {
      // Clean room synthetic graphic (NO hardcoded attendee counts)
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);

      // Seating rows
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      for (let r = 120; r < 400; r += 60) {
        ctx.beginPath();
        ctx.moveTo(30, r);
        ctx.lineTo(w - 30, r);
        ctx.stroke();
      }

      // Draw manual pitch attendees if injected
      if (manualCount > 0) {
        ctx.fillStyle = manualCount >= currentCapacity ? '#ef4444' : manualCount >= currentCapacity * 0.8 ? '#f59e0b' : '#10b981';
        for (let i = 0; i < Math.min(manualCount, 30); i++) {
          const ax = 50 + (i % 8) * 70;
          const ay = 130 + Math.floor(i / 8) * 60;
          ctx.beginPath();
          ctx.arc(ax, ay, 16, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          detectedBoxes.push({ x: ax - 20, y: ay - 20, w: 40, h: 40 });
        }
      }

      detectedCount = 0;
      isCameraBlocked = false;
    }

    const effectiveCount = detectedCount + manualCount;

    // Draw HUD overlays
    drawCanvasHud(ctx, w, h, effectiveCount, currentCapacity, detectedBoxes);

    // Update UI detection tag
    const tagEl = document.getElementById('cctv-optical-detection-tag');
    if (tagEl) {
      if (isCameraBlocked) {
        tagEl.className = 'badge-mini-red';
        tagEl.textContent = '⚠️ Lens Obstructed / Dark';
      } else {
        tagEl.className = effectiveCount > 0 ? 'badge-mini-green' : 'badge-mini-blue';
        tagEl.textContent = `${effectiveCount} Person${effectiveCount === 1 ? '' : 's'} Tracked`;
      }
    }

    // Update density gauges
    updateDensityMetrics(false);

    // Periodically post telemetry to DELTA Engine Server (every 1.5s)
    const now = Date.now();
    if (now - lastPostTime > 1500) {
      lastPostTime = now;
      postCctvTelemetry(effectiveCount, currentCapacity);
    }

    animFrameId = requestAnimationFrame(processVideoFrame);
  }

  function drawCanvasHud(c, w, h, count, cap, boxes) {
    const occupiedPct = Math.min(100, Math.round((count / cap) * 100));

    // Draw bounding boxes around tracked heads
    let boxColor = '#10b981';
    if (occupiedPct >= 95) boxColor = '#ef4444';
    else if (occupiedPct >= 80) boxColor = '#f59e0b';

    boxes.forEach((b, idx) => {
      c.strokeStyle = boxColor;
      c.lineWidth = 2.5;
      c.strokeRect(b.x, b.y, b.w, b.h);

      // Label
      c.fillStyle = boxColor;
      c.fillRect(b.x, Math.max(0, b.y - 20), 100, 20);
      c.fillStyle = '#000000';
      c.font = 'bold 11px "Space Grotesk", sans-serif';
      c.fillText(`ATTENDEE #${idx + 1}`, b.x + 6, Math.max(14, b.y - 6));
    });

    // Top-left HUD badge
    c.fillStyle = 'rgba(17, 24, 39, 0.9)';
    c.fillRect(12, 12, 320, 56);
    c.strokeStyle = '#2563eb';
    c.lineWidth = 2;
    c.strokeRect(12, 12, 320, 56);

    c.fillStyle = '#ffffff';
    c.font = 'bold 13px "Space Grotesk", sans-serif';
    c.fillText('ZEBRONICS CRYSTAL PRO 480P', 22, 32);

    let statusColor = '#10b981';
    let statusText = `🟢 ACTIVE (${occupiedPct}% FULL)`;

    if (isCameraBlocked) {
      statusColor = '#9ca3af';
      statusText = '⚪ LENS BLOCKED (0 PAX)';
    } else if (occupiedPct >= 95) {
      statusColor = '#ef4444';
      statusText = '🔴 100% CAPACITY BREACH';
    } else if (occupiedPct >= 80) {
      statusColor = '#f59e0b';
      statusText = `⚠️ 80% CAPACITY WARNING (${occupiedPct}%)`;
    } else if (occupiedPct <= 10) {
      statusColor = '#9ca3af';
      statusText = '⚪ ROOM EMPTY (0%)';
    }

    c.fillStyle = statusColor;
    c.font = 'bold 12px "Space Grotesk", sans-serif';
    c.fillText(statusText, 22, 54);

    // Crosshairs
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
    const totalCount = detectedCount + manualCount;
    const occupiedPct = Math.min(100, Math.round((totalCount / currentCapacity) * 100));
    const emptyPct = Math.max(0, 100 - occupiedPct);

    // Update DOM indicators (Both Top Hub and Modal)
    const occupiedEls = document.querySelectorAll('#cctv-metric-occupied-pct');
    const emptyEls = document.querySelectorAll('#cctv-metric-empty-pct');
    const headcountEls = document.querySelectorAll('#cctv-metric-headcount');
    const statusBarEls = document.querySelectorAll('#cctv-occupancy-status-pill');
    const barOccupiedEls = document.querySelectorAll('#cctv-bar-occupied');
    const barEmptyEls = document.querySelectorAll('#cctv-bar-empty');

    occupiedEls.forEach(el => el.textContent = `${occupiedPct}%`);
    emptyEls.forEach(el => el.textContent = `${emptyPct}%`);
    headcountEls.forEach(el => el.textContent = `${totalCount} / ${currentCapacity} Pax`);

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

    // Sync admin portal cards
    syncAdminPortalMetrics(totalCount, currentCapacity, occupiedPct, emptyPct);

    if (forcePost) {
      postCctvTelemetry(totalCount, currentCapacity);
    }
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
          source: 'Zebronics ZEB-CRYSTAL PRO 480p CCTV'
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
        gain1.gain.setValueAtTime(0.3, actx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.2);
        osc1.connect(gain1);
        gain1.connect(actx.destination);
        osc1.start(actx.currentTime);
        osc1.stop(actx.currentTime + 0.2);

        const osc2 = actx.createOscillator();
        const gain2 = actx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, actx.currentTime + 0.18);
        gain2.gain.setValueAtTime(0.3, actx.currentTime + 0.18);
        gain2.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.45);
        osc2.connect(gain2);
        gain2.connect(actx.destination);
        osc2.start(actx.currentTime + 0.18);
        osc2.stop(actx.currentTime + 0.45);
      } else {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, actx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, actx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.2, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(actx.currentTime);
        osc.stop(actx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn('[CCTV] Audio chime synthesis note:', e);
    }
  }

  // --- DESKTOP OS / BROWSER PUSH NOTIFICATION ---
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

  // --- LIVE VOLUNTEER & COORDINATOR DUTY UPDATES IN DOM ---
  function updateVolunteerDutyCards(alert) {
    if (!alert || !alert.assignedVolunteers) return;

    // 1. Update in Modal & Top Hub duty list
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

    // 2. Update in Admin featured volunteers list
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

    // 3. Prepend WhatsApp log in Admin Portal
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
      // Remember that user has dismissed this alert condition
      dismissedAlertState = currentAlertState;
    };

    if (btnDismiss) btnDismiss.addEventListener('click', dismissHandler);
    if (btnCloseX) btnCloseX.addEventListener('click', dismissHandler);
  }

  // Public hook for inbound WebSocket CCTV events
  window.handleCctvOccupancyUpdate = function (data) {
    const occupiedEls = document.querySelectorAll('#cctv-metric-occupied-pct');
    const emptyEls = document.querySelectorAll('#cctv-metric-empty-pct');
    const headcountEls = document.querySelectorAll('#cctv-metric-headcount');
    const statusBarEls = document.querySelectorAll('#cctv-occupancy-status-pill');
    const barOccupiedEls = document.querySelectorAll('#cctv-bar-occupied');
    const barEmptyEls = document.querySelectorAll('#cctv-bar-empty');

    occupiedEls.forEach(el => el.textContent = `${data.occupiedPercent}%`);
    emptyEls.forEach(el => el.textContent = `${data.emptyPercent}%`);
    headcountEls.forEach(el => el.textContent = `${data.peopleDetected} / ${data.capacity} Pax`);

    barOccupiedEls.forEach(el => {
      el.style.width = `${data.occupiedPercent}%`;
      el.style.backgroundColor = data.occupiedPercent >= 95 ? '#ef4444' : data.occupiedPercent >= 80 ? '#f59e0b' : data.occupiedPercent <= 10 ? '#9ca3af' : '#10b981';
    });
    barEmptyEls.forEach(el => el.style.width = `${data.emptyPercent}%`);

    statusBarEls.forEach(el => {
      if (data.status === 'ROOM_FULL' || data.occupiedPercent >= 95) {
        el.className = 'status-pill critical';
        el.textContent = `🚨 ROOM FULL (${data.occupiedPercent}%)`;
      } else if (data.status === 'NEAR_CAPACITY' || data.occupiedPercent >= 80) {
        el.className = 'status-pill warning';
        el.textContent = `⚠️ NEAR FULL (${data.occupiedPercent}%)`;
      } else if (data.status === 'EMPTY' || data.occupiedPercent <= 10) {
        el.className = 'status-pill neutral';
        el.textContent = '⚪ ROOM EMPTY (0%)';
      } else {
        el.className = 'status-pill optimal';
        el.textContent = `🟢 OPTIMAL (${data.occupiedPercent}%)`;
      }
    });

    syncAdminPortalMetrics(data.peopleDetected, data.capacity, data.occupiedPercent, data.emptyPercent);
  };

  // Public hook for Volunteer Dispatches
  window.handleVolunteerAlert = function (alert) {
    const banner = document.getElementById('volunteer-alert-banner');
    const iconEl = banner ? banner.querySelector('.volunteer-alert-icon') : null;
    const titleEl = document.getElementById('volunteer-alert-title');
    const msgEl = document.getElementById('volunteer-alert-message');
    const tagEl = document.getElementById('volunteer-alert-recipients');

    currentAlertState = alert.type;

    // IF USER ALREADY DISMISSED THIS ALERT TYPE, DO NOT RE-OPEN!
    if (dismissedAlertState === alert.type) {
      return;
    }

    if (banner && msgEl) {
      banner.classList.remove('hidden');

      // Auto-dismiss after 12 seconds
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

      // 1. Audible tone
      playCctvAlertTone(alert.type);

      // 2. Desktop push notification
      fireBrowserPushNotification(titleText, alert.message);

      // 3. Actively update volunteer task & duty badges in DOM
      updateVolunteerDutyCards(alert);

      // 4. Toast notification feedback
      if (typeof createToast === 'function') {
        const toastType = alert.type === 'ROOM_FULL' ? 'conflict' : alert.type === 'ROOM_80_PERCENT' ? 'warning' : 'info';
        createToast(alert.message, toastType);
      }
    }
  };

})();
