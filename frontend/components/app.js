// DELTA ENGINE - Agentic & Self-Healing Event OS Client Core

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function removeLogoBackground() {
  const logoImgs = document.querySelectorAll('.delta-polymorphic-logo');
  logoImgs.forEach(img => {
    const rawImg = new Image();
    rawImg.crossOrigin = 'Anonymous';
    rawImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = rawImg.width;
      canvas.height = rawImg.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(rawImg, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        // Eliminate all light off-white / beige / grey background pixels
        if (minC > 170 && (maxC - minC) < 40) {
          data[i + 3] = 0; // 100% transparent
        }
      }
      ctx.putImageData(imgData, 0, 0);
      img.src = canvas.toDataURL('image/png');
    };
    rawImg.src = img.src;
  });
}

let ws;
let graphState = null;
let scheduleState = null;
let activeSpeakerId = null;
let previousSchedule = null;

// Physics node graph parameters
let nodes = [];
let links = [];
const width = 500;
const height = 350;
let draggedNode = null;
let selectedNodeId = null;
let isMouseDragging = false;
let dragStartX = 0;
let dragStartY = 0;

// Initialize components on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  removeLogoBackground();

  // Shackleton Global Loader Smooth Fade-Out (3.6s loop)
  setTimeout(() => {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.remove(), 800);
    }
  }, 3600);

  initWebSockets();
  initFormListeners();
  initDragAndDrop();
  initResetButton();
  initLogConsoleControls();
  initNodeInspectorClose();
  initTourGuide();
  initVisualCustomizer();
  initSvgMouseHandlers();
  
  // Phase 2 QoL bindings
  initStressSlider();
  initICalModal();
  initSentimentSimulator();
  initContentUploadPipeline(); // Trigger content uploader drag and drop
  initDatePicker(); // Bind schedule date picker change handler

  // Custom Node Graph animation loop
  requestAnimationFrame(physicsTick);
});

function initDatePicker() {
  const datePicker = document.getElementById('schedule-date-picker');
  if (!datePicker) return;

  datePicker.addEventListener('change', (e) => {
    const selectedDate = e.target.value;
    createToast(`📅 Switching schedule matrix view to ${selectedDate}...`, 'info');
    
    fetch('/api/schedule/set-date', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: selectedDate })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.schedule) {
        scheduleState = data.schedule;
        renderScheduleGrid();
        if (typeof rebuildGraphData === 'function') rebuildGraphData();
      }
    })
    .catch(err => console.error('Date change fetch failed:', err));
  });
}

// --- CORE FORMS HANDLERS ---

function populateForms() {
  const speakerSelect = document.getElementById('select-speaker');
  const topicSelect = document.getElementById('select-topic');

  if (!speakerSelect || !topicSelect) return;

  const prevSpeakerVal = speakerSelect.value;
  const prevTopicVal = topicSelect.value;

  speakerSelect.innerHTML = '';
  topicSelect.innerHTML = '';

  for (const id in graphState.speakers) {
    const s = graphState.speakers[id];
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${s.avatar} ${s.name} (${s.role})`;
    speakerSelect.appendChild(opt);
  }

  for (const id in graphState.topics) {
    const t = graphState.topics[id];
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = t.title.substring(0, 45) + '...';
    topicSelect.appendChild(opt);
  }

  if (prevSpeakerVal) speakerSelect.value = prevSpeakerVal;
  if (prevTopicVal) topicSelect.value = prevTopicVal;
}

function initFormListeners() {
  const btnDelay = document.getElementById('btn-trigger-delay');
  const btnSurge = document.getElementById('btn-trigger-surge');

  if (btnDelay) {
    btnDelay.addEventListener('click', () => {
      const speakerId = document.getElementById('select-speaker').value;
      const delayMinutes = document.getElementById('select-delay').value;
      
      appendLog(`[SYSTEM] Client triggering delay: Speaker ${speakerId} by ${delayMinutes} mins...`, 'system');
      
      fetch('/api/simulate/delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speakerId, delayMinutes })
      })
      .then(res => res.json())
      .catch(err => {
        console.error(err);
        createToast('Failed to trigger simulated delay.', 'warning');
      });
    });
  }

  if (btnSurge) {
    btnSurge.addEventListener('click', () => {
      const topicId = document.getElementById('select-topic').value;
      const interestCount = document.getElementById('input-surge-count').value;

      appendLog(`[SYSTEM] Client triggering capacity surge: Talk ${topicId} to ${interestCount} interest...`, 'system');

      fetch('/api/simulate/capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId, interestCount })
      })
      .then(res => res.json())
      .catch(err => {
        console.error(err);
        createToast('Failed to trigger capacity surge.', 'warning');
      });
    });
  }
}

// --- LOG CONSOLE FILTERS & SEARCH CONTROL ---

function initLogConsoleControls() {
  const searchInput = document.getElementById('log-search');
  const filterSelect = document.getElementById('log-filter');
  const btnClear = document.getElementById('btn-clear-logs');

  if (!searchInput || !filterSelect || !btnClear) return;

  searchInput.addEventListener('keyup', applyLogFilters);
  filterSelect.addEventListener('change', applyLogFilters);

  btnClear.addEventListener('click', () => {
    document.getElementById('agent-logs').innerHTML = '';
    appendLog('[SYSTEM] Console buffer cleared.', 'system');
  });
}

function applyLogFilters() {
  const query = document.getElementById('log-search').value.toLowerCase();
  const filterVal = document.getElementById('log-filter').value;
  const lines = document.getElementById('agent-logs').getElementsByClassName('log-line');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.textContent.toLowerCase();
    
    let matchesQuery = text.includes(query);
    let matchesFilter = true;

    if (filterVal === 'conflict') {
      matchesFilter = line.classList.contains('conflict');
    } else if (filterVal === 'action') {
      matchesFilter = line.classList.contains('action');
    } else if (filterVal === 'success') {
      matchesFilter = line.classList.contains('success');
    }

    if (matchesQuery && matchesFilter) {
      line.style.display = 'block';
    } else {
      line.style.display = 'none';
    }
  }
}

// --- UTILITIES AND NOTIFICATIONS ---

function initResetButton() {
  const btnReset = document.getElementById('btn-reset-db');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      createToast('🔄 Resetting schedule layout to normal baseline...', 'info');
      fetch('/api/reset', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.schedule) {
          scheduleState = data.schedule;
          graphState = data.graph;
          renderScheduleGrid();
          if (typeof rebuildGraphData === 'function') rebuildGraphData();
          if (typeof updateCounters === 'function') updateCounters();
          createToast('✨ Schedule reset to normal status!', 'success');
        }
      });
    });
  }

  const btnMass = document.getElementById('btn-mass-disruption');
  if (btnMass) {
    btnMass.addEventListener('click', () => {
      createToast('🔥 Injecting catastrophic multi-speaker clash test case...', 'warning');
      fetch('/api/sim/mass-disruption', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.steps && data.steps.length > 0) {
          // Process steps sequentially one by one with countdown modals!
          const executeStep = (index) => {
            if (index >= data.steps.length) {
              createToast('🎉 Catastrophic Disruption Fully Resolved & Self-Healed!', 'success');
              return;
            }

            const step = data.steps[index];
            triggerReallocationCountdown(step.conflictReason, step.destinationTarget, () => {
              previousSchedule = JSON.parse(JSON.stringify(scheduleState));
              scheduleState = step.healedSchedule;
              graphState = step.graph;

              if (step.logs) {
                step.logs.forEach(log => {
                  let logType = 'system';
                  if (log.includes('[CONFLICT]')) logType = 'conflict';
                  else if (log.includes('[Action]')) logType = 'action';
                  else if (log.includes('Audit clean')) logType = 'success';
                  appendLog(log, logType);
                });
              }

              renderScheduleGrid();
              if (typeof rebuildGraphData === 'function') rebuildGraphData();
              if (typeof updateCounters === 'function') updateCounters();

              // Proceed to next resolution step
              setTimeout(() => executeStep(index + 1), 600);
            });
          };

          executeStep(0);
        }
      });
    });
  }
}

function appendLog(message, type = 'system') {
  const logsContainer = document.getElementById('agent-logs');
  if (!logsContainer) return;
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  
  const time = new Date().toLocaleTimeString();
  line.innerHTML = `<span style="color:#555;">[${time}]</span> ${message}`;
  
  logsContainer.appendChild(line);
  
  // Update Live Attendee Feed location & alert stream
  updateAttendeeFeed(message);

  // Auto scroll to bottom
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

function updateCounters() {
  if (!graphState) return;

  const totalSpeakers = Object.keys(graphState.speakers).length;
  let delayCount = 0;
  
  for (const id in graphState.speakers) {
    if (graphState.speakers[id].delay > 0) {
      delayCount++;
    }
  }

  const elSpeakers = document.getElementById('active-speakers-count');
  const elDelays = document.getElementById('system-delays-count');
  
  if (elSpeakers) elSpeakers.textContent = `${totalSpeakers} Active Speakers`;
  if (elDelays) elDelays.textContent = `${delayCount} Delay Event${delayCount === 1 ? '' : 's'} Logged`;
}

function renderSwarmChat(chatArray) {
  const chatBox = document.getElementById('swarm-chat-messages');
  if (!chatBox || !chatArray) return;

  chatArray.forEach(msg => {
    const bubble = document.createElement('div');
    
    let senderClass = 'system';
    if (msg.sender.includes('Liaison')) senderClass = 'liaison';
    else if (msg.sender.includes('Scheduler')) senderClass = 'scheduler';
    else if (msg.sender.includes('Logistics')) senderClass = 'logistics';
    else if (msg.sender.includes('Marketing')) senderClass = 'marketing';

    bubble.className = `chat-bubble ${senderClass}`;
    bubble.innerHTML = `
      <span class="chat-time">${msg.time}</span>
      <span class="chat-sender">${msg.avatar} ${msg.sender}</span>
      <span class="chat-text">${msg.text}</span>
    `;

    chatBox.appendChild(bubble);
  });

  chatBox.parentElement.scrollTop = chatBox.parentElement.scrollHeight;
}

function updateAttendeeFeed(logMessage) {
  const ticker = document.getElementById('sentiment-ticker-box');
  if (!ticker) return;

  const item = document.createElement('div');
  item.className = 'ticker-item';
  
  let author = '@conference_attendee';
  if (logMessage.includes('Lovelace Suite')) author = '@lovelace_session';
  else if (logMessage.includes('delayed')) author = '@flight_tracker';
  
  item.textContent = `"${logMessage}" - ${author}`;
  
  ticker.innerHTML = '';
  ticker.appendChild(item);
}

function triggerConfetti() {
  // Confetti particles removed
}

function createToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast-card ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  else if (type === 'warning') icon = '⚠️';
  else if (type === 'conflict') icon = '🔥';

  toast.innerHTML = `
    <span style="font-size:1.2rem;">${icon}</span>
    <span style="font-family:var(--font-mono); font-size:0.8rem; font-weight:700; flex-grow:1;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function showPushAlert(message) {
  const alertOverlay = document.getElementById('push-alert');
  const alertMsg = document.getElementById('push-message');
  if (alertOverlay && alertMsg) {
    alertMsg.textContent = message;
    alertOverlay.style.display = 'flex';
  }
}

function triggerReallocationCountdown(conflictReason, destinationTarget, onComplete) {
  const modal = document.getElementById('reallocation-countdown-modal');
  const card = modal ? modal.querySelector('.reallocation-modal-card') : null;
  const elReason = document.getElementById('reallocation-conflict-text');
  const elDest = document.getElementById('reallocation-destination-text');
  const elNum = document.getElementById('reallocation-countdown-number');
  const elProgress = document.getElementById('reallocation-progress-bar');

  if (!modal || !elReason || !elDest || !elNum || !elProgress) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  elReason.textContent = conflictReason || '🚨 Self-Healing Audit: Operational constraint violation detected.';
  elDest.textContent = destinationTarget || '📍 Reallocating talk node to optimal venue hall and time slot.';
  
  elNum.textContent = '5';
  elProgress.style.transition = 'none';
  elProgress.style.width = '0%';
  modal.classList.remove('hidden');

  // Trigger dramatic emergency alarm pulse and card shake animations!
  modal.classList.remove('dramatic-alarm');
  if (card) card.classList.remove('dramatic-shake');
  void modal.offsetWidth; // Force reflow
  modal.classList.add('dramatic-alarm');
  if (card) card.classList.add('dramatic-shake');

  // Trigger progress bar animation for 5 full seconds
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      elProgress.style.transition = 'width 5s linear';
      elProgress.style.width = '100%';
    });
  });

  let seconds = 5;
  const timer = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      elNum.textContent = seconds;
      elNum.classList.add('tick');
      setTimeout(() => elNum.classList.remove('tick'), 250);
    } else {
      clearInterval(timer);
      elNum.textContent = '0';
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('dramatic-alarm');
        if (card) card.classList.remove('dramatic-shake');
        if (typeof onComplete === 'function') onComplete();
      }, 400);
    }
  }, 1000);
}
