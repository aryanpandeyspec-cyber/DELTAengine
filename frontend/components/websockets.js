function safeSyncUI(selectedId) {
  if (typeof populateForms === 'function') populateForms();
  if (typeof renderScheduleGrid === 'function') renderScheduleGrid();
  if (typeof rebuildGraphData === 'function') rebuildGraphData();
  if (typeof updateCounters === 'function') updateCounters();
  if (selectedId && typeof selectGraphNode === 'function') selectGraphNode(selectedId);
  if (typeof window.syncAdminDashboard === 'function') {
    window.syncAdminDashboard({ schedule: scheduleState, graph: graphState });
  }
}

function updateAgentHealthIndicator(status) {
  const statusEl = document.getElementById('agent-health-status');
  const descEl = document.getElementById('agent-health-desc');
  if (!statusEl) return;

  if (status === 'ONLINE') {
    statusEl.className = 'status-indicator online';
    statusEl.textContent = 'ONLINE';
    if (descEl) descEl.textContent = 'Self-Healing Agent Active';
  } else if (status === 'HEALING') {
    statusEl.className = 'status-indicator warning';
    statusEl.textContent = 'HEALING...';
    if (descEl) descEl.textContent = 'Swarm Optimization in Progress';
  } else if (status === 'FROZEN') {
    statusEl.className = 'status-indicator critical';
    statusEl.textContent = 'FROZEN';
    if (descEl) descEl.textContent = 'Admin Autonomy Freeze Active';
  } else if (status === 'OFFLINE') {
    statusEl.className = 'status-indicator offline';
    statusEl.textContent = 'OFFLINE';
    if (descEl) descEl.textContent = 'Reconnecting to Event OS...';
  }
}

function initWebSockets() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  if (typeof appendLog === 'function') appendLog('[SYSTEM] Establishing secure WebSocket socket connection...', 'system');

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    if (typeof appendLog === 'function') appendLog('[SYSTEM] WebSocket client successfully linked to Event Operating System.', 'success');
    updateAgentHealthIndicator('ONLINE');
  };

  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);

    switch (payload.type) {
      case 'INIT_STATE':
        previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
        graphState = payload.data.graph;
        scheduleState = payload.data.schedule;

        safeSyncUI(selectedNodeId);
        if (typeof window.syncAdminDashboard === 'function') {
          window.syncAdminDashboard(payload.data);
        }
        break;

      case 'SCHEDULE_UPDATED':
        previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
        if (payload.data.graph) graphState = payload.data.graph;
        if (payload.data.schedule) scheduleState = payload.data.schedule;

        if (payload.data.logs && typeof appendLog === 'function') {
          payload.data.logs.forEach(log => {
            let logType = 'system';
            if (log.includes('[CONFLICT]')) logType = 'conflict';
            else if (log.includes('[Action]')) logType = 'action';
            else if (log.includes('Audit clean')) logType = 'success';
            appendLog(log, logType);
          });
        }

        safeSyncUI(selectedNodeId);

        if (payload.data.swarmChat && typeof renderSwarmChat === 'function') {
          renderSwarmChat(payload.data.swarmChat);
        }

        if (payload.data.notifications && payload.data.notifications.length > 0) {
          payload.data.notifications.forEach(n => {
            if (typeof createToast === 'function') createToast(n.message, n.type);
          });
        }
        break;

      case 'SCHEDULE_HEALED':
        updateAgentHealthIndicator('HEALING');
        setTimeout(() => updateAgentHealthIndicator('ONLINE'), 5000);

        // Render swarm chat immediately so agents are seen negotiating in real time!
        if (payload.data.swarmChat && typeof renderSwarmChat === 'function') {
          renderSwarmChat(payload.data.swarmChat);
        }

        const hasConflict = payload.data.hasConflict || (payload.data.logs && payload.data.logs.some(l => l.includes('[CONFLICT]')));

        if (hasConflict) {
          // If initial conflicting schedule provided, render it so coordinator sees the conflict in place
          if (payload.data.initialSchedule) {
            scheduleState = payload.data.initialSchedule;
            if (typeof renderScheduleGrid === 'function') renderScheduleGrid();
          }

          const conflictLog = payload.data.logs ? payload.data.logs.find(l => l.includes('[CONFLICT]') || l.includes('exceeds') || l.includes('Capacity')) : null;
          const actionLog = payload.data.logs ? payload.data.logs.find(l => l.includes('[Action') || l.includes('moved to') || l.includes('Relocating') || l.includes('Scheduled') || l.includes('Solver')) : null;

          const conflictText = payload.data.conflictReason || (conflictLog ? conflictLog.replace(/\[.*?\]/g, '').trim() : '⚠️ Self-Healing Triggered: Operational constraint violation detected.');
          const destText = payload.data.destinationTarget || (actionLog ? actionLog.replace(/\[.*?\]/g, '').trim() : '📍 Optimization Solver reallocating talk node to viable venue position.');

          const fnCountdown = window.triggerReallocationCountdown || (typeof triggerReallocationCountdown === 'function' ? triggerReallocationCountdown : null);

          if (fnCountdown) {
            fnCountdown(conflictText, destText, () => {
              previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
              graphState = payload.data.graph;
              scheduleState = payload.data.schedule;

              if (payload.data.logs && typeof appendLog === 'function') {
                payload.data.logs.forEach(log => {
                  let logType = 'system';
                  if (log.includes('[CONFLICT]')) logType = 'conflict';
                  else if (log.includes('[Action]')) logType = 'action';
                  else if (log.includes('[Solver:')) logType = 'system';
                  else if (log.includes('Audit clean')) logType = 'success';
                  appendLog(log, logType);
                });
              }

              safeSyncUI(selectedNodeId);

              if (payload.data.notifications && payload.data.notifications.length > 0) {
                payload.data.notifications.forEach(n => {
                  if (typeof createToast === 'function') createToast(n.message, n.type);
                });
                if (typeof showPushAlert === 'function') showPushAlert(payload.data.notifications[0].message);
              }
              if (typeof createToast === 'function') createToast('✨ Self-Healing complete: Talk node redirected to applicable hall!', 'success');
              if (typeof highlightHealedDestination === 'function') {
                highlightHealedDestination(destText, payload.data.schedule);
              }
            });
          } else {
            // Direct apply fallback
            previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
            graphState = payload.data.graph;
            scheduleState = payload.data.schedule;
            safeSyncUI(selectedNodeId);
          }
        } else {
          // Clean update with no conflicts
          previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
          if (payload.data.graph) graphState = payload.data.graph;
          if (payload.data.schedule) scheduleState = payload.data.schedule;

          if (payload.data.logs && typeof appendLog === 'function') {
            payload.data.logs.forEach(log => {
              let logType = log.includes('clean') ? 'success' : 'system';
              appendLog(log, logType);
            });
          }

          safeSyncUI(selectedNodeId);
        }
        break;

      case 'SENTIMENT_ALERT':
        if (payload.data.logs) {
          payload.data.logs.forEach(log => appendLog(log, 'system'));
        }
        if (payload.data.swarmChat) {
          renderSwarmChat(payload.data.swarmChat);
        }
        if (payload.data.notifications) {
          payload.data.notifications.forEach(n => {
            createToast(n.message, n.type);
          });
        }
        // Update Live attendee feed ticker
        if (payload.data.logs && payload.data.logs.length > 0) {
          updateAttendeeFeed(payload.data.logs[0]);
        }
        break;

      case 'STATE_RESET':
        previousSchedule = null;
        graphState = payload.data.graph;
        scheduleState = payload.data.schedule;
        selectedNodeId = null;
        document.getElementById('node-inspector').style.display = 'none';
        document.getElementById('agent-logs').innerHTML = '';
        document.getElementById('swarm-chat-messages').innerHTML = `
          <div class="chat-bubble system">
            <span class="chat-sender">SYSTEM</span>
            <span class="chat-text">Swarm session synchronized. Scheduler ⏱️, Logistics 🏛️, Liaison 🗣️, Marketing 📢 active.</span>
          </div>`;
        if (typeof appendLog === 'function') appendLog('[SYSTEM] DB flushed. Schedules restored to default state.', 'success');

        safeSyncUI(null);
        if (typeof createToast === 'function') createToast('Conference layout reset to default settings!', 'success');
        break;

      case 'WHATSAPP_DISPATCH':
        if (typeof window.handleWhatsAppDispatch === 'function') {
          window.handleWhatsAppDispatch(payload.data);
        }
        break;

      case 'EMAIL_DISPATCH':
        if (typeof window.handleEmailDispatch === 'function') {
          window.handleEmailDispatch(payload.data);
        }
        break;

      case 'ADMIN_AUDIT':
        const auditBox = document.getElementById('admin-audit-log-container');
        if (auditBox) {
          const line = document.createElement('div');
          line.className = 'admin-audit-line info';
          line.textContent = `[${payload.data.time}] ${payload.data.message}`;
          auditBox.insertBefore(line, auditBox.firstChild);
        }
        break;

      case 'LIMITER_UPDATED':
        const toggleLlm = document.getElementById('toggle-llm-limiter');
        const toggleDb = document.getElementById('toggle-db-limiter');
        if (toggleLlm && payload.data) toggleLlm.checked = !!payload.data.llmLimiter;
        if (toggleDb && payload.data) toggleDb.checked = !!payload.data.dbLimiter;
        break;

      case 'CCTV_OCCUPANCY_UPDATE':
        if (typeof window.handleCctvOccupancyUpdate === 'function') {
          window.handleCctvOccupancyUpdate(payload.data);
        }
        break;

      case 'VOLUNTEER_ALERT':
        if (typeof window.handleVolunteerAlert === 'function') {
          window.handleVolunteerAlert(payload.data);
        }
        break;

      case 'DOOR_TRIGGER':
        if (typeof window.handleDoorSensorTrigger === 'function') {
          window.handleDoorSensorTrigger(payload.data);
        }
        break;

      case 'ATTENDEE_PASSAGE_EVENT':
        if (typeof window.handleAttendeePassageEvent === 'function') {
          window.handleAttendeePassageEvent(payload.data);
        }
        break;

      case 'ROOM_OCCUPANCY_UPDATE':
        if (typeof window.handleRoomOccupancyUpdate === 'function') {
          window.handleRoomOccupancyUpdate(payload.data);
        }
        break;
    }
  };

  ws.onerror = (err) => {
    updateAgentHealthIndicator('OFFLINE');
    if (typeof appendLog === 'function') appendLog('[ERROR] Connection interrupted. Running in fallback offline layout.', 'conflict');
    if (typeof createToast === 'function') createToast('WebSocket connection error. Retrying...', 'warning');
  };

  ws.onclose = () => {
    updateAgentHealthIndicator('OFFLINE');
    if (typeof appendLog === 'function') appendLog('[SYSTEM] Connection offline. Offline synchronization active.', 'system');
    setTimeout(initWebSockets, 5000);
  };
}
