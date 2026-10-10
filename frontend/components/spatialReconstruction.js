// --- 🏛️ DELTA ENGINE: 3D VENUE SPATIAL RECONSTRUCTION & ROOM DIGITAL TWIN COMPONENT ---
// Dedicated multi-image venue photo staging and 3D architectural twin builder.
// Uses Google Gemini Multimodal Vision API to cross-reference multiple hall angles.

(function () {
  let stagedRoomPhotos = [];
  let active3dRenderer = null;
  let currentSpatialModel = null;

  // Initialize once DOM is ready
  window.addEventListener('DOMContentLoaded', () => {
    initSpatialReconstructionPipeline();
  });

  function initSpatialReconstructionPipeline() {
    const dropZone = document.getElementById('spatial-drop-zone');
    const fileInput = document.getElementById('spatial-file-input');
    const btnAddMore = document.getElementById('btn-add-more-photos');
    const btnLoadLabSamples = document.getElementById('btn-load-sample-lab-photos');
    const btnLoadSamples = document.getElementById('btn-load-sample-hall-photos');
    const btnClearPhotos = document.getElementById('btn-clear-staged-photos');
    const btnReconstruct = document.getElementById('btn-execute-3d-reconstruction');
    const hallSelect = document.getElementById('spatial-target-hall-select');

    if (!dropZone || !fileInput) return;

    // Open file chooser on drop zone click
    dropZone.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      fileInput.click();
    });

    if (btnAddMore) {
      btnAddMore.addEventListener('click', () => fileInput.click());
    }

    // Drag-and-drop event handlers
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-active');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-active');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-active');
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFilesSelected(Array.from(e.dataTransfer.files));
      }
    });

    // File input change handler (supports multiple files)
    fileInput.addEventListener('change', () => {
      if (fileInput.files) {
        handleFilesSelected(Array.from(fileInput.files));
        fileInput.value = '';
      }
    });

    // St. Peter's Real Lab Photos (4 Real Photos)
    if (btnLoadLabSamples) {
      btnLoadLabSamples.addEventListener('click', (e) => {
        e.stopPropagation();
        loadRealLabSamplePhotos();
      });
    }

    // Sample Photos Demo Button (Auditorium)
    if (btnLoadSamples) {
      btnLoadSamples.addEventListener('click', (e) => {
        e.stopPropagation();
        loadDemoSamplePhotos();
      });
    }

    // Clear Staged Photos Button
    if (btnClearPhotos) {
      btnClearPhotos.addEventListener('click', (e) => {
        e.stopPropagation();
        stagedRoomPhotos = [];
        renderStagedPhotosTray();
        if (typeof createToast === 'function') {
          createToast('🧹 Staged room photos cleared.', 'info');
        }
      });
    }

    // Reconstruct Button
    if (btnReconstruct) {
      btnReconstruct.addEventListener('click', () => {
        executeSpatialReconstruction();
      });
    }

    // 3D Canvas View Controls
    bindCanvas3dControls();

    // Calibration Sliders
    bindCalibrationSliders();

    // Auto-initialize default 3D canvas view on load
    setTimeout(() => {
      initDefault3dCanvas();
    }, 200);
  }

  /**
   * Reads selected image files into staged photos array
   */
  function handleFilesSelected(files) {
    const validImageFiles = files.filter(f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(f.name));

    if (validImageFiles.length === 0) {
      if (typeof createToast === 'function') {
        createToast('⚠️ Please upload image files (.jpg, .png, .webp) for 3D room reconstruction.', 'warning');
      }
      return;
    }

    const defaultLabels = [
      '🚪 Entrance / Gate A View',
      '🎤 Stage & Presentation Podium',
      '🪑 Audience Seating & Aisles',
      '📐 Wide Ceiling & Perimeter View',
      '🗺️ Architectural Floorplan / Sketch'
    ];

    validImageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const id = 'photo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const labelIdx = stagedRoomPhotos.length % defaultLabels.length;

        stagedRoomPhotos.push({
          id,
          name: file.name,
          sizeKB: Math.round(file.size / 1024),
          dataUrl: e.target.result,
          label: defaultLabels[labelIdx]
        });

        renderStagedPhotosTray();
      };
      reader.readAsDataURL(file);
    });

    if (typeof createToast === 'function') {
      createToast(`📸 Staged ${validImageFiles.length} photo(s). Ready for multi-angle 3D spatial analysis.`, 'info');
    }
  }

  /**
   * Renders the staged photo gallery tray showing thumbnails, labels, and remove buttons
   */
  function renderStagedPhotosTray() {
    const container = document.getElementById('staged-photos-container');
    const tray = document.getElementById('staged-photos-tray');
    const countBadge = document.getElementById('staged-photos-count-badge');
    const btnReconstruct = document.getElementById('btn-execute-3d-reconstruction');
    const btnClear = document.getElementById('btn-clear-staged-photos');

    if (!container || !tray) return;

    if (countBadge) {
      countBadge.textContent = `${stagedRoomPhotos.length} Photo${stagedRoomPhotos.length === 1 ? '' : 's'} Staged`;
    }

    if (stagedRoomPhotos.length === 0) {
      container.style.display = 'none';
      if (btnReconstruct) {
        btnReconstruct.disabled = true;
        btnReconstruct.style.opacity = '0.5';
        btnReconstruct.style.cursor = 'not-allowed';
      }
      if (btnClear) btnClear.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    tray.innerHTML = '';
    if (btnClear) btnClear.style.display = 'inline-block';

    if (btnReconstruct) {
      btnReconstruct.disabled = false;
      btnReconstruct.style.opacity = '1';
      btnReconstruct.style.cursor = 'pointer';
    }

    stagedRoomPhotos.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'staged-photo-card';
      card.style.cssText = 'background:#ffffff; border:2px solid #000; border-radius:8px; padding:6px; width:140px; display:flex; flex-direction:column; gap:6px; box-shadow:2px 2px 0px #000; position:relative;';

      card.innerHTML = `
        <div style="position:relative; width:100%; height:85px; border:1.5px solid #000; border-radius:5px; overflow:hidden; background:#1e293b;">
          <img src="${item.dataUrl}" alt="${item.name}" style="width:100%; height:100%; object-fit:cover; display:block;">
          <span style="position:absolute; top:3px; left:3px; background:rgba(0,0,0,0.75); color:#fff; font-size:0.62rem; font-family:var(--font-mono); font-weight:800; padding:1px 4px; border-radius:3px;">
            #${index + 1}
          </span>
          <button type="button" class="btn-remove-photo" data-id="${item.id}" title="Remove photo" style="position:absolute; top:3px; right:3px; background:#ef4444; color:#fff; border:1px solid #000; border-radius:50%; width:18px; height:18px; font-size:0.65rem; font-weight:800; display:flex; align-items:center; justify-content:center; cursor:pointer;">
            ✕
          </button>
        </div>
        <div style="font-size:0.72rem; font-weight:700; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">
          ${item.name}
        </div>
        <div style="font-size:0.65rem; color:#64748b; font-family:var(--font-mono); display:flex; justify-content:space-between;">
          <span>${item.sizeKB} KB</span>
          <span style="color:#0284c7; font-weight:700;">Angle ${index + 1}</span>
        </div>
      `;

      tray.appendChild(card);
    });

    // Bind remove button handlers
    tray.querySelectorAll('.btn-remove-photo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const removeId = e.target.closest('button').getAttribute('data-id');
        stagedRoomPhotos = stagedRoomPhotos.filter(p => p.id !== removeId);
        renderStagedPhotosTray();
      });
    });
  }

  /**
   * Loads 4 real-world multi-angle photos of St. Peter's College Computer Systems Lab
   */
  async function loadRealLabSamplePhotos() {
    const photos = [
      { path: '/sample_lab_photos/photo1_window_workstations.png', name: 'stpeters_lab_window_workstations.png', label: '🖥️ North Window Workstations' },
      { path: '/sample_lab_photos/photo2_monitors_posters.png', name: 'stpeters_lab_monitors_posters.png', label: '🖥️ East Monitors & Notice Board' },
      { path: '/sample_lab_photos/photo3_glass_partitions.png', name: 'stpeters_lab_glass_partitions.png', label: '🪟 South Glass Partitions & Desks' },
      { path: '/sample_lab_photos/photo4_cubicle_cooler_ac.png', name: 'stpeters_lab_cubicle_cooler_ac.png', label: '❄️ West Cubicle, Cooler & AC' }
    ];

    try {
      const loaded = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const res = await fetch(p.path);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${p.path}`);
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        loaded.push({
          id: `sample_lab_${i + 1}`,
          name: p.name,
          sizeKB: Math.round(blob.size / 1024),
          dataUrl,
          label: p.label
        });
      }

      stagedRoomPhotos = loaded;
      renderStagedPhotosTray();

      const hallSelect = document.getElementById('spatial-target-hall-select');
      if (hallSelect) {
        const labOpt = Array.from(hallSelect.options).find(o => o.value === 'hall-lab' || o.text.toLowerCase().includes('lab'));
        if (labOpt) {
          hallSelect.value = labOpt.value;
        }
      }

      if (typeof createToast === 'function') {
        createToast("📸 Staged 4 Real Photos of St. Peter's College Systems Lab! Ready to reconstruct 3D twin.", 'success');
      }
    } catch (err) {
      console.error('Failed to load lab photos:', err);
      if (typeof createToast === 'function') {
        createToast(`⚠️ Could not load lab photos: ${err.message}`, 'error');
      }
    }
  }

  /**
   * Generates 3 realistic synthetic venue hall photos (Entrance + Stage + Panoramic)
   */
  function loadDemoSamplePhotos() {
    const makeCanvasImage = (title, subtitle, colorTheme, details) => {
      const c = document.createElement('canvas');
      c.width = 480;
      c.height = 320;
      const ctx = c.getContext('2d');

      // Room perspective backdrop
      const grad = ctx.createLinearGradient(0, 0, 0, 320);
      grad.addColorStop(0, colorTheme[0]);
      grad.addColorStop(1, colorTheme[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 480, 320);

      // Floor grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < 480; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 180); ctx.lineTo(x * 1.4 - 100, 320); ctx.stroke();
      }
      for (let y = 180; y < 320; y += 25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(480, y); ctx.stroke();
      }

      // Border & Header Neubrutalist Tag
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 474, 314);

      // Camera Watermark Badge
      ctx.fillStyle = '#000000';
      ctx.fillRect(16, 16, 210, 26);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 12px "Space Grotesk", monospace';
      ctx.fillText('📷 DELTA VISION CAMERA #01', 24, 34);

      // Center Visual Graphic (Door, Stage, or Seating)
      details(ctx);

      // Bottom Title Bar
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(16, 240, 448, 64);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px "Outfit", sans-serif';
      ctx.fillText(title, 28, 266);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '12px "Space Grotesk", monospace';
      ctx.fillText(subtitle, 28, 288);

      return c.toDataURL('image/jpeg', 0.85);
    };

    const photo1 = makeCanvasImage(
      'Angle 1: Main Ingress Door A (East Wall)',
      'Dimensions: 2.4m double door • ESP32 optical counter synced',
      ['#0f172a', '#1e293b'],
      (ctx) => {
        // Draw Doorway Frame
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(190, 80, 100, 160);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(190, 80, 100, 160);
        ctx.fillStyle = '#0284c7'; ctx.fillRect(195, 85, 43, 150); ctx.fillRect(242, 85, 43, 150);
        // Laser Tripwire Beam
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(190, 170); ctx.lineTo(290, 170); ctx.stroke();
        ctx.fillStyle = '#ef4444'; ctx.fillText('⚡ LASER TRIPWIRE', 188, 70);
      }
    );

    const photo2 = makeCanvasImage(
      'Angle 2: Presentation Stage Front & Podium',
      'Raised 0.85m • 12m wide timber deck • Dual 4K displays',
      ['#1e1b4b', '#312e81'],
      (ctx) => {
        // Draw Stage Platform
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(80, 160); ctx.lineTo(400, 160); ctx.lineTo(440, 210); ctx.lineTo(40, 210);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Podium
        ctx.fillStyle = '#1e293b'; ctx.fillRect(220, 130, 40, 50); ctx.strokeRect(220, 130, 40, 50);
      }
    );

    const photo3 = makeCanvasImage(
      'Angle 3: Wide Panoramic Seating Rows & Aisles',
      '20m × 26m hall • 5.8m ceiling clearance • Center emergency aisle',
      ['#064e3b', '#065f46'],
      (ctx) => {
        // Draw Tiered Seating Rows
        ctx.fillStyle = '#10b981';
        for (let row = 0; row < 4; row++) {
          const y = 90 + row * 24;
          ctx.fillRect(80, y, 130, 14);
          ctx.fillRect(270, y, 130, 14);
        }
        // Center Aisle label
        ctx.fillStyle = '#facc15'; ctx.font = 'bold 11px monospace';
        ctx.fillText('↕ EMERGENCY AISLE (2.2m)', 170, 170);
      }
    );

    stagedRoomPhotos = [
      { id: 'sample_01', name: 'turing_hall_entrance_gate_a.jpg', sizeKB: 412, dataUrl: photo1, label: '🚪 Main Ingress Door A' },
      { id: 'sample_02', name: 'turing_hall_keynote_stage.jpg', sizeKB: 524, dataUrl: photo2, label: '🎤 Presentation Stage' },
      { id: 'sample_03', name: 'turing_hall_wide_panoramic_seating.jpg', sizeKB: 680, dataUrl: photo3, label: '🪑 Seating Rows & Ceiling' }
    ];

    renderStagedPhotosTray();

    if (typeof createToast === 'function') {
      createToast('📸 Loaded 3 multi-angle venue photos! Ready to reconstruct 3D twin.', 'success');
    }
  }

  /**
   * Executes the multi-image 3D spatial reconstruction via Gemini Vision API
   */
  async function executeSpatialReconstruction() {
    if (stagedRoomPhotos.length === 0) {
      if (typeof createToast === 'function') {
        createToast('⚠️ Please stage at least 1 hall photo before reconstructing.', 'warning');
      }
      return;
    }

    const hallSelect = document.getElementById('spatial-target-hall-select');
    const hallId = hallSelect ? hallSelect.value : 'hall-1';
    const hallName = hallSelect ? hallSelect.options[hallSelect.selectedIndex].text.replace(/\(.*\)/, '').trim() : 'Turing Hall';

    const loader = document.getElementById('spatial-loader');
    const stageItems = [
      document.getElementById('spatial-stage-1'),
      document.getElementById('spatial-stage-2'),
      document.getElementById('spatial-stage-3'),
      document.getElementById('spatial-stage-4')
    ];
    const resultsContainer = document.getElementById('spatial-results-container');
    const btnReconstruct = document.getElementById('btn-execute-3d-reconstruction');

    if (loader) loader.style.display = 'block';
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (btnReconstruct) btnReconstruct.disabled = true;

    stageItems.forEach(s => { if (s) s.className = 'stage-item'; });

    if (stageItems[0]) {
      stageItems[0].classList.add('active');
      stageItems[0].innerHTML = `<span class="stage-dot"></span> Ingesting ${stagedRoomPhotos.length} multi-angle photo(s)...`;
    }

    const t1 = setTimeout(() => {
      if (stageItems[0]) stageItems[0].className = 'stage-item done';
      if (stageItems[1]) {
        stageItems[1].classList.add('active');
        stageItems[1].innerHTML = `<span class="stage-dot"></span> Triangulating dimensions & ceiling via Gemini 2.0 Flash...`;
      }
    }, 400);

    const t2 = setTimeout(() => {
      if (stageItems[1]) stageItems[1].className = 'stage-item done';
      if (stageItems[2]) {
        stageItems[2].classList.add('active');
        stageItems[2].innerHTML = `<span class="stage-dot"></span> Mapping doors, stage deck & laser tripwire sensors...`;
      }
    }, 900);

    const t3 = setTimeout(() => {
      if (stageItems[2]) stageItems[2].className = 'stage-item done';
      if (stageItems[3]) {
        stageItems[3].classList.add('active');
        stageItems[3].innerHTML = `<span class="stage-dot"></span> Calibrating egress flow & life-safety capacity...`;
      }
    }, 1400);

    const engineSelect = document.getElementById('spatial-engine-select');
    const engine = engineSelect ? engineSelect.value : 'auto';

    try {
      const payload = {
        hallId,
        hallName,
        engine,
        images: stagedRoomPhotos.map(p => p.dataUrl)
      };

      const res = await fetch('/api/spatial/reconstruct-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      stageItems.forEach(s => { if (s) s.className = 'stage-item done'; });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Spatial reconstruction failed');
      }

      if (loader) loader.style.display = 'none';
      if (btnReconstruct) btnReconstruct.disabled = false;

      currentSpatialModel = data.spatialModel;
      displayReconstructedTwin(data.spatialModel);

      if (typeof createToast === 'function') {
        createToast(`🏛️ 3D Digital Twin Reconstructed: "${hallName}" (${data.spatialModel.dimensions.width}m × ${data.spatialModel.dimensions.length}m, ${data.spatialModel.capacityMetrics.capacity} Pax)!`, 'success');
      }
    } catch (err) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (loader) loader.style.display = 'none';
      if (btnReconstruct) btnReconstruct.disabled = false;
      console.error('[Spatial Reconstruction Error]', err);
      if (typeof createToast === 'function') {
        createToast(`Spatial Reconstruction Error: ${err.message}`, 'warning');
      }
    }
  }

  /**
   * Displays the reconstructed 3D digital twin on canvas and fills in metrics
   */
  function displayReconstructedTwin(sm) {
    const resultsContainer = document.getElementById('spatial-results-container');
    if (resultsContainer) resultsContainer.style.display = 'block';

    // Populate Metrics UI
    const elTitle = document.getElementById('spatial-twin-title');
    const elEngine = document.getElementById('spatial-twin-engine-badge');
    const elDim = document.getElementById('spatial-metric-dim');
    const elArea = document.getElementById('spatial-metric-area');
    const elCap = document.getElementById('spatial-metric-capacity');
    const elDoors = document.getElementById('spatial-metric-doors');
    const elStage = document.getElementById('spatial-metric-stage');
    const elFeatures = document.getElementById('spatial-features-list');

    if (elTitle) elTitle.textContent = `🏛️ ${sm.hallName} — 3D Digital Twin`;
    if (elEngine) elEngine.textContent = `${sm.modelEngine || 'NVIDIA Nemotron / Gemini 3'} (${Math.round((sm.confidenceScore || 0.95) * 100)}% Confidence)`;
    if (elDim) elDim.textContent = `${sm.dimensions.width}m × ${sm.dimensions.length}m (H: ${sm.dimensions.height}m)`;
    if (elArea) elArea.textContent = `${sm.dimensions.areaM2} m²`;
    if (elCap) elCap.textContent = `${sm.capacityMetrics.capacity} Pax (Safe Egress)`;
    if (elDoors) elDoors.textContent = `${sm.doorsCount} Gates (${sm.capacityMetrics.egressFlowRatePaxPerMin} pax/min)`;
    if (elStage) {
      if (!sm.stage || sm.stage.exists === false) {
        elStage.textContent = 'None (Computer Workstation Lab)';
      } else {
        elStage.textContent = `${sm.stage.width}m × ${sm.stage.length}m (Raised ${sm.stage.elevatedM}m)`;
      }
    }

    // Update Slider inputs to match AI detection
    const sWidth = document.getElementById('slider-calib-width');
    const sLength = document.getElementById('slider-calib-length');
    const sDoors = document.getElementById('slider-calib-doors');
    const sCap = document.getElementById('slider-calib-capacity');

    if (sWidth) sWidth.value = sm.dimensions.width;
    if (sLength) sLength.value = sm.dimensions.length;
    if (sDoors) sDoors.value = sm.doorsCount;
    if (sCap) sCap.value = sm.capacityMetrics.capacity;

    updateSliderLabels();

    if (elFeatures && sm.featuresIdentified) {
      elFeatures.innerHTML = sm.featuresIdentified.map(f =>
        `<div style="font-size:0.75rem; color:#1e293b; padding:3px 0; border-bottom:1px dashed #cbd5e1;">✓ <strong>${f}</strong></div>`
      ).join('');
    }

    // Render Canvas
    const canvas = document.getElementById('spatial-reconstruction-canvas');
    if (canvas && typeof RoomSpatialModelRenderer === 'function') {
      const renderOptions = {
        width: sm.dimensions.width,
        length: sm.dimensions.length,
        height: sm.dimensions.height,
        capacity: sm.capacityMetrics.capacity,
        hallName: sm.hallName,
        doorsCount: sm.doorsCount,
        currentOccupancy: window.cctvNetOccupancy || 8,
        venueType: sm.venueType,
        furniture: sm.furniture,
        stage: sm.stage,
        seating: sm.seating,
        doors: sm.doors,
        columns: sm.columns,
        colorPalette: sm.colorPalette
      };

      if (!active3dRenderer) {
        active3dRenderer = new RoomSpatialModelRenderer(canvas, renderOptions);
      } else {
        active3dRenderer.setDimensions(renderOptions);
      }
      active3dRenderer.requestRender();
    }
  }

  function initDefault3dCanvas() {
    const canvas = document.getElementById('spatial-reconstruction-canvas');
    if (canvas && typeof RoomSpatialModelRenderer === 'function' && !active3dRenderer) {
      active3dRenderer = new RoomSpatialModelRenderer(canvas, {
        width: 10,
        length: 13,
        height: 3.2,
        capacity: 20,
        hallName: "St. Peter's College Systems Lab",
        doorsCount: 1,
        currentOccupancy: 8,
        venueType: 'COMPUTER_LAB',
        stage: { exists: false },
        furniture: {
          hasPerimeterComputerDesks: true,
          desktopMonitorsCount: 16,
          chairsCount: 18,
          hasLargeWindowWall: true,
          windowWall: 'NORTH',
          hasGlassPartitions: true,
          hasStorageCupboard: true,
          hasEvaporativeCooler: true,
          hasAcUnit: true,
          deskArrangement: 'PERIMETER_WALLS'
        }
      });
    }
  }

  function bindCanvas3dControls() {
    const btnRotL = document.getElementById('btn-3d-rotate-left');
    const btnRotR = document.getElementById('btn-3d-rotate-right');
    const btnTiltU = document.getElementById('btn-3d-tilt-up');
    const btnTiltD = document.getElementById('btn-3d-tilt-down');
    const btnReset = document.getElementById('btn-3d-reset-view');

    if (btnRotL) btnRotL.addEventListener('click', () => active3dRenderer && active3dRenderer.rotate(-0.25));
    if (btnRotR) btnRotR.addEventListener('click', () => active3dRenderer && active3dRenderer.rotate(0.25));
    if (btnTiltU) btnTiltU.addEventListener('click', () => active3dRenderer && active3dRenderer.tilt(-0.1));
    if (btnTiltD) btnTiltD.addEventListener('click', () => active3dRenderer && active3dRenderer.tilt(0.1));
    if (btnReset) btnReset.addEventListener('click', () => active3dRenderer && active3dRenderer.resetView());
  }

  function bindCalibrationSliders() {
    const sWidth = document.getElementById('slider-calib-width');
    const sLength = document.getElementById('slider-calib-length');
    const sDoors = document.getElementById('slider-calib-doors');
    const sCap = document.getElementById('slider-calib-capacity');
    const btnDeploy = document.getElementById('btn-deploy-calibrated-twin');

    const onSliderChange = () => {
      const width = parseFloat(sWidth?.value || 20);
      const length = parseFloat(sLength?.value || 26);
      const doors = parseInt(sDoors?.value || 3, 10);
      const cap = parseInt(sCap?.value || 250, 10);

      updateSliderLabels();

      if (active3dRenderer) {
        active3dRenderer.setDimensions({
          width,
          length,
          doorsCount: doors,
          capacity: cap
        });
      }
    };

    if (sWidth) sWidth.addEventListener('input', onSliderChange);
    if (sLength) sLength.addEventListener('input', onSliderChange);
    if (sDoors) sDoors.addEventListener('input', onSliderChange);
    if (sCap) sCap.addEventListener('input', onSliderChange);

    if (btnDeploy) {
      btnDeploy.addEventListener('click', async () => {
        const hallSelect = document.getElementById('spatial-target-hall-select');
        const hallId = hallSelect ? hallSelect.value : 'hall-1';
        const hallName = hallSelect ? hallSelect.options[hallSelect.selectedIndex].text.replace(/\(.*\)/, '').trim() : 'Turing Hall';
        const width = parseFloat(sWidth?.value || 20);
        const length = parseFloat(sLength?.value || 26);
        const doors = parseInt(sDoors?.value || 3, 10);
        const capacity = parseInt(sCap?.value || 250, 10);

        try {
          const res = await fetch('/api/spatial/reconstruct-3d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hallId,
              hallName,
              width,
              length,
              doorsCount: doors,
              calculatedCapacity: capacity
            })
          });
          const data = await res.json();
          if (data.success && typeof createToast === 'function') {
            createToast(`✅ Calibrated 3D twin for "${hallName}" deployed to Self-Healing Engine (${capacity} Pax)!`, 'success');
          }
        } catch (e) {
          console.warn('[Deploy Twin]', e);
        }
      });
    }
  }

  function updateSliderLabels() {
    const sWidth = document.getElementById('slider-calib-width');
    const sLength = document.getElementById('slider-calib-length');
    const sDoors = document.getElementById('slider-calib-doors');
    const sCap = document.getElementById('slider-calib-capacity');

    const lWidth = document.getElementById('val-calib-width');
    const lLength = document.getElementById('val-calib-length');
    const lDoors = document.getElementById('val-calib-doors');
    const lCap = document.getElementById('val-calib-capacity');

    if (lWidth && sWidth) lWidth.textContent = `${sWidth.value}m`;
    if (lLength && sLength) lLength.textContent = `${sLength.value}m`;
    if (lDoors && sDoors) lDoors.textContent = `${sDoors.value} Gates`;
    if (lCap && sCap) lCap.textContent = `${sCap.value} Pax`;
  }

  // Hook for WebSocket model updates
  window.handleSpatialModelUpdate = function (data) {
    if (data && data.spatialModel) {
      displayReconstructedTwin(data.spatialModel);
    }
  };
})();
