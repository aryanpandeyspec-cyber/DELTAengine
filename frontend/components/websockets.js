// --- WEBSOCKET CLIENT SYNC ---

async function fetchInitialStateHTTP() {
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const data = await res.json();
      if (data && data.graph && data.schedule) {
        previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
        graphState = data.graph;
        scheduleState = data.schedule;

        populateForms();
        renderScheduleGrid();
        rebuildGraphData();
        updateCounters();
        if (selectedNodeId) selectGraphNode(selectedNodeId);
      }
    }
  } catch (err) {
    console.warn('[HTTP FALLBACK] Could not fetch /api/state over HTTP:', err);
  }
}

function initWebSockets() {
  // Always fetch state via HTTP REST first to guarantee data loads on Vercel / serverless hosts!
  fetchInitialStateHTTP();

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  appendLog('[SYSTEM] Establishing secure WebSocket socket connection...', 'system');

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      appendLog('[SYSTEM] WebSocket client successfully linked to Event Operating System.', 'success');
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      switch (payload.type) {
        case 'INIT_STATE':
          previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
          graphState = payload.data.graph;
          scheduleState = payload.data.schedule;

          populateForms();
          renderScheduleGrid();
          rebuildGraphData();
          updateCounters();
          if (selectedNodeId) selectGraphNode(selectedNodeId);
          break;

        case 'SCHEDULE_HEALED':
          const conflictLog = payload.data.logs ? payload.data.logs.find(l => l.includes('[CONFLICT]') || l.includes('exceeds') || l.includes('Capacity')) : null;
          const actionLog = payload.data.logs ? payload.data.logs.find(l => l.includes('moved to') || l.includes('Relocating') || l.includes('Scheduled') || l.includes('Solver')) : null;

          const conflictText = conflictLog ? conflictLog.replace(/\[.*?\]/g, '').trim() : '⚠️ Self-Healing Triggered: Operational constraint violation detected.';
          const destText = actionLog ? actionLog.replace(/\[.*?\]/g, '').trim() : '📍 Optimization Solver reallocating talk node to viable venue position.';

          triggerReallocationCountdown(conflictText, destText, () => {
            previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
            graphState = payload.data.graph;
            scheduleState = payload.data.schedule;

            if (payload.data.logs) {
              let solved = false;
              payload.data.logs.forEach(log => {
                let logType = 'system';
                if (log.includes('[CONFLICT]')) logType = 'conflict';
                else if (log.includes('[Action]')) logType = 'action';
                else if (log.includes('[Solver:')) logType = 'system';
                else if (log.includes('Audit clean')) {
                  logType = 'success';
                  solved = true;
                }

                appendLog(log, logType);
              });
            }

            populateForms();
            renderScheduleGrid();
            rebuildGraphData();
            updateCounters();
            if (selectedNodeId) selectGraphNode(selectedNodeId);

            if (payload.data.swarmChat) {
              renderSwarmChat(payload.data.swarmChat);
            }

            if (payload.data.notifications && payload.data.notifications.length > 0) {
              payload.data.notifications.forEach(n => {
                createToast(n.message, n.type);
              });
              showPushAlert(payload.data.notifications[0].message);
            }
          });
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
            showPushAlert(payload.data.notifications[0].message);
          }
        });
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
        appendLog('[SYSTEM] DB flushed. Schedules restored to default state.', 'success');

        populateForms();
        renderScheduleGrid();
        rebuildGraphData();
        updateCounters();
        createToast('Conference layout reset to default settings!', 'success');
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
    }
  };

  ws.onerror = (err) => {
    appendLog('[ERROR] Connection interrupted. Running in fallback offline layout.', 'conflict');
    createToast('WebSocket connection error. Retrying...', 'warning');
  };

  ws.onclose = () => {
    appendLog('[SYSTEM] Connection offline. Offline synchronization active.', 'system');
    setTimeout(initWebSockets, 5000);
  };
}
