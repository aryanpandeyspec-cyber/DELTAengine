// --- AUTOMATED CONTENT PIPELINE INGESTION & VISUAL EXPORTER ---

function initContentUploadPipeline() {
  const dragZone = document.getElementById('drag-zone');
  const fileInput = document.getElementById('file-input');

  if (!dragZone || !fileInput) return;

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
      handleSlideUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleSlideUpload(fileInput.files[0]);
    }
  });
}

// Simulates tag/slides analysis loading states
function handleSlideUpload(file) {
  const dragZone = document.getElementById('drag-zone');
  const loader = document.getElementById('pipeline-loader');
  const results = document.getElementById('pipeline-results');

  dragZone.style.display = 'none';
  results.style.display = 'none';
  loader.style.display = 'block';

  // State elements
  const stages = [
    document.getElementById('stage-1'),
    document.getElementById('stage-2'),
    document.getElementById('stage-3'),
    document.getElementById('stage-4')
  ];

  // Reset stage classes
  stages.forEach(s => {
    s.className = 'stage-item';
  });

  // Multiphase Loader checklist logic
  setTimeout(() => {
    stages[0].classList.add('active');
    appendLog(`[Pipeline] Uploading presentation file "${file.name}" for analysis...`, 'system');
  }, 100);

  setTimeout(() => {
    stages[0].className = 'stage-item done';
    stages[1].classList.add('active');
  }, 600);

  setTimeout(() => {
    stages[1].className = 'stage-item done';
    stages[2].classList.add('active');
  }, 1200);

  setTimeout(() => {
    stages[2].className = 'stage-item done';
    stages[3].classList.add('active');
  }, 1800);

  setTimeout(() => {
    stages[3].className = 'stage-item done';
    
    // Complete form posting
    const formData = new FormData();
    formData.append('slides', file);

    fetch('/api/upload-slides', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      loader.style.display = 'none';
      results.style.display = 'block';
      dragZone.style.display = 'block'; // Restore dragzone for next upload

      if (data.success) {
        createToast(`Slides scanned: "${data.topic.title}" placed into Live Schedule Matrix!`, 'success');
        
        // Immediate UI Grid and Graph refresh
        if (typeof renderScheduleGrid === 'function') renderScheduleGrid();
        if (typeof rebuildGraphData === 'function') rebuildGraphData();
        if (typeof updateCounters === 'function') updateCounters();

        if (data.logs) {
          data.logs.forEach(log => {
            let logType = 'system';
            if (log.includes('[CONFLICT]')) logType = 'conflict';
            else if (log.includes('[Action]')) logType = 'action';
            appendLog(log, logType);
          });
        }

        // Populating elements
        document.getElementById('result-topic-title').textContent = data.topic.title;
        document.getElementById('result-topic-summary').textContent = data.topic.summary;
        
        // Exporter details binder inputs
        document.getElementById('input-banner-title').value = data.topic.title;
        document.getElementById('input-banner-speaker').value = data.speaker.name;
        
        const tagsDiv = document.getElementById('result-topic-tags');
        tagsDiv.innerHTML = '';
        data.topic.tags.forEach(tag => {
          const span = document.createElement('span');
          span.className = 'tag-badge';
          span.textContent = `#${tag}`;
          tagsDiv.appendChild(span);
        });

        document.getElementById('result-social-copy').value = data.socialCopy;
        
        // Live sync graphic card
        document.getElementById('canvas-topic-title').textContent = data.topic.title;
        document.getElementById('canvas-speaker-name').textContent = data.speaker.name;
      }
    })
    .catch(err => {
      console.error(err);
      loader.style.display = 'none';
      dragZone.style.display = 'block';
      createToast('Slides ingestion pipeline failed.', 'warning');
    });
  }, 2400);
}

// Banner graphic customizer colors and values binding
function initVisualCustomizer() {
  const inpTitle = document.getElementById('input-banner-title');
  const inpSpeaker = document.getElementById('input-banner-speaker');
  const card = document.getElementById('social-graphic-card');
  const colorBtns = document.querySelectorAll('.color-btn');
  const btnDownload = document.getElementById('btn-download-banner');

  if (!inpTitle || !inpSpeaker || !card || !btnDownload) return;

  // Live binding text changes to the card layout
  inpTitle.addEventListener('input', () => {
    document.getElementById('canvas-topic-title').textContent = inpTitle.value || 'Autonomous Agent Swarms';
  });

  inpSpeaker.addEventListener('input', () => {
    document.getElementById('canvas-speaker-name').textContent = inpSpeaker.value || 'Dr. Evelyn Wright';
  });

  // Grad color button picker trigger
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      colorBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const theme = btn.getAttribute('data-theme');
      
      // Swap themes classes
      card.className = `social-graphic-card ${theme} mb-4`;
    });
  });

  // Exporter to local PNG file using Canvas 2D markup drawer
  btnDownload.addEventListener('click', () => {
    const titleVal = document.getElementById('canvas-topic-title').textContent;
    const speakerVal = document.getElementById('canvas-speaker-name').textContent;
    
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
    ctx.fillText('#DedicatedHackIndia', 20, 260);

    const imgUrl = canvas.toDataURL("image/png");
    const dlLink = document.createElement('a');
    dlLink.href = imgUrl;
    dlLink.download = `delta_engine_talk_${activeTheme}.png`;
    dlLink.click();
    
    createToast('Promotional graphic downloaded successfully!', 'success');
  });
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';

  for(let n = 0; n < words.length; n++) {
    let testLine = line + words[n] + ' ';
    let metrics = context.measureText(testLine);
    let testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    }
    else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
}
