let syncUiPending = false;
let pendingSelectedId = null;

function safeSyncUI(selectedId) {
  if (selectedId) pendingSelectedId = selectedId;
  if (syncUiPending) return;
  syncUiPending = true;

  requestAnimationFrame(() => {
    syncUiPending = false;
    const targetId = pendingSelectedId || selectedNodeId;
    pendingSelectedId = null;

    if (typeof populateForms === 'function') populateForms();
    if (typeof renderScheduleGrid === 'function') renderScheduleGrid();
    if (typeof rebuildGraphData === 'function') rebuildGraphData();
    if (typeof updateCounters === 'function') updateCounters();
    if (targetId && typeof selectGraphNode === 'function') selectGraphNode(targetId);
    if (typeof window.syncAdminDashboard === 'function') {
      window.syncAdminDashboard({ schedule: scheduleState, graph: graphState });
    }
  });
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

let wsReconnectTimer = null;
let fallbackPollingTimer = null;

function startFallbackPolling() {
  if (fallbackPollingTimer) return;
  fallbackPollingTimer = setInterval(async () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          if (data && data.schedule) {
            graphState = data.graph;
            scheduleState = data.schedule;
            safeSyncUI(selectedNodeId);
          }
        }
      } catch (_) {}
    } else {
      clearInterval(fallbackPollingTimer);
      fallbackPollingTimer = null;
    }
  }, 8000);
}

function initWebSockets() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return;
  }
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  if (typeof appendLog === 'function') appendLog('[SYSTEM] Establishing secure WebSocket socket connection...', 'system');

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    if (fallbackPollingTimer) {
      clearInterval(fallbackPollingTimer);
      fallbackPollingTimer = null;
    }
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

        if (payload.data.activeDate) {
          if (graphState) graphState.activeDate = payload.data.activeDate;
          const dp = document.getElementById('schedule-date-picker');
          if (dp) {
            dp.value = payload.data.activeDate;
            dp.min = payload.data.activeDate;
          }
        }

        if (payload.data.autopilotEnabled !== undefined && typeof window.setAutopilotMode === 'function') {
          window.setAutopilotMode(payload.data.autopilotEnabled);
        }

        safeSyncUI(selectedNodeId);
        if (typeof window.syncAdminDashboard === 'function') {
          window.syncAdminDashboard(payload.data);
        }
        break;

      case 'AUTOPILOT_STATUS_UPDATE':
        if (typeof window.setAutopilotMode === 'function') {
          window.setAutopilotMode(payload.data.autopilotEnabled);
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
        const isAutopilot = (typeof window.isAutopilotEnabled === 'function')
          ? window.isAutopilotEnabled()
          : (payload.data.autopilotEnabled !== false);

        if (hasConflict) {
          const conflictLog = payload.data.logs ? payload.data.logs.find(l => l.includes('[CONFLICT]') || l.includes('exceeds') || l.includes('Capacity')) : null;
          const actionLog = payload.data.logs ? payload.data.logs.find(l => l.includes('[Action') || l.includes('moved to') || l.includes('Relocating') || l.includes('Scheduled') || l.includes('Solver')) : null;

          const conflictText = payload.data.conflictReason || (conflictLog ? conflictLog.replace(/\[.*?\]/g, '').trim() : '⚠️ Self-Healing Triggered: Operational constraint violation detected.');
          const destText = payload.data.destinationTarget || (actionLog ? actionLog.replace(/\[.*?\]/g, '').trim() : '📍 Optimization Solver reallocating talk node to viable venue position.');

          if (isAutopilot) {
            // --- TESLA AUTONOMOUS AUTOPILOT MODE (Zero-Touch Instant Application) ---
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

            if (typeof window.showAutopilotResolutionHUD === 'function') {
              window.showAutopilotResolutionHUD(conflictText, destText);
            } else if (typeof createToast === 'function') {
              createToast(`⚡ AUTOMATED MITIGATION: Conflict resolved automatically! ${destText}`, 'success');
            }

            if (typeof highlightHealedDestination === 'function') {
              highlightHealedDestination(destText, payload.data.schedule);
            }
          } else {
            // --- MANUAL CO-PILOT MODE (Human Coordinator Countdown Confirmation) ---
            if (payload.data.initialSchedule) {
              scheduleState = payload.data.initialSchedule;
              if (typeof renderScheduleGrid === 'function') renderScheduleGrid();
            }

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
              previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
              graphState = payload.data.graph;
              scheduleState = payload.data.schedule;
              safeSyncUI(selectedNodeId);
            }
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

        if (payload.data.activeDate) {
          if (graphState) graphState.activeDate = payload.data.activeDate;
          const dp = document.getElementById('schedule-date-picker');
          if (dp) {
            dp.value = payload.data.activeDate;
            dp.min = payload.data.activeDate;
          }
        }

        safeSyncUI(null);
        if (typeof createToast === 'function') createToast('Conference layout reset to default settings!', 'success');
        break;

      case 'VENUE_SPATIAL_MODEL_UPDATE':
        if (graphState && graphState.halls && payload.data.hallId) {
          if (!graphState.halls[payload.data.hallId]) {
            graphState.halls[payload.data.hallId] = { id: payload.data.hallId, name: payload.data.hallName, capacity: payload.data.capacity };
          }
          graphState.halls[payload.data.hallId].name = payload.data.hallName;
          graphState.halls[payload.data.hallId].capacity = payload.data.capacity;
          graphState.halls[payload.data.hallId].spatialModel = payload.data.spatialModel;
          if (payload.data.cadBlueprint) {
            graphState.halls[payload.data.hallId].cadBlueprint = payload.data.cadBlueprint;
          }
        }
        if (typeof window.handleSpatialModelUpdate === 'function') {
          window.handleSpatialModelUpdate(payload.data);
        }
        if (typeof createToast === 'function') {
          createToast(`🏛️ Spatial Blueprint Synced: "${payload.data.hallName}" capacity updated to ${payload.data.capacity} pax.`, 'info');
        }
        safeSyncUI(selectedNodeId);
        break;

      case 'CAD_BLUEPRINT_UPDATE':
        if (graphState && graphState.halls && payload.data.hallId) {
          if (!graphState.halls[payload.data.hallId]) {
            graphState.halls[payload.data.hallId] = { id: payload.data.hallId, name: payload.data.cadModel?.hallName || 'Turing Hall', capacity: payload.data.capacity };
          }
          graphState.halls[payload.data.hallId].capacity = payload.data.capacity;
          graphState.halls[payload.data.hallId].cadBlueprint = payload.data.cadModel;
        }
        if (typeof window.handleCadBlueprintUpdate === 'function') {
          window.handleCadBlueprintUpdate(payload.data);
        }
        if (typeof createToast === 'function') {
          createToast(`📐 CAD Blueprint Synced: "${payload.data.cadModel?.hallName || payload.data.hallId}" updated.`, 'info');
        }
        safeSyncUI(selectedNodeId);
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

      case 'VOICE_ANNOUNCEMENT':
        if (typeof window.handleVoiceAnnouncement === 'function') {
          window.handleVoiceAnnouncement(payload.data);
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

      case 'VOLUNTEERS_UPDATED':
        if (typeof window.handleVolunteersUpdated === 'function') {
          window.handleVolunteersUpdated(payload.data);
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

      case 'GEMINI_OCCLUSION_ALERT':
        if (typeof window.handleGeminiOcclusionAlert === 'function') {
          window.handleGeminiOcclusionAlert(payload.data);
        }
        if (typeof createToast === 'function') {
          const occText = (payload.data && payload.data.occluded > 0) ? ` (${payload.data.occluded} occluded behind pillars)` : '';
          createToast(`🤖 Autonomous Vision: ${payload.data.hall || 'Venue'} verified at ${payload.data.count || 0} Pax${occText}. Self-healing active!`, 'info');
        }
        break;

      case 'SCENARIO_CHANGED':
        if (payload.data && payload.data.graph) graphState = payload.data.graph;
        safeSyncUI(selectedNodeId);
        const adminScnSelect = document.getElementById('admin-scenario-select');
        if (adminScnSelect && payload.data && payload.data.activeScenario) {
          adminScnSelect.value = payload.data.activeScenario;
        }
        if (typeof window.syncAdminDashboard === 'function' && payload.data) {
          window.syncAdminDashboard(payload.data);
        }
        if (typeof createToast === 'function') {
          createToast(`🌐 Operational Domain Switched: ${payload.data.scenarioName || payload.data.activeScenario}`, 'info');
        }
        break;

      case 'OPERATIONAL_INCIDENT_RESOLVED':
        if (payload.data && payload.data.notifications && payload.data.notifications.length > 0) {
          payload.data.notifications.forEach(n => {
            if (typeof createToast === 'function') createToast(n.message, n.type || 'warning');
          });
        }
        if (payload.data && payload.data.swarmChat && typeof renderSwarmChat === 'function') {
          renderSwarmChat(payload.data.swarmChat);
        }
        break;

      case 'VOLUNTEER_SOS_ALERT': {
        const sosData = payload.data || {};
        if (typeof createToast === 'function') {
          createToast(`🚨 [EMERGENCY SOS] ${sosData.volunteerName || 'Field Marshal'} (${sosData.hallName || 'Hall'}): ${sosData.note || 'Urgent escalation'}`, 'conflict');
        }
        if (typeof appendLog === 'function') {
          appendLog(`[SOS ALERT] 🚨 Field Marshal ${sosData.volunteerName || 'Volunteer'} triggered emergency panic at ${sosData.hallName || 'Venue'}: ${sosData.note || 'Assistance requested'}`, 'conflict');
        }
        if (typeof window.handleVolunteerSosAlert === 'function') {
          window.handleVolunteerSosAlert(sosData);
        }
        const auditBox = document.getElementById('admin-audit-log-container');
        if (auditBox) {
          const line = document.createElement('div');
          line.className = 'admin-audit-line conflict';
          line.textContent = `[${sosData.timestamp || new Date().toLocaleTimeString()}] 🚨 EMERGENCY SOS: ${sosData.volunteerName} (${sosData.hallName}): ${sosData.note}`;
          auditBox.insertBefore(line, auditBox.firstChild);
        }
        break;
      }

      case 'GATE_RELEASE_PULSE': {
        const pulse = payload.data || {};
        if (typeof createToast === 'function') {
          createToast(`🚨 BARRICADE PRESSURE RELIEF: ${pulse.gateName || 'Egress Gate'} at ${pulse.hallName || 'Venue'} surge (${pulse.pressurePsi || 8.5} PSI). Automated latch disengaged!`, 'warning');
        }
        if (typeof appendLog === 'function') {
          appendLog(`[GATE RELIEF PULSE] Automated crowd relief latch triggered at ${pulse.gateName || 'Gate'} (${pulse.pressurePsi || 8.5} PSI) — ${pulse.reason || 'Stampede prevention'}`, 'action');
        }
        if (typeof window.handleGateReleasePulse === 'function') {
          window.handleGateReleasePulse(pulse);
        }
        break;
      }

      case 'VOLUNTEER_OVERFLOW_OPEN': {
        const ofData = payload.data || {};
        if (typeof createToast === 'function') {
          createToast(`🏛️ OVERFLOW ACTIVATED: Secondary zone & broadcast feeds opened by ${ofData.volunteer || 'Operations'}!`, 'info');
        }
        if (typeof appendLog === 'function') {
          appendLog(`[OVERFLOW ACTIVATED] ${ofData.volunteer || 'Operations'}: ${ofData.note || 'Secondary venue capacity online'}`, 'success');
        }
        if (typeof window.handleOverflowOpen === 'function') {
          window.handleOverflowOpen(ofData);
        }
        break;
      }

      case 'VOLUNTEER_ALERT_ACK': {
        const ackData = payload.data || {};
        if (typeof createToast === 'function') {
          createToast(`✅ Chokepoint Cleared: ${ackData.volunteer || 'Marshal'} reported ${ackData.message || 'Nominal flow restored'}`, 'success');
        }
        if (typeof appendLog === 'function') {
          appendLog(`[CHOKEPOINT CLEARED] ${ackData.volunteer || 'Marshal'}: ${ackData.message || 'Door chokepoint cleared'}`, 'success');
        }
        if (typeof window.handleVolunteerAlertAck === 'function') {
          window.handleVolunteerAlertAck(ackData);
        }
        break;
      }

      case 'SUPERVISOR_ACTION_LOGGED': {
        const supData = payload.data || {};
        if (typeof appendLog === 'function') {
          appendLog(`[SUPERVISOR ACTION] ${supData.overriddenBy || 'Supervisor'}: ${supData.decision || 'Action logged'} (${supData.cryptoSignature || 'SHA-256'})`, 'action');
        }
        const auditBox = document.getElementById('admin-audit-log-container');
        if (auditBox) {
          const line = document.createElement('div');
          line.className = 'admin-audit-line success';
          line.textContent = `[${supData.timestamp || new Date().toLocaleTimeString()}] 🛡️ SUPERVISOR ACTION: ${supData.decision} by ${supData.overriddenBy} (${supData.cryptoSignature})`;
          auditBox.insertBefore(line, auditBox.firstChild);
        }
        if (typeof window.handleSupervisorActionLogged === 'function') {
          window.handleSupervisorActionLogged(supData);
        }
        break;
      }

      case 'SWARM_CHAT': {
        if (payload.data) {
          const chatItems = Array.isArray(payload.data) ? payload.data : [payload.data];
          if (typeof renderSwarmChat === 'function') {
            renderSwarmChat(chatItems);
          }
        }
        break;
      }

      case 'TOAST': {
        const toastMsg = payload.data?.message || payload.message;
        const toastType = payload.data?.type || payload.type || 'info';
        if (toastMsg && typeof createToast === 'function') {
          createToast(toastMsg, toastType);
        }
        break;
      }

      case 'GRAPH_UPDATED': {
        previousSchedule = scheduleState ? JSON.parse(JSON.stringify(scheduleState)) : null;
        if (payload.data?.graph) graphState = payload.data.graph;
        if (payload.data?.schedule) scheduleState = payload.data.schedule;
        if (payload.data?.activeDate) {
          if (graphState) graphState.activeDate = payload.data.activeDate;
          const dp = document.getElementById('schedule-date-picker');
          if (dp) {
            dp.value = payload.data.activeDate;
            dp.min = payload.data.activeDate;
          }
        }
        if (payload.data?.logs && typeof appendLog === 'function') {
          payload.data.logs.forEach(log => appendLog(log, 'system'));
        }
        safeSyncUI(selectedNodeId);
        break;
      }

      case 'MESH_MESSAGE':
      case 'CHAT_MESSAGE': {
        if (typeof window.handleMeshMessage === 'function') {
          window.handleMeshMessage(payload.data);
        }
        break;
      }

      case 'GATE_MESH_UPDATE': {
        if (typeof window.handleGateMeshUpdate === 'function') {
          window.handleGateMeshUpdate(payload.data);
        }
        break;
      }

      case 'SYSTEM_LOG': {
        const sysText = payload.data?.text || payload.data?.message || payload.data;
        const sysType = payload.data?.type || 'system';
        if (sysText && typeof appendLog === 'function') {
          appendLog(sysText, sysType);
        }
        break;
      }

      case 'TASK_CREATED':
      case 'TASK_UPDATED': {
        if (typeof window.handleTaskUpdate === 'function') {
          window.handleTaskUpdate(payload.data);
        }
        break;
      }

      case 'VOICE_BROADCAST': {
        if (typeof window.handleVoiceAnnouncement === 'function') {
          window.handleVoiceAnnouncement(payload.data);
        }
        break;
      }

      case 'ROOMS_UPDATE': {
        if (typeof window.handleRoomsUpdate === 'function') {
          window.handleRoomsUpdate(payload.data);
        }
        break;
      }

      case 'BADGE_SCANNED': {
        if (typeof window.handleBadgeScanned === 'function') {
          window.handleBadgeScanned(payload.data);
        }
        break;
      }

      case 'QUICK_ACTION_DISPATCH': {
        if (typeof window.handleQuickActionDispatch === 'function') {
          window.handleQuickActionDispatch(payload.data);
        }
        break;
      }

      case 'PONG': {
        // Live bidirectional WebSocket heartbeat acknowledgement
        break;
      }
    }
  };

  ws.onerror = (err) => {
    updateAgentHealthIndicator('OFFLINE');
    startFallbackPolling();
    if (typeof appendLog === 'function') appendLog('[ERROR] Connection interrupted. Running in fallback offline layout.', 'conflict');
    if (typeof createToast === 'function') createToast('WebSocket connection error. Retrying...', 'warning');
  };

  ws.onclose = () => {
    updateAgentHealthIndicator('OFFLINE');
    startFallbackPolling();
    if (typeof appendLog === 'function') appendLog('[SYSTEM] Connection offline. Offline synchronization active.', 'system');
    if (!wsReconnectTimer) {
      wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null;
        initWebSockets();
      }, 5000);
    }
  };
}

/**
 * Universal client-to-server WebSocket dispatch helper
 */
window.sendWsMessage = function (packet) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(typeof packet === 'string' ? packet : JSON.stringify(packet));
      return true;
    } catch (e) {
      console.warn('[WS Send Error]', e);
    }
  }
  return false;
};
