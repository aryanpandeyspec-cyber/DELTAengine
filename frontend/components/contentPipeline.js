// --- AUTOMATED CONTENT & ROOM BLUEPRINT PIPELINE INGESTION WITH REVIEW & EDIT ---

let activePendingFile = null;
let activeModalSpatialRenderer = null;
let activeDashboardSpatialRenderer = null;
let lastIngestedData = null;

function initContentUploadPipeline() {
  const dragZone = document.getElementById('drag-zone');
  const fileInput = document.getElementById('file-input');

  if (!dragZone || !fileInput) return;

  // Accept both presentations and room plan images
  fileInput.setAttribute('accept', '.pdf,.pptx,.ppt,.txt,.png,.jpg,.jpeg,.webp,.svg');

  dragZone.addEventListener('click', () => fileInput.click());

  dragZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragZone.classList.add('drag-active');
  });

  dragZone.addEventListener('dragleave', () => {
    dragZone.classList.remove('drag-active');
  });

  dragZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dragZone.classList.remove('drag-active');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      openUploadReviewModal(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      openUploadReviewModal(fileInput.files[0]);
    }
  });

  // 1-Click Mock Sample Feed Handlers
  const btnBlueprint = document.getElementById('btn-feed-sample-blueprint');
  const btnPhoto = document.getElementById('btn-feed-sample-photo');
  const btnSlides = document.getElementById('btn-feed-sample-slides');

  async function loadSampleMockFile(url, fileName, mimeType) {
    try {
      // Resolve path against host, handling custom port or root serving
      const fetchUrl = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '3000'))
        ? `http://localhost:3000${url}`
        : url;

      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: mimeType });
      openUploadReviewModal(file);
    } catch (err) {
      console.warn(`[Content Pipeline] Network fetch for "${fileName}" fallback to synthetic mock:`, err);
      // High-fidelity in-memory synthetic mock file (guarantees offline/local zero-fail operation)
      const syntheticHeader = `%PDF-1.4\n% DELTAengine Synthetic Mock Architectural Blueprint: Turing Hall (20m x 30m = 600m2)\n1 0 obj\n<< /Title (Turing Hall Blueprint) /Creator (DELTAengine 3.5) >>\nendobj\n%%EOF`;
      const fallbackBlob = new Blob([syntheticHeader], { type: mimeType });
      const fallbackFile = new File([fallbackBlob], fileName, { type: mimeType });
      openUploadReviewModal(fallbackFile);
    }
  }

  if (btnBlueprint) {
    btnBlueprint.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSampleMockFile('/venue_room_plan_blueprint.pdf', 'venue_room_plan_blueprint.pdf', 'application/pdf');
    });
  }

  if (btnPhoto) {
    btnPhoto.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSampleMockFile('/venue_room_plan_blueprint.png', 'venue_room_plan_blueprint.png', 'image/png');
    });
  }

  if (btnSlides) {
    btnSlides.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSampleMockFile('/sample_advanced_wasm_presentation.pdf', 'sample_advanced_wasm_presentation.pdf', 'application/pdf');
    });
  }

  initReviewModalListeners();
}

/**
 * Opens the Ingestion Review & Edit Modal allowing the user to review,
 * calibrate dimensions, calculate people quantity, edit talk details,
 * or inspect the 3D spatial room model before finalizing ingestion.
 */
function openUploadReviewModal(file, isReEdit = false) {
  activePendingFile = file;
  const modal = document.getElementById('modal-upload-review');
  if (!modal) {
    // If modal not found in DOM, fallback directly to execution
    executeIngestion(file, getFormEditedData());
    return;
  }

  const fileName = file ? file.name : (lastIngestedData ? lastIngestedData.fileName : 'document.pdf');
  const fileSizeKB = file ? Math.round(file.size / 1024) : 120;
  const isImage = file ? (file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg)$/i.test(fileName)) : false;
  
  // Set modal file badge
  const fileBadge = document.getElementById('review-file-badge');
  if (fileBadge) {
    fileBadge.textContent = `${fileName} (${fileSizeKB} KB)`;
  }

  // Generate visual preview
  const previewImg = document.getElementById('review-preview-img');
  const previewDocIcon = document.getElementById('review-preview-doc');
  
  if (isImage && file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (previewImg) {
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
      }
      if (previewDocIcon) previewDocIcon.style.display = 'none';
    };
    reader.readAsDataURL(file);
  } else {
    if (previewImg) previewImg.style.display = 'none';
    if (previewDocIcon) {
      previewDocIcon.style.display = 'flex';
      const docExt = fileName.substring(fileName.lastIndexOf('.') + 1).toUpperCase();
      const extEl = document.getElementById('review-doc-ext');
      if (extEl) extEl.textContent = docExt || 'PDF';
    }
  }

  // Auto-classify document type
  const isLikelyRoomPlan = isImage || /(plan|floor|blueprint|room|layout|venue|hall|arena)/i.test(fileName);
  setReviewModalTab(isLikelyRoomPlan ? 'ROOM_PLAN' : 'SLIDES');

  // Pre-fill editable inputs
  prefillReviewForm(fileName, isLikelyRoomPlan);

  // Display modal
  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  // Initialize or update 3D spatial model preview canvas inside modal
  setTimeout(() => {
    initModalSpatialModel();
  }, 100);
}

function closeUploadReviewModal() {
  const modal = document.getElementById('modal-upload-review');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  const fileInput = document.getElementById('file-input');
  if (fileInput) fileInput.value = '';
}

function setReviewModalTab(type) {
  const btnTabPlan = document.getElementById('tab-btn-room-plan');
  const btnTabSlides = document.getElementById('tab-btn-slides');
  const sectionPlan = document.getElementById('review-section-room-plan');
  const sectionSlides = document.getElementById('review-section-slides');
  const modalDocType = document.getElementById('modal-doc-type-input');

  if (modalDocType) modalDocType.value = type;

  if (type === 'ROOM_PLAN') {
    if (btnTabPlan) btnTabPlan.className = 'btn btn-sm btn-blue font-bold';
    if (btnTabSlides) btnTabSlides.className = 'btn btn-sm btn-white font-bold';
    if (sectionPlan) sectionPlan.style.display = 'block';
    if (sectionSlides) sectionSlides.style.display = 'none';

    // Show 3D preview canvas
    const spatialContainer = document.getElementById('modal-spatial-preview-container');
    if (spatialContainer) spatialContainer.style.display = 'block';
    if (activeModalSpatialRenderer) activeModalSpatialRenderer.requestRender();
  } else {
    if (btnTabPlan) btnTabPlan.className = 'btn btn-sm btn-white font-bold';
    if (btnTabSlides) btnTabSlides.className = 'btn btn-sm btn-blue font-bold';
    if (sectionPlan) sectionPlan.style.display = 'none';
    if (sectionSlides) sectionSlides.style.display = 'block';

    const spatialContainer = document.getElementById('modal-spatial-preview-container');
    if (spatialContainer) spatialContainer.style.display = 'none';
  }
}

function prefillReviewForm(fileName, isRoomPlan) {
  const baseName = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

  // Room plan fields
  const inpWidth = document.getElementById('edit-room-width');
  const inpLength = document.getElementById('edit-room-length');
  const inpHallName = document.getElementById('edit-room-hall-name');
  const inpDoors = document.getElementById('edit-room-doors');

  if (inpWidth && !inpWidth.value) inpWidth.value = '18';
  if (inpLength && !inpLength.value) inpLength.value = '24';
  if (inpHallName && !inpHallName.value) inpHallName.value = isRoomPlan ? `Turing Hall (${baseName})` : 'Turing Hall';
  if (inpDoors && !inpDoors.value) inpDoors.value = '2';

  recalculatePeopleCapacity();

  // Slide fields
  const inpTitle = document.getElementById('edit-slide-title');
  const inpSpeaker = document.getElementById('edit-slide-speaker');
  const inpSummary = document.getElementById('edit-slide-summary');
  const inpTags = document.getElementById('edit-slide-tags');

  if (inpTitle) inpTitle.value = `Advanced ${baseName.charAt(0).toUpperCase() + baseName.slice(1)}`;
  if (inpSpeaker && !inpSpeaker.value) inpSpeaker.value = 'speaker-1';
  if (inpSummary) inpSummary.value = `Ingested document: Semantic architecture & execution analysis for ${baseName}.`;
  if (inpTags && !inpTags.value) inpTags.value = 'AI, Architecture, Scalability';
}

function recalculatePeopleCapacity() {
  const inpWidth = document.getElementById('edit-room-width');
  const inpLength = document.getElementById('edit-room-length');
  const inpDoors = document.getElementById('edit-room-doors');
  const inpCapacity = document.getElementById('edit-room-capacity');

  const width = parseFloat(inpWidth ? inpWidth.value : 18) || 18;
  const length = parseFloat(inpLength ? inpLength.value : 24) || 24;
  const doors = parseInt(inpDoors ? inpDoors.value : 2, 10) || 2;
  const area = Math.round(width * length);

  const areaLabel = document.getElementById('calc-room-area-label');
  if (areaLabel) areaLabel.textContent = `${area} m²`;

  // Standard safe egress: 1.8 m² per attendee
  const safeCap = Math.round(area / 1.8);
  const denseCap = Math.round(area / 1.4);
  const standingCap = Math.round(area / 0.75);

  const safeCapLabel = document.getElementById('calc-safe-cap-label');
  if (safeCapLabel) safeCapLabel.textContent = `${safeCap} pax`;

  const denseCapLabel = document.getElementById('calc-dense-cap-label');
  if (denseCapLabel) denseCapLabel.textContent = `${denseCap} pax`;

  const egressRateLabel = document.getElementById('calc-egress-rate-label');
  if (egressRateLabel) egressRateLabel.textContent = `${doors * 60} pax/min`;

  if (inpCapacity && (!inpCapacity.dataset.userEdited || inpCapacity.dataset.userEdited === 'false')) {
    inpCapacity.value = safeCap;
  }

  // Update 3D preview model in modal if initialized
  if (activeModalSpatialRenderer) {
    const hallName = document.getElementById('edit-room-hall-name')?.value || 'Turing Hall';
    activeModalSpatialRenderer.setDimensions({
      width,
      length,
      height: 5.5,
      capacity: parseInt(inpCapacity ? inpCapacity.value : safeCap, 10) || safeCap,
      hallName,
      doorsCount: doors
    });
  }
}

function initModalSpatialModel() {
  const canvas = document.getElementById('modal-spatial-canvas');
  if (!canvas) return;

  const width = parseFloat(document.getElementById('edit-room-width')?.value || 18);
  const length = parseFloat(document.getElementById('edit-room-length')?.value || 24);
  const capacity = parseInt(document.getElementById('edit-room-capacity')?.value || 240, 10);
  const hallName = document.getElementById('edit-room-hall-name')?.value || 'Turing Hall';
  const doors = parseInt(document.getElementById('edit-room-doors')?.value || 2, 10);

  if (typeof RoomSpatialModelRenderer === 'function') {
    if (!activeModalSpatialRenderer) {
      activeModalSpatialRenderer = new RoomSpatialModelRenderer(canvas, {
        width,
        length,
        height: 5.5,
        capacity,
        hallName,
        doorsCount: doors,
        currentOccupancy: 45 // Demo seed
      });
    } else {
      activeModalSpatialRenderer.setDimensions({
        width,
        length,
        capacity,
        hallName,
        doorsCount: doors
      });
    }
  }
}

function initReviewModalListeners() {
  // Modal close buttons
  const btnClose = document.getElementById('btn-close-review-modal');
  const btnCancel = document.getElementById('btn-cancel-review');
  if (btnClose) btnClose.addEventListener('click', closeUploadReviewModal);
  if (btnCancel) btnCancel.addEventListener('click', closeUploadReviewModal);

  // Tab buttons
  const btnTabPlan = document.getElementById('tab-btn-room-plan');
  const btnTabSlides = document.getElementById('tab-btn-slides');
  if (btnTabPlan) btnTabPlan.addEventListener('click', () => setReviewModalTab('ROOM_PLAN'));
  if (btnTabSlides) btnTabSlides.addEventListener('click', () => setReviewModalTab('SLIDES'));

  // Dimension inputs live calculation
  const inpWidth = document.getElementById('edit-room-width');
  const inpLength = document.getElementById('edit-room-length');
  const inpDoors = document.getElementById('edit-room-doors');
  const inpHallName = document.getElementById('edit-room-hall-name');
  const inpCapacity = document.getElementById('edit-room-capacity');

  if (inpWidth) inpWidth.addEventListener('input', recalculatePeopleCapacity);
  if (inpLength) inpLength.addEventListener('input', recalculatePeopleCapacity);
  if (inpDoors) inpDoors.addEventListener('input', recalculatePeopleCapacity);
  if (inpHallName) inpHallName.addEventListener('input', () => {
    if (activeModalSpatialRenderer) activeModalSpatialRenderer.setDimensions({ hallName: inpHallName.value });
  });

  if (inpCapacity) {
    inpCapacity.addEventListener('input', () => {
      inpCapacity.dataset.userEdited = 'true';
      if (activeModalSpatialRenderer) {
        activeModalSpatialRenderer.setDimensions({ capacity: parseInt(inpCapacity.value, 10) || 240 });
      }
    });
  }

  // Capacity Density Preset Buttons
  const btnStandardCap = document.getElementById('btn-preset-standard-cap');
  const btnDenseCap = document.getElementById('btn-preset-dense-cap');
  const btnStandingCap = document.getElementById('btn-preset-standing-cap');

  if (btnStandardCap) {
    btnStandardCap.addEventListener('click', () => {
      const area = (parseFloat(inpWidth?.value || 18)) * (parseFloat(inpLength?.value || 24));
      if (inpCapacity) inpCapacity.value = Math.round(area / 1.8);
      recalculatePeopleCapacity();
    });
  }
  if (btnDenseCap) {
    btnDenseCap.addEventListener('click', () => {
      const area = (parseFloat(inpWidth?.value || 18)) * (parseFloat(inpLength?.value || 24));
      if (inpCapacity) inpCapacity.value = Math.round(area / 1.4);
      recalculatePeopleCapacity();
    });
  }
  if (btnStandingCap) {
    btnStandingCap.addEventListener('click', () => {
      const area = (parseFloat(inpWidth?.value || 18)) * (parseFloat(inpLength?.value || 24));
      if (inpCapacity) inpCapacity.value = Math.round(area / 0.75);
      recalculatePeopleCapacity();
    });
  }

  // 3D Canvas rotate buttons
  const btnRotLeft = document.getElementById('btn-modal-3d-rot-left');
  const btnRotRight = document.getElementById('btn-modal-3d-rot-right');
  const btnResetView = document.getElementById('btn-modal-3d-reset');

  if (btnRotLeft) btnRotLeft.addEventListener('click', () => activeModalSpatialRenderer && activeModalSpatialRenderer.rotate(-0.25));
  if (btnRotRight) btnRotRight.addEventListener('click', () => activeModalSpatialRenderer && activeModalSpatialRenderer.rotate(0.25));
  if (btnResetView) btnResetView.addEventListener('click', () => activeModalSpatialRenderer && activeModalSpatialRenderer.resetView());

  // Confirm Ingestion Button
  const btnConfirm = document.getElementById('btn-confirm-review-ingest');
  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      const editedData = getFormEditedData();
      closeUploadReviewModal();
      executeIngestion(activePendingFile, editedData);
    });
  }
}

function getFormEditedData() {
  const modalDocType = document.getElementById('modal-doc-type-input')?.value || 'SLIDES';
  
  if (modalDocType === 'ROOM_PLAN') {
    return {
      documentType: 'ROOM_PLAN',
      hallId: document.getElementById('edit-room-hall-select')?.value || 'hall-1',
      hallName: document.getElementById('edit-room-hall-name')?.value || 'Turing Hall',
      width: parseFloat(document.getElementById('edit-room-width')?.value || 18),
      length: parseFloat(document.getElementById('edit-room-length')?.value || 24),
      height: parseFloat(document.getElementById('edit-room-height')?.value || 5.5),
      doorsCount: parseInt(document.getElementById('edit-room-doors')?.value || 2, 10),
      calculatedCapacity: parseInt(document.getElementById('edit-room-capacity')?.value || 240, 10),
      ephemeralHours: parseFloat(document.getElementById('edit-room-ephemeral-hours')?.value || 2)
    };
  } else {
    return {
      documentType: 'SLIDES',
      customTitle: document.getElementById('edit-slide-title')?.value || '',
      customSpeakerId: document.getElementById('edit-slide-speaker')?.value || 'speaker-1',
      customSummary: document.getElementById('edit-slide-summary')?.value || '',
      customTags: document.getElementById('edit-slide-tags')?.value || '',
      targetHallId: document.getElementById('edit-slide-hall')?.value || 'hall-1',
      targetSlotId: document.getElementById('edit-slide-slot')?.value || 'slot-1',
      customDuration: parseInt(document.getElementById('edit-slide-duration')?.value || 60, 10)
    };
  }
}

/**
 * Handles the actual HTTP ingestion with loading animation stages.
 */
async function executeIngestion(file, editedData = {}) {
  const dragZone = document.getElementById('drag-zone');
  const loader = document.getElementById('pipeline-loader');
  const results = document.getElementById('pipeline-results');

  if (dragZone) dragZone.style.display = 'none';
  if (results) results.style.display = 'none';
  if (loader) loader.style.display = 'block';

  const stages = [
    document.getElementById('stage-1'),
    document.getElementById('stage-2'),
    document.getElementById('stage-3'),
    document.getElementById('stage-4')
  ];

  stages.forEach(s => { if (s) s.className = 'stage-item'; });
  const isRoomPlan = editedData.documentType === 'ROOM_PLAN';

  if (stages[0]) {
    stages[0].classList.add('active');
    stages[0].innerHTML = `<span class="stage-dot"></span> ${isRoomPlan ? 'Reading architectural blueprint data...' : 'Ingesting presentation slides...'}`;
  }
  if (typeof appendLog === 'function') {
    appendLog(`[Pipeline] Ingesting "${file ? file.name : 'blueprint'}" as ${isRoomPlan ? '3D Room Plan' : 'Presentation'}...`, 'system');
  }

  // Smooth micro-stage progress animations while request runs concurrently
  const stageTimer1 = setTimeout(() => {
    if (stages[0]) stages[0].className = 'stage-item done';
    if (stages[1]) {
      stages[1].classList.add('active');
      stages[1].innerHTML = `<span class="stage-dot"></span> ${isRoomPlan ? 'Calculating room area & safe people capacity...' : 'Extracting semantic tags & speaker metadata...'}`;
    }
  }, 250);

  const stageTimer2 = setTimeout(() => {
    if (stages[1]) stages[1].className = 'stage-item done';
    if (stages[2]) {
      stages[2].classList.add('active');
      stages[2].innerHTML = `<span class="stage-dot"></span> ${isRoomPlan ? 'Synthesizing 3D spatial twin & doors...' : 'Re-weaving graph database dependencies...'}`;
    }
  }, 500);

  const stageTimer3 = setTimeout(() => {
    if (stages[2]) stages[2].className = 'stage-item done';
    if (stages[3]) {
      stages[3].classList.add('active');
      stages[3].innerHTML = `<span class="stage-dot"></span> ${isRoomPlan ? 'Activating 2-hour ephemeral storage & telemetry...' : 'Auto-generating promo copy & banner...'}`;
    }
  }, 750);

  const formData = new FormData();
  if (file) {
    formData.append('slides', file);
  }

  // Attach all user-edited calibration fields
  for (const key in editedData) {
    formData.append(key, editedData[key]);
  }

  // Resolve upload URL (handles file:// or cross-origin dev server)
  const targetUploadUrl = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '3000'))
    ? 'http://localhost:3000/api/upload-slides'
    : '/api/upload-slides';

  try {
    const res = await fetch(targetUploadUrl, {
      method: 'POST',
      body: formData
    });

    clearTimeout(stageTimer1);
    clearTimeout(stageTimer2);
    clearTimeout(stageTimer3);
    stages.forEach(s => { if (s) s.className = 'stage-item done'; });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new Error(`Server returned non-JSON response (HTTP ${res.status}). Verify server is running on port 3000.`);
    }

    if (!res.ok || !data.success) {
      throw new Error(data?.error || `Upload rejected with HTTP ${res.status}`);
    }

    if (loader) loader.style.display = 'none';
    if (results) results.style.display = 'block';
    if (dragZone) dragZone.style.display = 'block';

    lastIngestedData = { ...data, fileName: file ? file.name : (data.spatialModel?.fileName || 'calibrated_blueprint'), editedData };

    if (typeof createToast === 'function') {
      createToast(data.scheduleMessage || 'Ingestion completed successfully!', 'success');
    }

    if (typeof renderScheduleGrid === 'function') renderScheduleGrid();
    if (typeof rebuildGraphData === 'function') rebuildGraphData();
    if (typeof updateCounters === 'function') updateCounters();

    if (data.logs && typeof appendLog === 'function') {
      data.logs.forEach(log => {
        let logType = 'system';
        if (log.includes('[CONFLICT]')) logType = 'conflict';
        else if (log.includes('[Action]')) logType = 'action';
        appendLog(log, logType);
      });
    }

    renderPipelineResults(data, isRoomPlan, file);
  } catch (err) {
    console.error('[Content Pipeline Ingestion Error]', err);
    clearTimeout(stageTimer1);
    clearTimeout(stageTimer2);
    clearTimeout(stageTimer3);
    if (loader) loader.style.display = 'none';
    if (dragZone) dragZone.style.display = 'block';
    if (typeof createToast === 'function') {
      createToast(`Pipeline Ingestion: ${err.message}`, 'warning');
    }
  }
}

/**
 * Renders the results view for both Room Plans and Presentation Slides
 */
function renderPipelineResults(data, isRoomPlan, file) {
  const resultTitle = document.getElementById('result-topic-title');
  const resultSummary = document.getElementById('result-topic-summary');
  const tagsDiv = document.getElementById('result-topic-tags');
  const socialCard = document.getElementById('social-graphic-card');
  const spatialCard = document.getElementById('spatial-result-card');
  const copyBox = document.querySelector('.copy-box');
  const graphicsCustomizer = document.querySelector('.graphics-customizer');
  const btnDownload = document.getElementById('btn-download-banner');

  if (isRoomPlan && data.spatialModel) {
    const sm = data.spatialModel;
    if (resultTitle) resultTitle.textContent = `🏛️ ${sm.hallName} (3D Twin Active)`;
    if (resultSummary) {
      resultSummary.innerHTML = `<strong>Calibrated Area:</strong> ${sm.dimensions.areaM2} m² (${sm.dimensions.width}m × ${sm.dimensions.length}m) • <strong>Capacity:</strong> ${sm.capacityMetrics.capacity} pax • <strong>Doors:</strong> ${sm.doorsCount} Gates • <strong>Storage:</strong> ${sm.ephemeralStorage.retentionLabel}.`;
    }

    if (tagsDiv) {
      tagsDiv.innerHTML = `
        <span class="tag-badge">#3DModel</span>
        <span class="tag-badge">#Capacity${sm.capacityMetrics.capacity}</span>
        <span class="tag-badge">#Doors${sm.doorsCount}</span>
        <span class="tag-badge">#EphemeralTTL2h</span>
      `;
    }

    // Hide slides social cards, show 3D spatial room twin card
    if (socialCard) socialCard.style.display = 'none';
    if (copyBox) copyBox.style.display = 'none';
    if (graphicsCustomizer) graphicsCustomizer.style.display = 'none';
    if (btnDownload) btnDownload.style.display = 'none';

    if (spatialCard) {
      spatialCard.style.display = 'block';
      const canvas = document.getElementById('dashboard-spatial-canvas');
      if (canvas && typeof RoomSpatialModelRenderer === 'function') {
        if (!activeDashboardSpatialRenderer) {
          activeDashboardSpatialRenderer = new RoomSpatialModelRenderer(canvas, {
            width: sm.dimensions.width,
            length: sm.dimensions.length,
            height: sm.dimensions.height,
            capacity: sm.capacityMetrics.capacity,
            hallName: sm.hallName,
            doorsCount: sm.doorsCount,
            currentOccupancy: window.cctvNetOccupancy || 0
          });
        } else {
          activeDashboardSpatialRenderer.setDimensions({
            width: sm.dimensions.width,
            length: sm.dimensions.length,
            capacity: sm.capacityMetrics.capacity,
            hallName: sm.hallName,
            doorsCount: sm.doorsCount
          });
        }
      }
    }
  } else if (data.topic) {
    // Presentation Slides Mode
    if (spatialCard) spatialCard.style.display = 'none';
    if (socialCard) socialCard.style.display = 'block';
    if (copyBox) copyBox.style.display = 'block';
    if (graphicsCustomizer) graphicsCustomizer.style.display = 'block';
    if (btnDownload) btnDownload.style.display = 'block';

    if (resultTitle) resultTitle.textContent = data.topic.title;
    if (resultSummary) resultSummary.textContent = data.topic.summary;

    const inpBannerTitle = document.getElementById('input-banner-title');
    const inpBannerSpeaker = document.getElementById('input-banner-speaker');
    if (inpBannerTitle) inpBannerTitle.value = data.topic.title;
    if (inpBannerSpeaker) inpBannerSpeaker.value = data.speaker.name;

    if (tagsDiv && data.topic.tags) {
      tagsDiv.innerHTML = '';
      data.topic.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag-badge';
        span.textContent = `#${tag}`;
        tagsDiv.appendChild(span);
      });
    }

    const socialCopy = document.getElementById('result-social-copy');
    if (socialCopy) socialCopy.value = data.socialCopy || '';

    const canvasTitle = document.getElementById('canvas-topic-title');
    const canvasSpeaker = document.getElementById('canvas-speaker-name');
    if (canvasTitle) canvasTitle.textContent = data.topic.title;
    if (canvasSpeaker) canvasSpeaker.textContent = data.speaker.name;
  }

  // Ensure "Review & Edit Ingested Data" action button exists
  setupPostIngestionEditButton(file);
}

function setupPostIngestionEditButton(file) {
  const actionContainer = document.getElementById('pipeline-results-actions');
  if (!actionContainer) return;

  actionContainer.innerHTML = '';

  const btnReEdit = document.createElement('button');
  btnReEdit.className = 'btn btn-sm btn-yellow mb-2 w-full font-bold';
  btnReEdit.style.border = '2px solid #000';
  btnReEdit.style.boxShadow = '2px 2px 0px #000';
  btnReEdit.innerHTML = '✏️ Review & Edit Ingested Data';
  btnReEdit.addEventListener('click', () => {
    openUploadReviewModal(file, true);
  });

  actionContainer.appendChild(btnReEdit);
}

// Banner graphic customizer colors and values binding
function initVisualCustomizer() {
  const inpTitle = document.getElementById('input-banner-title');
  const inpSpeaker = document.getElementById('input-banner-speaker');
  const card = document.getElementById('social-graphic-card');
  const colorBtns = document.querySelectorAll('.color-btn');
  const btnDownload = document.getElementById('btn-download-banner');

  if (!inpTitle || !inpSpeaker || !card || !btnDownload) return;

  inpTitle.addEventListener('input', () => {
    const el = document.getElementById('canvas-topic-title');
    if (el) el.textContent = inpTitle.value || 'Autonomous Agent Swarms';
  });

  inpSpeaker.addEventListener('input', () => {
    const el = document.getElementById('canvas-speaker-name');
    if (el) el.textContent = inpSpeaker.value || 'Dr. Evelyn Wright';
  });

  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const theme = btn.getAttribute('data-theme');
      card.className = `social-graphic-card ${theme} mb-4`;
    });
  });

  btnDownload.addEventListener('click', () => {
    const titleVal = document.getElementById('canvas-topic-title')?.textContent || 'DELTA Engine';
    const speakerVal = document.getElementById('canvas-speaker-name')?.textContent || 'Keynote';
    
    let activeTheme = 'blue';
    colorBtns.forEach(b => { if (b.classList.contains('active')) activeTheme = b.getAttribute('data-theme'); });

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#ffffff';
    
    let grad = ctx.createLinearGradient(0, 0, 600, 300);
    if (activeTheme === 'blue') {
      grad.addColorStop(0, '#c2e7ff');
      grad.addColorStop(1, '#e8f0fe');
      ctx.fillStyle = grad;
    } else if (activeTheme === 'green') {
      grad.addColorStop(0, '#e6f4ea');
      grad.addColorStop(1, '#34a853');
      ctx.fillStyle = grad;
    } else if (activeTheme === 'yellow') {
      grad.addColorStop(0, '#fef7e0');
      grad.addColorStop(1, '#f9ab00');
      ctx.fillStyle = grad;
    } else if (activeTheme === 'red') {
      grad.addColorStop(0, '#fce8e6');
      grad.addColorStop(1, '#ea4335');
      ctx.fillStyle = grad;
    }
    
    ctx.fillRect(0, 0, 600, 300);
    ctx.strokeRect(3, 3, 594, 294);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px "Space Grotesk", Courier';
    ctx.fillRect(20, 20, 130, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('DELTA ENGINE', 30, 36);

    ctx.fillStyle = (activeTheme === 'green' || activeTheme === 'red') ? '#ffffff' : '#000000';
    
    ctx.font = 'bold 24px "Outfit", sans-serif';
    wrapText(ctx, titleVal, 20, 100, 560, 32);

    ctx.font = 'italic 16px "Outfit", sans-serif';
    ctx.fillText(speakerVal, 20, 220);

    ctx.font = 'bold 14px "Space Grotesk", Courier';
    ctx.fillStyle = (activeTheme === 'green' || activeTheme === 'red') ? '#ffffff' : '#4285f4';
    ctx.fillText('#DeltaEngineOS', 20, 260);

    const imgUrl = canvas.toDataURL("image/png");
    const dlLink = document.createElement('a');
    dlLink.href = imgUrl;
    dlLink.download = `delta_engine_talk_${activeTheme}.png`;
    dlLink.click();
    
    if (typeof createToast === 'function') {
      createToast('Promotional graphic downloaded successfully!', 'success');
    }
  });
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';

  for (let n = 0; n < words.length; n++) {
    let testLine = line + words[n] + ' ';
    let metrics = context.measureText(testLine);
    let testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
}

// Global hook
window.openUploadReviewModal = openUploadReviewModal;
