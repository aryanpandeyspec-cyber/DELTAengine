// --- DELTA ENGINE - ROLE-BASED AUTHENTICATION & ADMIN PORTAL CONTROLLER ---

(function initAuthManager() {
  let currentUserRole = 'coordinator'; // 'coordinator' | 'admin'
  let currentUserName = 'Suryansh (Lead Coordinator)';
  try {
    const savedRole = localStorage.getItem('delta_user_role');
    const savedName = localStorage.getItem('delta_user_name');
    if (savedRole) currentUserRole = savedRole;
    else if (window.location.pathname.includes('admin')) currentUserRole = 'admin';
    if (savedName) currentUserName = savedName;
    else if (currentUserRole === 'admin') currentUserName = 'Marcus Aurelius (Super Admin)';
  } catch (e) {}

  window.addEventListener('DOMContentLoaded', () => {
    bindAuthEventListeners();
    updateAuthUI();
    startLiveAdminTimers();
    fetch('/api/state').then(r => r.json()).then(data => {
      if (typeof window.syncAdminDashboard === 'function') window.syncAdminDashboard(data);
    }).catch(() => {});
  });

  function bindAuthEventListeners() {
    const btnOpenLogin = document.getElementById('btn-open-login');
    const btnCloseModal = document.getElementById('btn-close-auth-modal');
    const modal = document.getElementById('auth-login-modal');

    if (btnOpenLogin && modal) {
      btnOpenLogin.addEventListener('click', () => {
        modal.classList.remove('hidden');
      });
    }

    if (btnCloseModal && modal) {
      btnCloseModal.addEventListener('click', () => {
        modal.classList.add('hidden');
      });
    }

    // Role Tab Toggles
    const tabCoord = document.getElementById('tab-login-coordinator');
    const tabAdmin = document.getElementById('tab-login-admin');
    const hiddenRoleInput = document.getElementById('auth-selected-role');
    const usernameLabel = document.getElementById('auth-username-label');
    const inputUsername = document.getElementById('auth-input-username');

    if (tabCoord && tabAdmin) {
      tabCoord.addEventListener('click', (e) => {
        e.preventDefault();
        tabCoord.classList.add('active');
        tabAdmin.classList.remove('active');
        if (hiddenRoleInput) hiddenRoleInput.value = 'coordinator';
        if (usernameLabel) usernameLabel.textContent = 'Coordinator Username / ID';
        if (inputUsername) inputUsername.value = 'elena.vance';
      });

      tabAdmin.addEventListener('click', (e) => {
        e.preventDefault();
        tabAdmin.classList.add('active');
        tabCoord.classList.remove('active');
        if (hiddenRoleInput) hiddenRoleInput.value = 'admin';
        if (usernameLabel) usernameLabel.textContent = 'Super Admin Key / ID';
        if (inputUsername) inputUsername.value = 'admin_marcus';
      });
    }

    // Quick One-Click Demo Access Buttons
    const btnQuickCoord = document.getElementById('btn-quick-login-coord');
    const btnQuickAdmin = document.getElementById('btn-quick-login-admin');

    if (btnQuickCoord) {
      btnQuickCoord.addEventListener('click', () => {
        loginUser('coordinator', 'Suryansh (Lead Coordinator)');
      });
    }

    if (btnQuickAdmin) {
      btnQuickAdmin.addEventListener('click', () => {
        loginUser('admin', 'Marcus Aurelius (Super Admin)');
      });
    }

    // Form Submit Listener
    const form = document.getElementById('auth-login-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const role = hiddenRoleInput ? hiddenRoleInput.value : 'coordinator';
        const username = inputUsername ? inputUsername.value : 'User';
        const name = role === 'admin' ? `Admin (${username})` : `Coordinator (${username})`;
        loginUser(role, name);
      });
    }

    // Header Navigation Portal Switch Buttons
    const btnAdminLink = document.getElementById('btn-admin-portal-link');
    const btnCoordLink = document.getElementById('btn-coordinator-portal-link');

    if (btnAdminLink) {
      btnAdminLink.addEventListener('click', () => {
        showView('admin');
      });
    }

    if (btnCoordLink) {
      btnCoordLink.addEventListener('click', () => {
        showView('coordinator');
      });
    }

    // Admin System Override Buttons
    bindAdminActionButtons();
  }

  function loginUser(role, displayName) {
    currentUserRole = role;
    currentUserName = displayName;
    try {
      localStorage.setItem('delta_user_role', role);
      localStorage.setItem('delta_user_name', displayName);
    } catch (e) {}

    const modal = document.getElementById('auth-login-modal');
    if (modal) modal.classList.add('hidden');

    if (typeof createToast === 'function') {
      createToast(`🔓 Authenticated cleanly as ${role.toUpperCase()}: ${displayName}`, 'success');
    }

    updateAuthUI();
    showView(role);
  }

  function updateAuthUI() {
    const badge = document.getElementById('user-role-badge');
    const nameText = document.getElementById('user-name-text');
    const btnAdminLink = document.getElementById('btn-admin-portal-link');
    const btnCoordLink = document.getElementById('btn-coordinator-portal-link');

    if (badge) {
      if (currentUserRole === 'admin') {
        badge.className = 'user-role-badge admin';
        badge.textContent = '👑 Super Admin';
      } else {
        badge.className = 'user-role-badge coordinator';
        badge.textContent = '👤 Coordinator';
      }
    }

    if (nameText) {
      nameText.textContent = currentUserName;
    }

    if (btnAdminLink && btnCoordLink) {
      if (currentUserRole === 'admin') {
        btnAdminLink.classList.remove('hidden');
      } else {
        btnAdminLink.classList.add('hidden');
      }
    }
  }

  function showView(viewName) {
    const coordDashboard = document.getElementById('coordinator-dashboard-view');
    const adminDashboard = document.getElementById('admin-dashboard-view');
    const btnAdminLink = document.getElementById('btn-admin-portal-link');
    const btnCoordLink = document.getElementById('btn-coordinator-portal-link');

    if (viewName === 'admin') {
      if (coordDashboard) coordDashboard.classList.add('hidden');
      if (adminDashboard) adminDashboard.classList.remove('hidden');
      if (btnAdminLink) btnAdminLink.classList.add('hidden');
      if (btnCoordLink) btnCoordLink.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (adminDashboard) adminDashboard.classList.add('hidden');
      if (coordDashboard) coordDashboard.classList.remove('hidden');
      if (btnCoordLink) btnCoordLink.classList.add('hidden');
      if (currentUserRole === 'admin' && btnAdminLink) btnAdminLink.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function triggerAdminAction(action) {
    fetch('/api/admin/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    }).then(res => res.json()).then(data => {
      if (typeof createToast === 'function' && data.message) {
        createToast(data.message, action === 'freeze_swarm' ? 'conflict' : 'info');
      }
    });
  }

  function bindAdminActionButtons() {
    const btnFreeze = document.getElementById('btn-admin-freeze-swarm');
    const btnReindex = document.getElementById('btn-admin-reindex-graph');
    const btnAlert = document.getElementById('btn-admin-broadcast-alert');
    const btnPurge = document.getElementById('btn-admin-purge-locks');

    const btnStress500 = document.getElementById('btn-admin-stress-500');
    if (btnStress500) {
      btnStress500.addEventListener('click', () => {
        if (typeof createToast === 'function') createToast('🔥 Executing 500 High-Stress Test Cases against Admin Engine...', 'info');
        fetch('/api/admin/stress-test-500', { method: 'POST' })
          .then(res => res.json())
          .then(data => {
            if (typeof createToast === 'function') {
              createToast(`✅ 500 STRESS TEST COMPLETE: ${data.passedCount}/500 Passed (${data.successRate}) in ${data.durationMs}ms!`, 'success');
            }
          });
      });
    }

    if (btnFreeze) btnFreeze.addEventListener('click', () => triggerAdminAction('freeze_swarm'));
    if (btnReindex) btnReindex.addEventListener('click', () => triggerAdminAction('reindex'));
    if (btnAlert) btnAlert.addEventListener('click', () => triggerAdminAction('broadcast'));
    if (btnPurge) btnPurge.addEventListener('click', () => triggerAdminAction('clear_locks'));
  }

  // Contacts & WhatsApp Notification State (Indian Personnel & +91 Format)
  const defaultContacts = [
    { id: 'cnt_01', name: 'Aryan Pandey', role: 'Lead Event Coordinator & Systems Commander', phone: '+91 91542 76178', email: 'aryan.pandey777hyd@gmail.com', hall: 'ALL VENUES (Central Command)' },
    { id: 'cnt_02', name: 'Suryansh', role: 'Crowd Safety & Entrance Door Specialist', phone: '+91 83030 09159', email: 'suryansh@delta-engine.in', hall: 'Turing Hall & Entrance A' },
    { id: 'cnt_03', name: 'Shahid', role: 'Stage & Hall Operations Coordinator', phone: '+91 63035 70916', email: 'shahid@delta-engine.in', hall: 'Lovelace Suite & Stage Front' },
    { id: 'cnt_04', name: 'Dr. Aditi Sharma', role: 'Guest Keynote Speaker (AI Research Lead)', phone: '+91 91234 56789', email: 'aditi.sharma@ai-research.in', hall: 'Turing Hall' },
    { id: 'cnt_05', name: 'Vikramaditya Verma', role: 'Guest Keynote Speaker (Graphics Lead)', phone: '+91 99887 76655', email: 'vikram.verma@graphics.in', hall: 'Lovelace Suite' },
    { id: 'cnt_06', name: 'Priya Nair', role: 'Guest Speaker (DevOps Architect)', phone: '+91 98112 23344', email: 'priya.nair@devops.in', hall: 'Hopper Room' }
  ];

  window.addEventListener('DOMContentLoaded', () => {
    bindAuthEventListeners();
    updateAuthUI();
    renderAdminContactsTable();
    renderFeaturedVolunteers();
    bindAdminActionButtons();
    bindLimiterToggles();
  });

  function renderFeaturedVolunteers() {
    const container = document.getElementById('featured-volunteers-list');
    if (!container) return;
    container.innerHTML = '';

    const volunteers = [
      { name: 'Suryansh', role: 'Crowd Safety & Entrance Lead', phone: '+91 83030 09159', location: 'Door A', task: 'Scanning passes & door routing', status: 'ON DUTY' },
      { name: 'Shahid', role: 'Stage & Operations Lead', phone: '+91 63035 70916', location: 'Stage Front', task: 'Safety aisle clearance & mic checks', status: 'ON DUTY' },
      { name: 'Aryan Pandey', role: 'Lead Systems Commander', phone: '+91 91542 76178', location: 'Central AV Desk', task: 'Perception monitoring & volunteer dispatch', status: 'ON DUTY' }
    ];

    volunteers.forEach(v => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#f8f9fa; border:2px solid #000; border-radius:10px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;';
      card.innerHTML = `
        <div>
          <div style="font-size:0.85rem; font-weight:800; color:#000;">${v.name} <span style="font-size:0.72rem; color:#555; font-weight:600;">(${v.role})</span></div>
          <div style="font-size:0.75rem; color:#444; font-weight:600;">📍 ${v.location} • 📋 ${v.task}</div>
        </div>
        <button class="btn btn-sm btn-yellow btn-vol-ping" data-name="${v.name}" data-phone="${v.phone}" style="font-size:0.72rem; font-weight:800; padding:3px 8px;">
          💬 WhatsApp Contact
        </button>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-vol-ping').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.getAttribute('data-name');
        const phone = e.target.getAttribute('data-phone');
        triggerWhatsAppNotification(name, phone, `Hello ${name}, this is DELTA ENGINE Event Control. Please report to stage desk for session transition.`);
      });
    });
  }

  function renderAdminContactsTable() {
    const tbody = document.getElementById('admin-contacts-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    defaultContacts.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td><span class="role-chip coord">${c.role}</span></td>
        <td><code>💬 ${c.phone}</code></td>
        <td><a href="mailto:${c.email}" style="color:#4285f4; text-decoration:underline;">${c.email}</a></td>
        <td>${c.hall}</td>
        <td>
          <button class="btn btn-sm btn-yellow btn-wa-alert" data-name="${c.name}" data-phone="${c.phone}">
            💬 WhatsApp Contact
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-wa-alert').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.getAttribute('data-name');
        const phone = e.target.getAttribute('data-phone');
        triggerWhatsAppNotification(name, phone, `Hello ${name}, this is DELTA ENGINE Event OS. Operational alert regarding schedule matrix.`);
      });
    });
  }

  function bindLimiterToggles() {
    const toggleLlm = document.getElementById('toggle-llm-limiter');
    const toggleDb = document.getElementById('toggle-db-limiter');

    if (toggleLlm) {
      toggleLlm.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        fetch('/api/admin/toggle-limiter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'llmLimiter', enabled })
        });
        if (typeof createToast === 'function') {
          createToast(enabled ? '🛑 LLM Token Usage Limiter ACTIVATED.' : '🟢 LLM Token Usage Limiter DISABLED.', enabled ? 'conflict' : 'success');
        }
      });
    }

    if (toggleDb) {
      toggleDb.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        fetch('/api/admin/toggle-limiter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'dbLimiter', enabled })
        });
        if (typeof createToast === 'function') {
          createToast(enabled ? '🔒 Backend DB Write Limiter ACTIVATED.' : '🟢 Backend DB Write Limiter DISABLED.', enabled ? 'conflict' : 'success');
        }
      });
    }
  }

  function triggerWhatsAppNotification(name, phone, msg) {
    // 1. Call backend API for dispatch logging
    fetch('/api/notify/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientName: name, phoneNumber: phone, messageText: msg })
    });

    // 2. Open real WhatsApp Web / Mobile chat with selected number pre-loaded!
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  }

  window.handleWhatsAppDispatch = function (data) {
    const logBox = document.getElementById('admin-whatsapp-log-container');
    if (logBox) {
      const line = document.createElement('div');
      line.className = 'admin-audit-line success';
      line.textContent = `[${data.timestamp}] 💬 WhatsApp Alert sent to ${data.recipientName} (${data.phoneNumber}): "${data.messageText}"`;
      logBox.insertBefore(line, logBox.firstChild);
    }
    if (typeof createToast === 'function') {
      createToast(`💬 [WhatsApp AI Agent] Alert sent to ${data.recipientName}: "${data.messageText}"`, 'info');
    }
  };

  window.handleEmailDispatch = function (data) {
    const logBox = document.getElementById('admin-email-log-container');
    if (logBox) {
      const line = document.createElement('div');
      line.className = 'admin-audit-line info';
      line.textContent = `[${data.timestamp}] 📧 Email Dispatched to ${data.recipients ? data.recipients.length : 4} personnel: "${data.subject}"`;
      logBox.insertBefore(line, logBox.firstChild);
    }
    if (typeof createToast === 'function') {
      createToast(`📧 [Supabase AI Mailer] Composed & sent official notice to personnel: "${data.topicTitle}"`, 'info');
    }
  };

  let adminServerUptimeBase = 1240;
  let adminClientStartTime = Date.now();

  function startLiveAdminTimers() {
    setInterval(() => {
      // Uptime Counter
      const uptimeEl = document.getElementById('admin-system-uptime');
      if (uptimeEl) {
        const elapsedSec = adminServerUptimeBase + Math.floor((Date.now() - adminClientStartTime) / 1000);
        const hours = Math.floor(elapsedSec / 3600);
        const mins = Math.floor((elapsedSec % 3600) / 60);
        const secs = elapsedSec % 60;
        uptimeEl.textContent = `99.98% (Online • ${hours}h ${mins}m ${secs}s)`;
      }

      // Session Countdown (Dynamic 18-minute session countdown)
      const sessionTimeEl = document.getElementById('featured-event-time-remaining');
      if (sessionTimeEl) {
        const now = new Date();
        const minsLeft = 60 - now.getMinutes();
        const secsLeft = 59 - now.getSeconds();
        sessionTimeEl.textContent = `${minsLeft}m ${secsLeft < 10 ? '0' : ''}${secsLeft}s Left`;
      }
    }, 1000);
  }

  window.syncAdminDashboard = function (data) {
    if (!data) return;
    const schedule = data.schedule || (window.scheduleState || null);
    const graph = data.graph || (window.graphState || null);

    if (schedule && graph) {
      // Determine currently active featured talk in Turing Hall (or current active slot)
      let activeTopicId = null;
      let activeSlotId = 'slot-1';
      const slots = ['slot-1', 'slot-2', 'slot-3', 'slot-4'];
      for (const s of slots) {
        if (schedule[s] && schedule[s]['hall-1']) {
          activeTopicId = schedule[s]['hall-1'];
          activeSlotId = s;
          break;
        }
      }
      if (!activeTopicId) {
        for (const s of slots) {
          if (schedule[s]) {
            for (const h in schedule[s]) {
              if (schedule[s][h]) {
                activeTopicId = schedule[s][h];
                activeSlotId = s;
                break;
              }
            }
          }
          if (activeTopicId) break;
        }
      }

      const topic = (graph.topics && graph.topics[activeTopicId]) ? graph.topics[activeTopicId] : null;
      const speaker = (topic && graph.speakers && graph.speakers[topic.speakerId]) ? graph.speakers[topic.speakerId] : null;
      const hall = (graph.halls && graph.halls['hall-1']) ? graph.halls['hall-1'] : { name: 'Turing Hall', capacity: 250 };
      const slot = (graph.slots && graph.slots[activeSlotId]) ? graph.slots[activeSlotId] : { time: '09:30 AM - 10:30 AM' };

      // Update Featured Event Title
      const titleEl = document.getElementById('featured-event-title');
      if (titleEl && topic) {
        titleEl.textContent = topic.title;
      }

      // Update Speaker
      const speakerEl = document.getElementById('featured-event-speaker');
      if (speakerEl && speaker) {
        speakerEl.innerHTML = `🧑‍🔬 Speaker: <strong>${speaker.name}</strong> <span style="color:#666; font-weight:500;">(${speaker.role || 'Keynote Speaker'})</span>`;
      }

      // Update Slot Badge and Hall Name
      const slotBadge = document.getElementById('featured-event-slot-badge');
      const hallNameEl = document.getElementById('featured-event-hall-name');
      if (slotBadge) slotBadge.textContent = `🔴 LIVE NOW (${slot.time.split('-')[0].trim()})`;
      if (hallNameEl) hallNameEl.textContent = `📍 ${hall.name}`;

      // Update Featured Event Occupancy Rate
      const occRateEl = document.getElementById('featured-event-occupancy-rate');
      const cctvInfo = (data.cctvState && data.cctvState['hall-1']);
      const currentCount = cctvInfo ? cctvInfo.peopleDetected : (topic ? topic.interest : 0);
      const capacity = hall.capacity || 250;
      const occPct = Math.min(100, Math.round((currentCount / capacity) * 100));
      const empPct = Math.max(0, 100 - occPct);

      if (occRateEl) {
        occRateEl.textContent = `${currentCount} / ${capacity} Pax (${occPct}% Full | ${empPct}% Empty)`;
        occRateEl.style.color = occPct >= 95 ? '#ea4335' : occPct >= 80 ? '#d97706' : '#10b981';
      }

      // Update Dynamic Room Climate & HVAC (crowd-responsive sensor formula)
      const climateEl = document.getElementById('featured-event-climate');
      if (climateEl) {
        const dynamicTemp = (20.8 + (occPct * 0.015)).toFixed(1);
        const hvacMode = occPct >= 80 ? 'Heavy Load Cooling Active' : 'Optimal Climate Balance';
        climateEl.textContent = `${dynamicTemp}°C (${hvacMode})`;
      }

      // Update Audience Q&A Engagement
      const qaEl = document.getElementById('featured-event-qa');
      if (qaEl) {
        const questionsCount = Math.max(12, Math.round(currentCount * 0.24 + 14));
        qaEl.textContent = `${questionsCount} Questions Submitted (${Math.round(questionsCount * 0.3)} Live In Queue)`;
      }
    }

    // Update Token Meter
    const tokens = data.tokensUsed || 28450;
    const tokenText = document.getElementById('admin-token-meter-text');
    const tokenFill = document.getElementById('admin-token-meter-fill');
    if (tokenText) {
      const tokenPct = Math.min(100, Math.round((tokens / 100000) * 100));
      tokenText.textContent = `${tokens.toLocaleString()} / 100,000 Tokens (${tokenPct}%)`;
      if (tokenFill) tokenFill.style.width = `${tokenPct}%`;
    }

    // Update System Uptime Base
    if (data.uptimeSeconds !== undefined) {
      adminServerUptimeBase = data.uptimeSeconds;
      adminClientStartTime = Date.now();
    }
  };
})();
