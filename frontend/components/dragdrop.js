// --- HTML5 SCHEDULE MATRIX DRAG & DROP HANDLERS ---

// Render schedule grid rows and columns dynamically with HTML5 Drag & Drop
function renderScheduleGrid() {
  const tbody = document.getElementById('schedule-tbody');
  tbody.innerHTML = '';

  if (!graphState || !scheduleState) return;

  for (const slotId in graphState.slots) {
    const th = document.getElementById(`th-${slotId}`);
    if (th) th.textContent = graphState.slots[slotId].time;
  }

  for (const hallId in graphState.halls) {
    const hall = graphState.halls[hallId];
    const tr = document.createElement('tr');
    
    // Hall cell
    const tdHallName = document.createElement('td');
    tdHallName.style.fontWeight = '800';
    tdHallName.style.backgroundColor = '#faf9f6';
    tdHallName.style.fontFamily = 'var(--font-mono)';
    tdHallName.innerHTML = `
      <div style="font-size: 0.95rem;">${hall.name}</div>
      <div style="font-size: 0.75rem; color: #666; font-weight:600;">Cap: ${hall.capacity} pax</div>
    `;
    tr.appendChild(tdHallName);

    // Slots cells
    for (const slotId in graphState.slots) {
      const td = document.createElement('td');
      td.setAttribute('data-hall-id', hallId);
      td.setAttribute('data-slot-id', slotId);
      
      // Bind HTML5 Drop handlers to cell
      td.addEventListener('dragover', handleDragOverCell);
      td.addEventListener('dragenter', handleDragEnterCell);
      td.addEventListener('dragleave', handleDragLeaveCell);
      td.addEventListener('drop', handleDropOnCell);
      
      const topicId = scheduleState[slotId][hallId];
      
      if (topicId) {
        const topic = graphState.topics[topicId];
        const speaker = graphState.speakers[topic.speakerId];
        
        const isConflict = topic.interest > hall.capacity;
        if (isConflict) {
          td.classList.add('cell-conflict');
        }

        const wasScheduledHere = previousSchedule && previousSchedule[slotId] && previousSchedule[slotId][hallId] === topicId;
        if (previousSchedule && !wasScheduledHere) {
          td.classList.add('cell-changed');
          setTimeout(() => td.classList.remove('cell-changed'), 1500);
        }

        // Build Draggable block with rich title tooltip and neo-brutalist styling
        const block = document.createElement('div');
        block.className = 'schedule-block';
        block.setAttribute('draggable', 'true');
        block.setAttribute('data-topic-id', topicId);
        block.title = `${topic.title}\nSpeaker: ${speaker.name} (${speaker.role})\nAttendees: ${topic.interest} pax | Hall Limit: ${hall.capacity} pax\nStatus: ${isConflict ? '⚠️ ROOM CAPACITY EXCEEDED' : '✅ Optimal Capacity'}`;
        
        block.innerHTML = `
          <div class="block-title">${typeof escapeHtml === 'function' ? escapeHtml(topic.title) : topic.title}</div>
          <div class="block-meta">
            <span class="speaker-badge">
              <span>${speaker.avatar}</span>
              <span>${speaker.name}</span>
            </span>
            <span class="interest-badge" style="${isConflict ? 'background:#ea4335; color:#fff; font-weight:800;' : ''}">
              ${isConflict ? '⚠️' : '🔥'} ${topic.interest}
            </span>
          </div>
          ${speaker.delay > 0 ? `<div style="font-size:0.7rem; color:var(--google-red); font-weight:bold; margin-top:5px; text-transform:uppercase;">⚠️ Delayed: +${speaker.delay}m</div>` : ''}
          ${isConflict ? `<div style="font-size:0.68rem; color:#d93025; font-weight:800; margin-top:3px; background:#fce8e6; padding:2px 4px; border-radius:4px; border:1px solid #d93025;">OVER CAP (${topic.interest}/${hall.capacity})</div>` : ''}
        `;
        
        // Bind Drag event to block
        block.addEventListener('dragstart', handleDragStartBlock);
        block.addEventListener('dragend', handleDragEndBlock);
        
        td.appendChild(block);
      } else {
        const emptyBlock = document.createElement('div');
        emptyBlock.className = 'schedule-block empty';
        emptyBlock.textContent = 'No Session';
        td.appendChild(emptyBlock);
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  // Re-apply any active search filter after re-rendering grid
  if (typeof applyMatrixSearch === 'function') {
    applyMatrixSearch();
  }
}

let currentDraggedTopicId = null;

// HTML5 drag start handler
function handleDragStartBlock(e) {
  const topicId = e.currentTarget.getAttribute('data-topic-id');
  currentDraggedTopicId = topicId;
  e.dataTransfer.setData('text/plain', topicId);
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');

  // Auto-expand tour guide on drag
  const tourCard = document.getElementById('tour-card');
  const btnToggle = document.getElementById('btn-toggle-tour');
  if (tourCard && tourCard.classList.contains('collapsed')) {
    tourCard.classList.remove('collapsed');
    if (btnToggle) btnToggle.textContent = '_';
  }
}

// HTML5 drag end handler
function handleDragEndBlock(e) {
  currentDraggedTopicId = null;
  if (e.currentTarget) e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('td.drag-over').forEach(td => td.classList.remove('drag-over'));
}

// HTML5 drag over cell
function handleDragOverCell(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
}

// HTML5 drag enter cell
function handleDragEnterCell(e) {
  e.preventDefault();
  e.stopPropagation();
  const cell = e.target.closest('td') || e.currentTarget;
  if (cell) cell.classList.add('drag-over');
}

// HTML5 drag leave cell
function handleDragLeaveCell(e) {
  const cell = e.target.closest('td') || e.currentTarget;
  if (cell && !cell.contains(e.relatedTarget)) {
    cell.classList.remove('drag-over');
  }
}

// HTML5 drop cell
function handleDropOnCell(e) {
  e.preventDefault();
  e.stopPropagation();
  const cell = e.target.closest('td') || e.currentTarget;
  if (cell) cell.classList.remove('drag-over');
  
  const topicId = currentDraggedTopicId || e.dataTransfer.getData('text/plain');
  const targetSlotId = cell ? cell.getAttribute('data-slot-id') : null;
  const targetHallId = cell ? cell.getAttribute('data-hall-id') : null;

  if (!topicId || !targetSlotId || !targetHallId) {
    console.warn('[DragDrop Warning] Missing drop parameters:', { topicId, targetSlotId, targetHallId });
    return;
  }

  // Check if dropped in exact same position
  if (scheduleState[targetSlotId] && scheduleState[targetSlotId][targetHallId] === topicId) return;

  // Optimistic local update for instantaneous live matrix UI responsiveness
  let srcSlot = null;
  let srcHall = null;
  for (const sId in scheduleState) {
    for (const hId in scheduleState[sId]) {
      if (scheduleState[sId][hId] === topicId) {
        srcSlot = sId;
        srcHall = hId;
      }
    }
  }

  previousSchedule = JSON.parse(JSON.stringify(scheduleState));
  const occupiedTopicId = scheduleState[targetSlotId][targetHallId];
  if (srcSlot && srcHall) {
    scheduleState[srcSlot][srcHall] = occupiedTopicId || null;
  }
  scheduleState[targetSlotId][targetHallId] = topicId;

  // Render instantaneous matrix update
  renderScheduleGrid();
  if (typeof rebuildGraphData === 'function') rebuildGraphData();
  if (typeof updateCounters === 'function') updateCounters();

  const topicName = graphState?.topics?.[topicId]?.title || topicId;
  const hallName = graphState?.halls?.[targetHallId]?.name || targetHallId;
  const slotTime = graphState?.slots?.[targetSlotId]?.time || targetSlotId;
  appendLog(`[Action] Coordinator rescheduled "${topicName}" to ${hallName} (${slotTime}).`, 'action');

  fetch('/api/schedule/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicId, targetSlotId, targetHallId })
  })
  .then(res => res.json())
  .then(data => {
    if (data.swarmChat) {
      renderSwarmChat(data.swarmChat);
    }

    if (data.hasConflict) {
      const conflictText = data.conflictReason || '⚠️ Operational constraint violation detected.';
      const destText = data.destinationTarget || '📍 Self-Healing Engine reallocating talk to viable venue hall.';

      const fnCountdown = window.triggerReallocationCountdown || (typeof triggerReallocationCountdown === 'function' ? triggerReallocationCountdown : null);
      if (fnCountdown) {
        fnCountdown(conflictText, destText, () => {
          previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
          scheduleState = data.schedule;
          renderScheduleGrid();
          if (typeof rebuildGraphData === 'function') rebuildGraphData();
          if (typeof updateCounters === 'function') updateCounters();
          createToast('✨ Self-Healing Complete: Node reallocated to applicable hall!', 'success');
          if (typeof highlightHealedDestination === 'function') {
            highlightHealedDestination(destText, data.schedule);
          }

          if (data.logs) {
            data.logs.forEach(log => {
              let logType = 'system';
              if (log.includes('[CONFLICT]')) logType = 'conflict';
              else if (log.includes('[Action]')) logType = 'action';
              else if (log.includes('Audit clean')) logType = 'success';
              appendLog(log, logType);
            });
          }
        });
      } else {
        scheduleState = data.schedule;
        renderScheduleGrid();
      }
    } else {
      if (data.success && data.schedule) {
        scheduleState = data.schedule;
        renderScheduleGrid();
        if (typeof rebuildGraphData === 'function') rebuildGraphData();
        if (typeof updateCounters === 'function') updateCounters();
        createToast('Session scheduled & live matrix updated!', 'success');

        if (data.logs) {
          data.logs.forEach(log => {
            let logType = 'system';
            if (log.includes('[Action]')) logType = 'action';
            appendLog(log, logType);
          });
        }
      }
    }
  })
  .catch(err => {
    console.error(err);
    createToast('Schedule sync error.', 'warning');
  });
}

function initDragAndDrop() {
  // Configured dynamically during renderScheduleGrid
}
