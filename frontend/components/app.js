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
  initDynamicClockAndDate(); // Live dynamic clock, calendar date & active slot indicator
  initDatePicker(); // Bind schedule date picker change handler
  initSoundEffects(); // Synthesized Web Audio feedback
  initKeyboardShortcuts(); // Neubrutalist keyboard shortcuts & modal
  initMatrixSearch(); // Real-time matrix talk search & filter
  initSwarmCopy(); // Swarm negotiation transcript copy to clipboard

  // Custom Node Graph animation loop
  requestAnimationFrame(physicsTick);
});

function initDatePicker() {
  const datePicker = document.getElementById('schedule-date-picker');
  if (!datePicker) return;

  // Initialize dynamic date to today if not set or default
  const todayStr = new Date().toISOString().split('T')[0];
  if (!datePicker.value || datePicker.value === '2026-08-07') {
    datePicker.value = todayStr;
  }

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

function initDynamicClockAndDate() {
  function tick() {
    const now = new Date();
    const dateOpts = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
    const dateStr = now.toLocaleDateString('en-US', dateOpts);
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    document.querySelectorAll('#live-dynamic-date, .live-dynamic-date').forEach(el => {
      el.textContent = dateStr;
    });

    document.querySelectorAll('#live-dynamic-time, .live-dynamic-time').forEach(el => {
      el.textContent = timeStr;
    });

    updateActiveSlotIndicator(now);
  }

  tick();
  setInterval(tick, 1000);
}

function updateActiveSlotIndicator(now) {
  const hours = now.getHours() + now.getMinutes() / 60;
  let activeSlot = null;
  if (hours >= 9.5 && hours < 10.75) activeSlot = 'slot-1';
  else if (hours >= 11.0 && hours < 12.25) activeSlot = 'slot-2';
  else if (hours >= 13.5 && hours < 14.75) activeSlot = 'slot-3';
  else if (hours >= 15.0 && hours < 16.25) activeSlot = 'slot-4';

  const slotMap = {
    'slot-1': { id: 'th-slot-1', baseText: '09:30 AM' },
    'slot-2': { id: 'th-slot-2', baseText: '11:00 AM' },
    'slot-3': { id: 'th-slot-3', baseText: '01:30 PM' },
    'slot-4': { id: 'th-slot-4', baseText: '03:00 PM' }
  };

  for (const sId in slotMap) {
    const th = document.getElementById(slotMap[sId].id);
    if (!th) continue;
    if (sId === activeSlot) {
      if (!th.dataset.isLive) {
        th.dataset.isLive = 'true';
        th.innerHTML = `${slotMap[sId].baseText} <span class="slot-live-badge" style="background:#ef4444; color:#fff; font-size:0.65rem; padding:2px 6px; border-radius:10px; margin-left:4px; font-weight:800; border:1px solid #000; box-shadow:1px 1px 0px #000;">🔴 LIVE</span>`;
        th.style.background = '#fef2f2';
        th.style.borderBottom = '3px solid #ef4444';
      }
    } else {
      if (th.dataset.isLive) {
        delete th.dataset.isLive;
        th.textContent = slotMap[sId].baseText;
        th.style.background = '';
        th.style.borderBottom = '';
      }
    }
  }
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
      .then(data => {
        if (data.swarmChat) {
          renderSwarmChat(data.swarmChat);
        }
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          if (data.hasConflict) {
            triggerReallocationCountdown(data.conflictReason, data.destinationTarget, () => {
              previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
              scheduleState = data.schedule;
              renderScheduleGrid();
              if (typeof rebuildGraphData === 'function') rebuildGraphData();
              if (typeof updateCounters === 'function') updateCounters();
              createToast('✨ Self-Healing complete: Talk node redirected to applicable hall!', 'success');
              if (typeof highlightHealedDestination === 'function') {
                highlightHealedDestination(data.destinationTarget, data.schedule);
              }
            });
          }
        }
      })
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
      .then(data => {
        if (data.swarmChat) {
          renderSwarmChat(data.swarmChat);
        }
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          if (data.hasConflict) {
            triggerReallocationCountdown(data.conflictReason, data.destinationTarget, () => {
              previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
              scheduleState = data.schedule;
              renderScheduleGrid();
              if (typeof rebuildGraphData === 'function') rebuildGraphData();
              if (typeof updateCounters === 'function') updateCounters();
              createToast('✨ Self-Healing complete: Talk node redirected to applicable hall!', 'success');
              if (typeof highlightHealedDestination === 'function') {
                highlightHealedDestination(data.destinationTarget, data.schedule);
              }
            });
          }
        }
      })
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

          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          renderSwarmChat([
            { sender: 'Liaison Agent', avatar: '🗣️', text: 'Telemetry Reset: Conference schedule returned to baseline configuration.', time: timeStr },
            { sender: 'Scheduler Agent', avatar: '⏱️', text: 'All 3 tracks aligned to initial timeline with zero conflicts.', time: timeStr },
            { sender: 'Logistics Agent', avatar: '🏛️', text: 'Stage facilities and hall occupancy re-calibrated.', time: timeStr },
            { sender: 'Marketing Agent', avatar: '📢', text: 'iCal sync feed synchronized with default conference timetable.', time: timeStr }
          ]);
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
            // Render Swarm negotiation dialogue immediately for this step
            if (step.swarmChat) {
              renderSwarmChat(step.swarmChat);
            }

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
              if (typeof highlightHealedDestination === 'function') {
                highlightHealedDestination(step.destinationTarget, step.healedSchedule);
              }

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

  // Dynamically render speaker pills in #speaker-pills-container
  const pillsContainer = document.getElementById('speaker-pills-container');
  if (pillsContainer && graphState.speakers) {
    pillsContainer.innerHTML = '';
    const colorClasses = ['blue', 'green', 'yellow'];
    let idx = 0;

    for (const id in graphState.speakers) {
      const s = graphState.speakers[id];
      const pill = document.createElement('span');
      const isDelayed = s.delay > 0;
      const colorClass = colorClasses[idx % colorClasses.length];
      idx++;

      pill.className = `circle-speaker ${colorClass}`;
      if (isDelayed) {
        pill.style.backgroundColor = 'var(--google-red-light, #fee2e2)';
        pill.style.borderColor = 'var(--google-red, #ea4335)';
        pill.style.color = '#c5221f';
        pill.title = `${s.name} (${s.role || 'Speaker'}) — ⚠️ Delayed +${s.delay}m`;
      } else {
        pill.title = `${s.name} (${s.role || 'Speaker'}) — ✅ On Schedule`;
      }

      // Calculate 2-letter clean initials
      const cleanName = (s.name || '').replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim();
      const parts = cleanName.split(/\s+/);
      const initials = parts.length >= 2 
        ? `${parts[0][0]}.${parts[parts.length - 1][0]}`.toUpperCase()
        : cleanName.substring(0, 2).toUpperCase();

      pill.textContent = initials || '??';
      pillsContainer.appendChild(pill);
    }
  }
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

  // Prevent duplicate toast spam
  const existing = Array.from(container.children).some(child => child.textContent.includes(message));
  if (existing) return;

  // Enforce maximum 3 concurrent toasts
  while (container.children.length >= 3) {
    container.removeChild(container.firstChild);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast-card ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  else if (type === 'warning') icon = '⚠️';
  else if (type === 'conflict') icon = '🔥';

  toast.innerHTML = `
    <span style="font-size:1.1rem; line-height:1;">${icon}</span>
    <span style="font-family:var(--font-mono, monospace); font-size:0.78rem; font-weight:700; flex-grow:1; word-break:break-word;">${message}</span>
    <span style="cursor:pointer; font-weight:800; font-size:1rem; opacity:0.6; padding-left:6px;" onclick="this.parentElement.remove()">&times;</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'all 0.35s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 380);
  }, 4200);
}

function showPushAlert(message) {
  const alertOverlay = document.getElementById('push-alert');
  const alertMsg = document.getElementById('push-message');
  if (alertOverlay && alertMsg) {
    alertMsg.textContent = message;
    alertOverlay.style.display = 'flex';
  }
}

// ==========================================
// QUALITY OF LIFE (QoL) SUITE & AUDIO SYNTH
// ==========================================

let audioCtx = null;
let sfxEnabled = localStorage.getItem('delta_sfx_enabled') !== 'false'; // default true
let activeCountdownSkipFn = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', gainVal = 0.15) {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Suppress audio autoplay restrictions before gesture
  }
}

function playAlertSfx() {
  if (!sfxEnabled) return;
  try {
    playTone(587.33, 0.22, 'triangle', 0.18); // D5
    setTimeout(() => playTone(880, 0.32, 'triangle', 0.22), 110); // A5
  } catch (e) {}
}

function playTickSfx() {
  if (!sfxEnabled) return;
  try {
    playTone(950, 0.04, 'sine', 0.12);
  } catch (e) {}
}

function playSuccessSfx() {
  if (!sfxEnabled) return;
  try {
    playTone(523.25, 0.16, 'triangle', 0.14); // C5
    setTimeout(() => playTone(659.25, 0.16, 'triangle', 0.16), 80); // E5
    setTimeout(() => playTone(783.99, 0.28, 'triangle', 0.2), 160); // G5
  } catch (e) {}
}

function initSoundEffects() {
  const btnSound = document.getElementById('btn-sound-toggle');
  if (!btnSound) return;

  const updateBtn = () => {
    btnSound.textContent = sfxEnabled ? '🔊 SFX: ON' : '🔇 SFX: OFF';
    btnSound.classList.toggle('btn-yellow', sfxEnabled);
    btnSound.classList.toggle('btn-white', !sfxEnabled);
  };

  updateBtn();

  btnSound.addEventListener('click', () => {
    sfxEnabled = !sfxEnabled;
    localStorage.setItem('delta_sfx_enabled', sfxEnabled ? 'true' : 'false');
    updateBtn();
    if (sfxEnabled) {
      playSuccessSfx();
      createToast('🔊 Audio feedback enabled.', 'info');
    } else {
      createToast('🔇 Audio feedback muted.', 'info');
    }
  });
}

function triggerReallocationCountdown(conflictReason, destinationTarget, onComplete) {
  const modal = document.getElementById('reallocation-countdown-modal');
  const card = modal ? modal.querySelector('.reallocation-modal-card') : null;
  const elReason = document.getElementById('reallocation-conflict-text');
  const elDest = document.getElementById('reallocation-destination-text');
  const elNum = document.getElementById('reallocation-countdown-number');
  const elProgress = document.getElementById('reallocation-progress-bar');
  const btnSkip = document.getElementById('btn-skip-countdown');

  if (!modal || !elReason || !elDest || !elNum || !elProgress) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  // Prevent restarting countdown if already active
  if (!modal.classList.contains('hidden')) {
    return;
  }

  elReason.textContent = conflictReason || '🚨 Self-Healing Audit: Operational constraint violation detected.';
  elDest.textContent = destinationTarget || '📍 Reallocating talk node to optimal venue hall and time slot.';
  
  elNum.textContent = '5';
  elProgress.style.transition = 'none';
  elProgress.style.width = '0%';
  modal.classList.remove('hidden');
  document.body.classList.add('self-healing-active');

  // Trigger audio alert chime
  playAlertSfx();

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
  let hasCompleted = false;

  const finishCountdown = () => {
    if (hasCompleted) return;
    hasCompleted = true;
    clearInterval(timer);
    activeCountdownSkipFn = null;

    if (btnSkip) btnSkip.removeEventListener('click', finishCountdown);

    elNum.textContent = '0';
    elProgress.style.transition = 'width 0.15s ease';
    elProgress.style.width = '100%';

    playSuccessSfx();

    setTimeout(() => {
      modal.classList.add('hidden');
      document.body.classList.remove('self-healing-active');
      modal.classList.remove('dramatic-alarm');
      if (card) card.classList.remove('dramatic-shake');
      if (typeof onComplete === 'function') onComplete();
    }, 280);
  };

  activeCountdownSkipFn = finishCountdown;
  if (btnSkip) {
    btnSkip.addEventListener('click', finishCountdown, { once: true });
  }

  const timer = setInterval(() => {
    seconds--;
    if (seconds > 0) {
      elNum.textContent = seconds;
      elNum.classList.add('tick');
      playTickSfx();
      setTimeout(() => elNum.classList.remove('tick'), 250);
    } else {
      finishCountdown();
    }
  }, 1000);
}

window.triggerReallocationCountdown = triggerReallocationCountdown;

// --- CELL DESTINATION HIGHLIGHT ANIMATION ---
function highlightHealedDestination(destinationTarget, newSchedule) {
  let targetTd = null;

  // First attempt: match hall name & slot from destinationTarget text
  if (graphState && destinationTarget) {
    for (const hId in graphState.halls) {
      const hall = graphState.halls[hId];
      if (destinationTarget.toLowerCase().includes(hall.name.toLowerCase())) {
        for (const sId in graphState.slots) {
          const slot = graphState.slots[sId];
          if (
            destinationTarget.toLowerCase().includes(sId.toLowerCase()) ||
            destinationTarget.toLowerCase().includes(slot.time.toLowerCase())
          ) {
            targetTd = document.querySelector(`td[data-hall-id="${hId}"][data-slot-id="${sId}"]`);
            break;
          }
        }
        if (!targetTd) {
          targetTd = document.querySelector(`td[data-hall-id="${hId}"][data-slot-id]`);
        }
        break;
      }
    }
  }

  // Second attempt: find cell whose session changed between previousSchedule and newSchedule
  if (!targetTd && previousSchedule && newSchedule) {
    for (const sId in newSchedule) {
      for (const hId in newSchedule[sId]) {
        if (newSchedule[sId][hId] && (!previousSchedule[sId] || previousSchedule[sId][hId] !== newSchedule[sId][hId])) {
          targetTd = document.querySelector(`td[data-hall-id="${hId}"][data-slot-id="${sId}"]`);
          break;
        }
      }
      if (targetTd) break;
    }
  }

  if (targetTd) {
    targetTd.classList.remove('cell-healed-highlight');
    void targetTd.offsetWidth; // Force reflow
    targetTd.classList.add('cell-healed-highlight');
    setTimeout(() => targetTd.classList.remove('cell-healed-highlight'), 3200);
  }
}

window.highlightHealedDestination = highlightHealedDestination;

// --- KEYBOARD SHORTCUTS CONTROLLER ---
function initKeyboardShortcuts() {
  const shortcutsModal = document.getElementById('shortcuts-modal');
  const btnOpenShortcuts = document.getElementById('btn-shortcuts-modal');
  const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');

  const toggleModal = (show) => {
    if (!shortcutsModal) return;
    if (typeof show === 'boolean') {
      shortcutsModal.classList.toggle('hidden', !show);
    } else {
      shortcutsModal.classList.toggle('hidden');
    }
  };

  if (btnOpenShortcuts) {
    btnOpenShortcuts.addEventListener('click', () => toggleModal(true));
  }
  if (btnCloseShortcuts) {
    btnCloseShortcuts.addEventListener('click', () => toggleModal(false));
  }
  if (shortcutsModal) {
    shortcutsModal.addEventListener('click', (e) => {
      if (e.target === shortcutsModal) toggleModal(false);
    });
  }

  window.addEventListener('keydown', (e) => {
    // If active countdown is showing, Space or Escape immediately skips countdown
    if (activeCountdownSkipFn && (e.code === 'Space' || e.key === 'Escape')) {
      e.preventDefault();
      activeCountdownSkipFn();
      return;
    }

    // Don't trigger hotkeys when focused on inputs / textareas / selects
    const tag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      toggleModal();
      return;
    }

    if (e.key === 'Escape' && shortcutsModal && !shortcutsModal.classList.contains('hidden')) {
      toggleModal(false);
      return;
    }

    const key = e.key.toLowerCase();
    if (key === 'r') {
      const btn = document.getElementById('btn-reset-db');
      if (btn) btn.click();
    } else if (key === 'd') {
      const btn = document.getElementById('btn-trigger-delay');
      if (btn) btn.click();
    } else if (key === 's') {
      const btn = document.getElementById('btn-trigger-surge');
      if (btn) btn.click();
    } else if (key === 'm') {
      const btn = document.getElementById('btn-mass-disruption');
      if (btn) btn.click();
    } else if (key === 'c') {
      const iCalUrl = `${window.location.origin}/api/ical`;
      navigator.clipboard.writeText(iCalUrl)
        .then(() => {
          playSuccessSfx();
          createToast('📋 Live iCal feed URL copied to clipboard!', 'success');
        })
        .catch(() => createToast(`Live feed: ${iCalUrl}`, 'info'));
    }
  });
}

// --- LIVE SCHEDULE MATRIX REAL-TIME TALK FILTER ---
function applyMatrixSearch() {
  const searchInput = document.getElementById('matrix-search-input');
  if (!searchInput) return;
  const q = searchInput.value.trim().toLowerCase();

  const blocks = document.querySelectorAll('.schedule-block:not(.empty)');
  blocks.forEach(block => {
    if (!q) {
      block.classList.remove('search-match', 'search-dimmed');
      return;
    }

    const text = block.textContent.toLowerCase();
    const topicId = block.getAttribute('data-topic-id');
    const topic = graphState?.topics?.[topicId];
    const speaker = topic ? graphState?.speakers?.[topic.speakerId] : null;

    let match = text.includes(q);
    if (topic && topic.tags && topic.tags.some(tag => tag.toLowerCase().includes(q))) {
      match = true;
    }
    if (speaker && speaker.role && speaker.role.toLowerCase().includes(q)) {
      match = true;
    }

    if (match) {
      block.classList.add('search-match');
      block.classList.remove('search-dimmed');
    } else {
      block.classList.remove('search-match');
      block.classList.add('search-dimmed');
    }
  });
}

window.applyMatrixSearch = applyMatrixSearch;

function initMatrixSearch() {
  const searchInput = document.getElementById('matrix-search-input');
  if (!searchInput) return;
  searchInput.addEventListener('input', applyMatrixSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      applyMatrixSearch();
      searchInput.blur();
    }
  });
}

// --- SWARM NEGOTIATION TRANSCRIPT COPY HANDLER ---
function initSwarmCopy() {
  const btn = document.getElementById('btn-copy-swarm');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const bubbles = document.querySelectorAll('#swarm-chat-messages .chat-bubble');
    if (!bubbles.length) {
      createToast('No dialogue to copy yet.', 'info');
      return;
    }

    let transcript = '### DELTA Engine - Swarm Negotiation Transcript\n';
    transcript += `Generated at: ${new Date().toLocaleString()}\n\n`;

    bubbles.forEach(bubble => {
      const sender = bubble.querySelector('.chat-sender')?.textContent.trim() || 'Agent';
      const text = bubble.querySelector('.chat-text')?.textContent.trim() || '';
      const time = bubble.querySelector('.chat-time')?.textContent.trim() || '';
      transcript += `${time ? `[${time}] ` : ''}**${sender}**: ${text}\n\n`;
    });

    navigator.clipboard.writeText(transcript)
      .then(() => {
        playSuccessSfx();
        createToast('📋 Swarm transcript copied to clipboard as Markdown!', 'success');
        const origText = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.classList.remove('btn-yellow');
        btn.classList.add('btn-green');
        setTimeout(() => {
          btn.textContent = origText;
          btn.classList.remove('btn-green');
          btn.classList.add('btn-yellow');
        }, 2000);
      })
      .catch(err => {
        console.error('Clipboard copy failed:', err);
        createToast('Failed to copy to clipboard.', 'warning');
      });
  });
}

