// --- DELTA ENGINE - ROLE-BASED AUTHENTICATION & ADMIN PORTAL CONTROLLER ---

(function initAuthManager() {
  let currentUserRole = 'coordinator'; // 'coordinator' | 'admin'
  let currentUserName = 'Elena Vance';

  window.addEventListener('DOMContentLoaded', () => {
    bindAuthEventListeners();
    updateAuthUI();
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
        loginUser('coordinator', 'Elena Vance (Lead Coordinator)');
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
    { id: 'cnt_01', name: 'Ananya Roy', role: 'Lead Event Coordinator', phone: '+91 98765 43210', email: 'ananya.roy@delta-engine.in', hall: 'Turing Hall & Lovelace Suite' },
    { id: 'cnt_02', name: 'Dr. Aditi Sharma', role: 'AI Keynote Speaker & Research Lead', phone: '+91 91234 56789', email: 'aditi.sharma@ai-research.in', hall: 'Turing Hall' },
    { id: 'cnt_03', name: 'Vikramaditya Verma', role: 'WebGPU Speaker & Graphics Lead', phone: '+91 99887 76655', email: 'vikram.verma@graphics.in', hall: 'Lovelace Suite' },
    { id: 'cnt_04', name: 'Priya Nair', role: 'DevOps Speaker & Cloud Lead', phone: '+91 98112 23344', email: 'priya.nair@devops.in', hall: 'Hopper Room' },
    { id: 'cnt_05', name: 'Arjun Mehta', role: 'Super Admin & Infrastructure Director', phone: '+91 98990 01122', email: 'arjun.mehta@delta-engine.in', hall: 'ALL VENUES (Root)' },
    { id: 'cnt_06', name: 'Rohan Kulkarni', role: 'AV Systems & Facility Stage Lead', phone: '+91 97112 24455', email: 'rohan.kulkarni@venue-av.in', hall: 'All Venue Halls' }
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
      { name: 'Rohan Sharma', role: 'Lead Stage Volunteer', phone: '+91 98761 23456', location: 'Stage Front', task: 'Mic & Clicker Check', status: 'ON DUTY' },
      { name: 'Priya Patel', role: 'Crowd & Entrance Lead', phone: '+91 98123 45678', location: 'Door A', task: 'Scanning QR Badges', status: 'ON DUTY' },
      { name: 'Aarav Mehta', role: 'Q&A Mic Runner', phone: '+91 99001 12233', location: 'Aisle 2', task: 'Audience Mic Pass', status: 'ACTIVE' },
      { name: 'Ananya Sen', role: 'AV & Stream Lead', phone: '+91 97890 12345', location: 'AV Desk', task: '4K Stream Check', status: 'ON DUTY' }
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

  window.handleWhatsAppDispatch = function(data) {
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

  window.handleEmailDispatch = function(data) {
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
})();
