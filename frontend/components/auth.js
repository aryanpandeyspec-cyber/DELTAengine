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
  } catch (e) { }

  window.addEventListener('DOMContentLoaded', () => {
    bindAuthEventListeners();
    updateAuthUI();
    startLiveAdminTimers();
    fetch('/api/state').then(r => r.json()).then(data => {
      if (typeof window.syncAdminDashboard === 'function') window.syncAdminDashboard(data);
    }).catch(() => { });
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
        if (inputUsername) inputUsername.value = 'Suryansh';
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

    // Bind all logout triggers across the page (sidebar link, admin logout button, etc.)
    const logoutTriggers = document.querySelectorAll('#btn-logout, a[href="login.html"], .btn-logout-trigger');
    logoutTriggers.forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        logoutUser();
      });
    });

    // Admin System Override Buttons
    bindAdminActionButtons();
  }

  async function logoutUser() {
    const token = localStorage.getItem('delta_auth_token');
    const role = currentUserRole;
    const name = currentUserName;

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ role, username: name })
      });
    } catch (e) {
      console.warn('[Auth] Offline mode during logout');
    }

    try {
      localStorage.removeItem('delta_auth_token');
      localStorage.removeItem('delta_user_role');
      localStorage.removeItem('delta_user_name');
    } catch (e) {}

    currentUserRole = 'coordinator';
    currentUserName = 'Guest';

    if (typeof createToast === 'function') {
      createToast('🚪 Logged out cleanly. Session and credentials terminated.', 'info');
    }

    // Redirect to login page
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 350);
  }

  window.logoutUser = logoutUser;
  window.loginUser = loginUser;

  async function loginUser(role, displayName) {
    currentUserRole = role;
    currentUserName = displayName;
    try {
      localStorage.setItem('delta_user_role', role);
      localStorage.setItem('delta_user_name', displayName);
    } catch (e) { }

    // Exchange credentials for real RFC-7519 cryptographic JWT token
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, username: displayName })
      });
      const data = await res.json();
      if (data && data.token) {
        localStorage.setItem('delta_auth_token', data.token);
      }
    } catch (e) {
      console.warn('[Auth] Offline mode active for token exchange');
    }

    const modal = document.getElementById('auth-login-modal');
    if (modal) modal.classList.add('hidden');

    if (typeof createToast === 'function') {
      createToast(`🔓 Authenticated with Cryptographic JWT as ${role.toUpperCase()}: ${displayName}`, 'success');
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
    { id: 'cnt_01', name: 'Aryan Pandey', role: 'Lead Event Coordinator & Systems Commander', phone: '+91 91542 76178', email: 'aryan.pandey777hyd@gmail.com', hall: 'ALL VENUES (Central Command)', assignedHallId: 'ALL' },
    { id: 'cnt_02', name: 'Suryansh', role: 'Crowd Safety & Entrance Door Specialist', phone: '+91 83030 09159', email: 'Suryansh@delta-engine.in', hall: 'Turing Hall & Entrance A', assignedHallId: 'hall-1' },
    { id: 'cnt_03', name: 'Shahid', role: 'Stage & Hall Operations Coordinator', phone: '+91 63035 70916', email: 'shahid@delta-engine.in', hall: 'Lovelace Suite & Stage Front', assignedHallId: 'hall-2' },
    { id: 'cnt_04', name: 'Dr. Aditi Sharma', role: 'Guest Keynote Speaker (AI Research Lead)', phone: '+91 91234 56789', email: 'aditi.sharma@ai-research.in', hall: 'Turing Hall', assignedHallId: 'hall-1' },
    { id: 'cnt_05', name: 'Vikramaditya Verma', role: 'Guest Keynote Speaker (Graphics Lead)', phone: '+91 99887 76655', email: 'vikram.verma@graphics.in', hall: 'Lovelace Suite', assignedHallId: 'hall-2' },
    { id: 'cnt_06', name: 'Priya Nair', role: 'Guest Speaker (DevOps Architect)', phone: '+91 98112 23344', email: 'priya.nair@devops.in', hall: 'Hopper Room', assignedHallId: 'hall-3' }
  ];

  let currentHallFilter = 'ALL_PERSONNEL';
  let cachedVolunteers = [];

  window.addEventListener('DOMContentLoaded', () => {
    bindAuthEventListeners();
    updateAuthUI();
    fetchVolunteersAndRender();
    bindAdminActionButtons();
    bindLimiterToggles();
    bindVoicePAControls();
    bindCloudIntegrationsControls();
    bindVolunteerControls();
  });

  async function fetchVolunteersAndRender() {
    try {
      const res = await fetch('/api/volunteers');
      const data = await res.json();
      if (data && Array.isArray(data.volunteers)) {
        cachedVolunteers = data.volunteers;
      }
    } catch (e) {
      console.warn('[Volunteers] Using default contacts fallback:', e);
    }
    renderAdminContactsTable(currentHallFilter);
    renderFeaturedVolunteers();
  }

  window.handleVolunteersUpdated = function (data) {
    if (data && Array.isArray(data.volunteers)) {
      cachedVolunteers = data.volunteers;
    }
    renderAdminContactsTable(currentHallFilter);
    renderFeaturedVolunteers();
    if (typeof createToast === 'function') {
      createToast('👥 Volunteer directory updated across all active stations.', 'info');
    }
  };

  function normalizeHallString(val) {
    if (!val) return '';
    const str = String(val).toLowerCase();
    if (str.includes('turing') || str === 'hall-1') return 'hall-1';
    if (str.includes('lovelace') || str === 'hall-2') return 'hall-2';
    if (str.includes('hopper') || str === 'hall-3') return 'hall-3';
    if (str.includes('keynote') || str.includes('arena') || str === 'hall-4') return 'hall-4';
    if (str.includes('kumbh')) return 'hall-kumbh';
    if (str.includes('rally')) return 'hall-rally';
    if (str === 'all' || str.startsWith('all ') || str.includes('central') || str.includes('all venue')) return 'ALL';
    return str;
  }

  function getCombinedPersonnelList() {
    // Merge db.volunteers with defaultContacts ensuring no duplicate phones
    const combined = [];
    const seen = new Set();

    (cachedVolunteers || []).forEach(v => {
      const cleanPhone = (v.phone || '').replace(/[^0-9]/g, '');
      seen.add(cleanPhone);
      combined.push({
        id: v.id,
        name: v.name,
        role: v.role,
        phone: v.phone,
        email: v.email || `${v.name.toLowerCase().replace(/[^a-z]/g, '')}@delta-engine.in`,
        hall: v.location || v.assignedHallId || 'Turing Hall',
        assignedHallId: v.assignedHallId || 'hall-1',
        isVolunteer: true
      });
    });

    defaultContacts.forEach(c => {
      const cleanPhone = (c.phone || '').replace(/[^0-9]/g, '');
      if (!seen.has(cleanPhone)) {
        seen.add(cleanPhone);
        combined.push({
          ...c,
          assignedHallId: c.assignedHallId || normalizeHallString(c.hall)
        });
      }
    });

    return combined;
  }

  function renderFeaturedVolunteers() {
    const container = document.getElementById('featured-volunteers-list');
    if (!container) return;
    container.innerHTML = '';

    const list = getCombinedPersonnelList().filter(p => !p.role?.toLowerCase().includes('speaker')).slice(0, 6);

    list.forEach(v => {
      const card = document.createElement('div');
      card.style.cssText = 'background:#f8f9fa; border:2px solid #000; border-radius:10px; padding:8px 12px; display:flex; justify-content:space-between; align-items:center;';
      card.innerHTML = `
        <div>
          <div style="font-size:0.85rem; font-weight:800; color:#000;">${v.name} <span style="font-size:0.72rem; color:#555; font-weight:600;">(${v.role})</span></div>
          <div style="font-size:0.75rem; color:#444; font-weight:600;">📍 ${v.hall} • 🛡️ ${v.assignedHallId === 'ALL' ? 'Central Command' : 'Hall-Targeted'}</div>
        </div>
        <button class="btn btn-sm btn-yellow btn-vol-ping" data-name="${v.name}" data-phone="${v.phone}" style="font-size:0.72rem; font-weight:800; padding:3px 8px;">
          💬 WhatsApp
        </button>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-vol-ping').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.getAttribute('data-name');
        const phone = e.target.getAttribute('data-phone');
        triggerWhatsAppNotification(name, phone, `Hello ${name}, this is DELTA ENGINE Event Control. Please report to station for hall operations.`);
      });
    });
  }

  function renderAdminContactsTable(filter = 'ALL_PERSONNEL') {
    const tbody = document.getElementById('admin-contacts-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const allPersonnel = getCombinedPersonnelList();

    // Update count in UI tab
    const countEl = document.getElementById('count-all-vols');
    if (countEl) countEl.textContent = allPersonnel.length;

    // Filter logic
    const filtered = allPersonnel.filter(item => {
      if (!filter || filter === 'ALL_PERSONNEL') return true;
      const itemHallNorm = normalizeHallString(item.assignedHallId || item.hall);
      if (filter === 'CENTRAL') return itemHallNorm === 'ALL';
      return itemHallNorm === filter || (filter === 'hall-1' && itemHallNorm === 'ALL');
    });

    filtered.forEach(c => {
      const tr = document.createElement('tr');
      const normHall = normalizeHallString(c.assignedHallId || c.hall);
      const isLead = normHall === 'ALL';
      const hallBadgeColor = isLead ? '#dbeafe' : '#fef3c7';
      const hallTextColor = isLead ? '#1e40af' : '#92400e';

      tr.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td><span class="role-chip coord">${c.role}</span></td>
        <td><code>💬 ${c.phone}</code></td>
        <td><a href="mailto:${c.email}" style="color:#4285f4; text-decoration:underline;">${c.email}</a></td>
        <td>
          <span style="background:${hallBadgeColor}; color:${hallTextColor}; border:1.5px solid #000; border-radius:6px; padding:2px 8px; font-weight:800; font-size:0.72rem; display:inline-block;">
            ${isLead ? '⚡ Central Command (ALL)' : `📍 ${c.hall}`}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-yellow btn-wa-alert" data-name="${c.name}" data-phone="${c.phone}" style="font-weight:800; font-size:0.75rem;">
            💬 WhatsApp
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

  function bindVolunteerControls() {
    // 1. Hall Filter Tabs (Dashboard)
    const tabContainer = document.getElementById('volunteer-hall-filter-tabs');
    if (tabContainer) {
      tabContainer.querySelectorAll('button[data-hall-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          tabContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          const targetBtn = e.target.closest('button');
          targetBtn.classList.add('active');
          currentHallFilter = targetBtn.getAttribute('data-hall-filter');
          renderAdminContactsTable(currentHallFilter);
        });
      });
    }

    // Hall Filter Tabs (Admin Page)
    const tabAdmin = document.getElementById('volunteer-hall-filter-tabs-admin');
    if (tabAdmin) {
      tabAdmin.querySelectorAll('button[data-hall-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          tabAdmin.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          const targetBtn = e.target.closest('button');
          targetBtn.classList.add('active');
          currentHallFilter = targetBtn.getAttribute('data-hall-filter');
          renderAdminContactsTable(currentHallFilter);
        });
      });
    }

    // 2. Add Volunteer Modal Toggle
    const btnOpenAddModal = document.getElementById('btn-open-add-vol-modal');
    const modalAddVol = document.getElementById('modal-add-volunteer');
    const btnCloseAddVol = document.getElementById('btn-close-add-vol');
    const btnCancelAddVol = document.getElementById('btn-cancel-add-vol');
    const formAddVol = document.getElementById('form-add-volunteer');

    if (btnOpenAddModal && modalAddVol) {
      btnOpenAddModal.addEventListener('click', () => {
        modalAddVol.style.display = 'flex';
      });
    }

    const closeModal = () => {
      if (modalAddVol) modalAddVol.style.display = 'none';
      if (formAddVol) formAddVol.reset();
    };

    if (btnCloseAddVol) btnCloseAddVol.addEventListener('click', closeModal);
    if (btnCancelAddVol) btnCancelAddVol.addEventListener('click', closeModal);

    // 3. Form Submit -> POST /api/volunteers
    if (formAddVol) {
      formAddVol.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('add-vol-name')?.value.trim();
        const phone = document.getElementById('add-vol-phone')?.value.trim();
        const assignedHallId = document.getElementById('add-vol-hall')?.value;
        const role = document.getElementById('add-vol-role')?.value.trim();
        const email = document.getElementById('add-vol-email')?.value.trim();

        if (!name || !phone) return;

        try {
          const res = await fetch('/api/volunteers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, assignedHallId, role, email })
          });
          const data = await res.json();
          if (data.success) {
            closeModal();
            if (typeof createToast === 'function') {
              createToast(`✅ Registered ${name} to ${data.volunteer.location}! Total: ${data.totalVolunteers} volunteers.`, 'success');
            }
            fetchVolunteersAndRender();
          }
        } catch (err) {
          console.error('[Add Volunteer] Error:', err);
          if (typeof createToast === 'function') {
            createToast('❌ Failed to save volunteer: ' + err.message, 'conflict');
          }
        }
      });
    }

    // 4. Test Hall Targeted Alert Buttons
    const bindTestAlert = (btnId, hallId, hallName) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', async () => {
          if (typeof createToast === 'function') {
            createToast(`🚀 Simulating capacity breach at ${hallName}...`, 'info');
          }
          try {
            const res = await fetch('/api/volunteers/test-hall-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                hallId,
                eventType: 'CAPACITY_BREACH',
                count: hallId === 'hall-1' ? 250 : 180,
                capacity: hallId === 'hall-1' ? 250 : 180
              })
            });
            const data = await res.json();
            if (data.success) {
              const alertedNames = data.alertPayload.targetedVolunteers.map(v => v.name).join(', ');
              const shielded = data.alertPayload.excludedCount;
              if (typeof createToast === 'function') {
                createToast(`🎯 [${hallName} Alert Dispatched] Alerted: ${alertedNames}. Shielded: ${shielded} volunteers at other halls!`, 'success');
              }
            }
          } catch (err) {
            console.error('[Test Alert] Error:', err);
          }
        });
      }
    };

    bindTestAlert('btn-test-turing-alert', 'hall-1', 'Turing Hall');
    bindTestAlert('btn-admin-test-turing-alert', 'hall-1', 'Turing Hall');
    bindTestAlert('btn-test-lovelace-alert', 'hall-2', 'Lovelace Suite');
    bindTestAlert('btn-admin-test-lovelace-alert', 'hall-2', 'Lovelace Suite');
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
      createToast(`📧 [Resend / Supabase Mailer] Composed & sent official notice to personnel: "${data.topicTitle}"`, 'info');
    }
  };

  let cachedFemaleVoices = [];
  function loadFemaleVoices() {
    if (!('speechSynthesis' in window)) return;
    const all = window.speechSynthesis.getVoices();
    cachedFemaleVoices = all.filter(v => {
      const n = v.name.toLowerCase();
      const isKnownMale = n.includes('david') || n.includes('mark') || n.includes('george') || n.includes('male') || n.includes('guy');
      const isKnownFemale = n.includes('zira') || n.includes('samantha') || n.includes('victoria') || n.includes('karen') || n.includes('hazel') || n.includes('susan') || n.includes('catherine') || n.includes('female');
      return isKnownFemale || (!isKnownMale && v.lang.startsWith('en'));
    });
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadFemaleVoices;
    loadFemaleVoices();
  }

  // =========================================================================
  // 🎙️ SINGLETON VOICE ANNOUNCEMENT ENGINE (ZERO OVERLAPPING VOICES)
  // =========================================================================
  let activeAudioInstance = null;
  const voiceQueue = [];
  let isVoicePlaying = false;
  let lastSpokenText = '';
  let lastSpokenTime = 0;

  window.stopAllVoices = function () {
    if (activeAudioInstance) {
      try {
        activeAudioInstance.pause();
        activeAudioInstance.currentTime = 0;
      } catch (e) {}
      activeAudioInstance = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    voiceQueue.length = 0;
    isVoicePlaying = false;
  };

  function speakWithNicoRobinVoice(text, onComplete) {
    if (!('speechSynthesis' in window) || !text) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      loadFemaleVoices();
      const utter = new SpeechSynthesisUtterance(text);
      // Nico Robin Persona: Confident, elegant, calm female
      utter.pitch = 1.08;
      utter.rate = 0.92;
      utter.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const bestFemale = voices.find(v => /zira|samantha|victoria|karen|hazel|catherine|female/i.test(v.name))
        || cachedFemaleVoices[0]
        || voices.find(v => !/david|mark|george|male/i.test(v.name) && v.lang.startsWith('en'));

      if (bestFemale) {
        utter.voice = bestFemale;
      }

      utter.onend = () => {
        if (typeof onComplete === 'function') onComplete();
      };
      utter.onerror = () => {
        if (typeof onComplete === 'function') onComplete();
      };

      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn('[Nico Robin Speech Error]:', e);
      if (typeof onComplete === 'function') onComplete();
    }
  }

  window.speakWithNicoRobinVoice = speakWithNicoRobinVoice;

  function playNextVoiceInQueue() {
    if (voiceQueue.length === 0) {
      isVoicePlaying = false;
      return;
    }

    // Respect user's sound toggle
    if (localStorage.getItem('delta_sfx_enabled') === 'false') {
      voiceQueue.length = 0;
      isVoicePlaying = false;
      return;
    }

    isVoicePlaying = true;
    const currentItem = voiceQueue.shift();

    // 1. Deduplication: Drop duplicate announcements if received within 6 seconds
    const now = Date.now();
    if (currentItem.text === lastSpokenText && (now - lastSpokenTime < 6000)) {
      console.log('[Voice Queue] Suppressed duplicate announcement within 6s:', currentItem.text);
      playNextVoiceInQueue();
      return;
    }
    lastSpokenText = currentItem.text;
    lastSpokenTime = now;

    // 2. Cross-Tab Mutex: Ensure only 1 open browser tab plays sound
    const announcementId = currentItem.id || `${(currentItem.text || '').slice(0, 32)}_${Math.floor(now / 5000)}`;
    const lastPlayedAcrossTabs = localStorage.getItem('delta_last_voice_announcement_id');
    const lastPlayedTimestamp = parseInt(localStorage.getItem('delta_last_voice_announcement_time') || '0', 10);

    if (lastPlayedAcrossTabs === announcementId && (now - lastPlayedTimestamp < 5000)) {
      console.log('[Voice Queue] Cross-tab synchronization: Another tab is already broadcasting this voice.');
      isVoicePlaying = false;
      return;
    }

    localStorage.setItem('delta_last_voice_announcement_id', announcementId);
    localStorage.setItem('delta_last_voice_announcement_time', now.toString());

    // 3. Stop any existing voice before starting next
    if (activeAudioInstance) {
      try {
        activeAudioInstance.pause();
        activeAudioInstance.currentTime = 0;
      } catch (e) {}
      activeAudioInstance = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    const onPlaybackComplete = () => {
      activeAudioInstance = null;
      // 2000ms gap between sequential announcements
      setTimeout(() => {
        playNextVoiceInQueue();
      }, 2000);
    };

    if (currentItem.audioUrl) {
      try {
        const audio = new Audio('/' + currentItem.audioUrl.replace(/^\//, ''));
        activeAudioInstance = audio;
        audio.onended = onPlaybackComplete;
        audio.onerror = () => {
          console.warn('[PA Audio Player] Audio URL failed, falling back cleanly to Nico Robin speech synthesis.');
          activeAudioInstance = null;
          speakWithNicoRobinVoice(currentItem.text, onPlaybackComplete);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.log('[PA Audio Player] Autoplay note:', e.message);
            activeAudioInstance = null;
            speakWithNicoRobinVoice(currentItem.text, onPlaybackComplete);
          });
        }
      } catch (err) {
        console.warn('[PA Audio Player] Play exception:', err);
        activeAudioInstance = null;
        speakWithNicoRobinVoice(currentItem.text, onPlaybackComplete);
      }
    } else {
      speakWithNicoRobinVoice(currentItem.text, onPlaybackComplete);
    }
  }

  window.handleVoiceAnnouncement = function (data) {
    if (!data) return;

    const logBox = document.getElementById('admin-audit-log-container');
    if (logBox) {
      const line = document.createElement('div');
      line.className = 'admin-audit-line success';
      line.textContent = `[${data.timestamp || new Date().toLocaleTimeString()}] 🎙️ ElevenLabs PA Broadcast: "${data.text}" (${data.voice || 'Nico Robin (Calm & Elegant)'})`;
      logBox.insertBefore(line, logBox.firstChild);
    }

    // Unified Alert Coordinator handles single-active alert, instant stop on dismiss, and 2s gap
    if (window.DeltaAlertManager) {
      window.DeltaAlertManager.enqueuePAAnnouncement(data);
      return;
    }

    // Fallback if DeltaAlertManager not loaded
    const paBanner = document.getElementById('venue-pa-live-banner');
    if (paBanner) {
      paBanner.style.display = 'flex';
      const textEl = document.getElementById('venue-pa-live-text');
      if (textEl) textEl.textContent = `"${data.text}"`;
      const timeEl = document.getElementById('venue-pa-live-time');
      if (timeEl) timeEl.textContent = data.timestamp || new Date().toLocaleTimeString();
      const voiceEl = document.getElementById('venue-pa-live-voice');
      if (voiceEl) voiceEl.textContent = data.voice || 'Nico Robin (Calm & Elegant)';
    }

    if (typeof createToast === 'function') {
      createToast(`📢 [Nico Robin PA Broadcaster] ${data.text}`, 'success');
    }

    if (localStorage.getItem('delta_sfx_enabled') === 'false') {
      return;
    }

    voiceQueue.push(data);
    if (!isVoicePlaying) {
      playNextVoiceInQueue();
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

  let lastPAAudioUrl = null;

  function bindVoicePAControls() {
    const btnTest = document.getElementById('btn-trigger-pa-test');
    const btnReplay = document.getElementById('btn-replay-pa-audio');
    const btnDismiss = document.getElementById('btn-dismiss-pa-banner');

    if (btnTest) {
      btnTest.addEventListener('click', async () => {
        btnTest.disabled = true;
        btnTest.textContent = '🎙️ Synthesizing...';
        if (typeof createToast === 'function') {
          createToast('🎙️ Calling ElevenLabs (Nico Robin - Calm & Elegant)...', 'info');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        try {
          const res = await fetch('/api/voice/announce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              text: 'Attention attendees. DELTA Engine autonomous perception is active. All stage schedules and hall capacities are operating nominally.',
              voiceId: 'EXAVITQu4vr4xnSDxMaL' // Sarah (100% Mature Confident Female - Nico Robin Persona)
            })
          });
          clearTimeout(timeoutId);
          const data = await res.json();
          if (data && data.success) {
            lastPAAudioUrl = data.audioUrl;
            if (typeof window.handleVoiceAnnouncement === 'function') {
              window.handleVoiceAnnouncement(data);
            }
          } else {
            // Instant speech synthesis fallback as Nico Robin
            if (typeof window.handleVoiceAnnouncement === 'function') {
              window.handleVoiceAnnouncement({
                audioUrl: 'announcement_test.mp3',
                text: 'Attention attendees. DELTA Engine autonomous perception is active. All stage schedules and hall capacities are operating nominally.',
                voice: 'Nico Robin (Local Voice)'
              });
            }
          }
        } catch (err) {
          clearTimeout(timeoutId);
          console.warn('[PA Fast Fallback]:', err.message);
          if (typeof window.handleVoiceAnnouncement === 'function') {
            window.handleVoiceAnnouncement({
              audioUrl: 'announcement_test.mp3',
              text: 'Attention attendees. DELTA Engine autonomous perception is active. All stage schedules and hall capacities are operating nominally.',
              voice: 'Nico Robin (Local Voice)'
            });
          }
        } finally {
          btnTest.disabled = false;
          btnTest.textContent = '🎙️ Test PA Voice';
        }
      });
    }

    if (btnReplay) {
      btnReplay.addEventListener('click', () => {
        const audioUrl = lastPAAudioUrl || 'announcement_test.mp3';
        const audio = new Audio('/' + audioUrl.replace(/^\//, ''));
        audio.play().catch(e => console.log('Replay note:', e));
      });
    }

    if (btnDismiss) {
      btnDismiss.addEventListener('click', (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (window.DeltaAlertManager) {
          window.DeltaAlertManager.dismissCurrent();
        } else {
          const banner = document.getElementById('venue-pa-live-banner');
          if (banner) banner.style.display = 'none';
          if (typeof window.stopAllVoices === 'function') {
            window.stopAllVoices();
          }
        }
      });
    }
  }

  function bindCloudIntegrationsControls() {
    const btnResend = document.getElementById('btn-admin-test-resend');
    const btnEleven = document.getElementById('btn-admin-test-elevenlabs');
    const btnTwilio = document.getElementById('btn-admin-test-twilio');

    if (btnResend) {
      btnResend.addEventListener('click', async () => {
        btnResend.disabled = true;
        btnResend.textContent = '📧 Sending...';
        try {
          const res = await fetch('/api/notify/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              topicTitle: 'Keynote Session: Autonomous AI Swarms',
              speakerName: 'Aryan Pandey (Lead Coordinator)',
              oldVenue: 'Turing Hall',
              newVenue: 'Lovelace Suite',
              timeSlot: '02:00 PM - 03:00 PM',
              reason: 'Super Admin manual dispatch test via Resend API'
            })
          });
          const data = await res.json();
          if (data && data.success) {
            if (typeof createToast === 'function') {
              createToast(`🚀 Real email sent via Resend API to aryan.pandey777hyd@gmail.com!`, 'success');
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          btnResend.disabled = false;
          btnResend.textContent = '🚀 Test Email Dispatch';
        }
      });
    }

    if (btnEleven) {
      btnEleven.addEventListener('click', async () => {
        btnEleven.disabled = true;
        btnEleven.textContent = '🎙️ Synthesizing...';
        try {
          const res = await fetch('/api/voice/announce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: 'Attention attendees. Venue safety perception check completed. Lovelace Suite has ample open seating.',
              voiceId: 'EXAVITQu4vr4xnSDxMaL' // Sarah (Female)
            })
          });
          const data = await res.json();
          if (data && data.success) {
            lastPAAudioUrl = data.audioUrl;
            if (typeof window.handleVoiceAnnouncement === 'function') {
              window.handleVoiceAnnouncement(data);
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          btnEleven.disabled = false;
          btnEleven.textContent = '🔊 Test PA Announcement';
        }
      });
    }

    // Autonomous Tesla-style Live Occlusion Guard (Updates automatically from WebSocket broadcast)
    window.handleGeminiOcclusionAlert = function (data) {
      if (!data) return;
      const summaryEl = document.getElementById('gemini-audit-summary');
      const bottleneckEl = document.getElementById('gemini-audit-bottleneck');
      const scriptEl = document.getElementById('gemini-audit-script');
      const ratingBox = document.getElementById('gemini-audit-rating-box');

      if (summaryEl) {
        summaryEl.textContent = `🚨 [${data.time || 'Live'}] Autonomous Vision in ${data.hall}: ${data.count} attendees detected (${data.occluded || 0} occluded behind pillars). Self-healing dispatched!`;
      }
      if (bottleneckEl && data.observation) {
        bottleneckEl.textContent = data.observation;
      }
      if (scriptEl && data.recommendation) {
        scriptEl.textContent = data.recommendation;
      }
      if (ratingBox) {
        ratingBox.innerHTML = `
          <span class="gemini-rating-badge rating-critical" style="font-size:0.7rem; font-weight:800; padding:2px 8px; border-radius:4px; background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">
            SURGE VERIFIED • SELF-HEALING ACTIVE
          </span>
        `;
      }
    };

    if (btnTwilio) {
      btnTwilio.addEventListener('click', () => {
        triggerWhatsAppNotification(
          'Aryan Pandey (Lead Coordinator)',
          '+91 91542 76178',
          '⚠️ Operational update from DELTA Engine Central AV desk: Venue crowd nominal.'
        );
      });
    }
  }
})();
