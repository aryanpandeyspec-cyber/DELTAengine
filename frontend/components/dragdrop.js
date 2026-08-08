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

        // Build Draggable block
        const block = document.createElement('div');
        block.className = 'schedule-block';
        block.setAttribute('draggable', 'true');
        block.setAttribute('data-topic-id', topicId);
        
        block.innerHTML = `
          <div class="block-title">${topic.title}</div>
          <div class="block-meta">
            <span class="speaker-badge">
              <span>${speaker.avatar}</span>
              <span>${speaker.name}</span>
            </span>
            <span class="interest-badge">
              🔥 ${topic.interest}
            </span>
          </div>
          ${speaker.delay > 0 ? `<div style="font-size:0.7rem; color:var(--google-red); font-weight:bold; margin-top:5px; text-transform:uppercase;">⚠️ Delayed: +${speaker.delay}m</div>` : ''}
        `;
        
        // Bind Drag event to block
        block.addEventListener('dragstart', handleDragStartBlock);
        block.addEventListener('dragend', handleDragEndBlock);
        
        // Bind Hover Event for Floating Card Details Popover
        block.addEventListener('mouseenter', (e) => {
          const hoverCard = document.getElementById('matrix-hover-card');
          if (!hoverCard) return;

          const elSpeaker = document.getElementById('hover-speaker-name');
          const elInterest = document.getElementById('hover-interest-badge');
          const elTitle = document.getElementById('hover-topic-title');
          const elSummary = document.getElementById('hover-topic-summary');
          const tagsRow = document.getElementById('hover-tags-row');

          if (elSpeaker) elSpeaker.textContent = `${speaker.avatar} ${speaker.name}`;
          if (elInterest) elInterest.textContent = `🔥 ${topic.interest} Interest`;
          if (elTitle) elTitle.textContent = topic.title;
          if (elSummary) elSummary.textContent = topic.summary || 'Scheduled presentation session.';
          
          if (tagsRow) {
            tagsRow.innerHTML = (topic.tags || []).map(t => `<span class="badge badge-yellow" style="font-size:0.68rem; padding:1px 5px;">#${t}</span>`).join(' ');
          }

          hoverCard.style.display = 'block';
          const cardWidth = 320;
          const cardHeight = 160;
          let left = e.clientX + 15;
          let top = e.clientY + 15;

          if (left + cardWidth > window.innerWidth) left = e.clientX - cardWidth - 10;
          if (top + cardHeight > window.innerHeight) top = e.clientY - cardHeight - 10;

          hoverCard.style.left = `${Math.max(10, left)}px`;
          hoverCard.style.top = `${Math.max(10, top)}px`;
        });

        block.addEventListener('mousemove', (e) => {
          const hoverCard = document.getElementById('matrix-hover-card');
          if (!hoverCard || hoverCard.style.display === 'none') return;
          const cardWidth = 320;
          const cardHeight = 160;
          let left = e.clientX + 15;
          let top = e.clientY + 15;

          if (left + cardWidth > window.innerWidth) left = e.clientX - cardWidth - 10;
          if (top + cardHeight > window.innerHeight) top = e.clientY - cardHeight - 10;

          hoverCard.style.left = `${Math.max(10, left)}px`;
          hoverCard.style.top = `${Math.max(10, top)}px`;
        });

        block.addEventListener('mouseleave', () => {
          const hoverCard = document.getElementById('matrix-hover-card');
          if (hoverCard) hoverCard.style.display = 'none';
        });

        td.appendChild(block);
      } else {
        td.innerHTML = `<div class="schedule-block empty">No Session</div>`;
      }

      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }
}

let currentDraggedTopicId = null;

// HTML5 drag start handler
function handleDragStartBlock(e) {
  const topicId = e.currentTarget.getAttribute('data-topic-id');
  currentDraggedTopicId = topicId;
  e.dataTransfer.setData('text/plain', topicId);
  e.dataTransfer.effectAllowed = 'move';

  const hoverCard = document.getElementById('matrix-hover-card');
  if (hoverCard) hoverCard.style.display = 'none';
}

function handleDragEndBlock(e) {
  currentDraggedTopicId = null;
  const hoverCard = document.getElementById('matrix-hover-card');
  if (hoverCard) hoverCard.style.display = 'none';
}

// HTML5 drag over cell
function handleDragOverCell(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

// HTML5 drag enter cell
function handleDragEnterCell(e) {
  e.preventDefault();
  const cell = e.target.closest('td') || e.currentTarget;
  if (cell) cell.classList.add('drag-over');
}

// HTML5 drag leave cell
function handleDragLeaveCell(e) {
  const cell = e.target.closest('td') || e.currentTarget;
  if (cell) cell.classList.remove('drag-over');
}

// HTML5 drop cell
function handleDropOnCell(e) {
  e.preventDefault();
  const cell = e.target.closest('td') || e.currentTarget;
  if (cell) cell.classList.remove('drag-over');
  
  const topicId = currentDraggedTopicId || e.dataTransfer.getData('text/plain');
  const targetSlotId = cell ? cell.getAttribute('data-slot-id') : null;
  const targetHallId = cell ? cell.getAttribute('data-hall-id') : null;

  if (!topicId || !targetSlotId || !targetHallId) {
    return;
  }

  // Make sure we're not dropping in the exact same spot
  if (scheduleState && scheduleState[targetSlotId] && scheduleState[targetSlotId][targetHallId] === topicId) return;

  if (typeof appendLog === 'function') {
    appendLog(`[SYSTEM] Initiating manual rescheduled move request for talk "${topicId}"...`, 'system');
  }

  fetch('/api/schedule/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicId, targetSlotId, targetHallId })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.schedule) {
      previousSchedule = JSON.parse(JSON.stringify(scheduleState));
      scheduleState = data.schedule;
      renderScheduleGrid();
      if (typeof rebuildGraphData === 'function') rebuildGraphData();
      if (typeof updateCounters === 'function') updateCounters();
      if (typeof createToast === 'function') createToast('⚡ Session rescheduled & self-healed!', 'success');

      if (data.logs && typeof appendLog === 'function') {
        data.logs.forEach(log => {
          let logType = 'system';
          if (log.includes('[CONFLICT]')) logType = 'conflict';
          else if (log.includes('[Action]')) logType = 'action';
          appendLog(log, logType);
        });
      }
      if (data.swarmChat && typeof renderSwarmChat === 'function') {
        renderSwarmChat(data.swarmChat);
      }
    }
  })
  .catch(err => {
    console.error(err);
    if (typeof createToast === 'function') createToast('Rescheduling request failed.', 'warning');
  });
}

function initDragAndDrop() {
  // Configured dynamically during renderScheduleGrid
}
