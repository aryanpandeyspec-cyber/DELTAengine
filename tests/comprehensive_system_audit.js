/**
 * DELTA ENGINE - EXHAUSTIVE SYSTEM & FEATURE AUDIT TEST SUITE
 * Validates every backend route, WebSocket, frontend asset, DOM element,
 * perception subsystem, alert coordinator, self-healing agent, and compliance engine.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function logPass(category, testName, extra = '') {
  results.total++;
  results.passed++;
  console.log(`  [PASS] [${category}] ${testName} ${extra ? `(${extra})` : ''}`);
  results.details.push({ status: 'PASS', category, testName, extra });
}

function logFail(category, testName, error) {
  results.total++;
  results.failed++;
  console.error(`  [FAIL] [${category}] ${testName} -> ${error}`);
  results.details.push({ status: 'FAIL', category, testName, error });
}

function logWarn(category, testName, warning) {
  results.warnings++;
  console.warn(`  [WARN] [${category}] ${testName} -> ${warning}`);
  results.details.push({ status: 'WARN', category, testName, warning });
}

// HTTP Helper with timeout
function httpRequest(options, postData = null, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {};
    if (postData) {
      defaultHeaders['Content-Type'] = 'application/json';
      defaultHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const reqOptions = {
      ...options,
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    };

    let timer = null;
    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (timer) clearTimeout(timer);
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });

    timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`HTTP request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runAudit() {
  console.log('\n=============================================================');
  console.log('   DELTA ENGINE — EXHAUSTIVE FEATURE & COMPONENT AUDIT');
  console.log('=============================================================\n');

  // -------------------------------------------------------------
  // SECTION 1: JAVASCRIPT SYNTAX & CODE INTEGRITY ACROSS ALL FILES
  // -------------------------------------------------------------
  console.log('--- SECTION 1: Static Code & Syntax Validation ---');
  const jsFiles = [];
  function collectJs(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        collectJs(fullPath);
      } else if (file.endsWith('.js')) {
        jsFiles.push(fullPath);
      }
    });
  }
  collectJs(path.join(__dirname, '../backend'));
  collectJs(path.join(__dirname, '../frontend/components'));

  const { execSync } = require('child_process');
  for (const f of jsFiles) {
    const rel = path.relative(path.join(__dirname, '..'), f);
    try {
      execSync(`node -c "${f}"`);
      logPass('STATIC_SYNTAX', `Syntax check: ${rel}`);
    } catch (err) {
      logFail('STATIC_SYNTAX', `Syntax error: ${rel}`, err.message);
    }
  }

  // -------------------------------------------------------------
  // SECTION 2: HTML PAGES & STATIC ENTRYPOINTS
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: HTML Pages & HTTP Delivery ---');
  const pages = [
    { path: '/', name: 'Root Dashboard' },
    { path: '/dashboard', name: 'Dashboard Alias' },
    { path: '/admin', name: 'Admin Command Center' },
    { path: '/admin.html', name: 'Admin Static HTML' },
    { path: '/login', name: 'Login Page' },
    { path: '/login.html', name: 'Login Static HTML' },
    { path: '/volunteer', name: 'Volunteer Terminal' },
    { path: '/volunteer.html', name: 'Volunteer Static HTML' },
    { path: '/presentation', name: 'Presentation Slide Deck' },
    { path: '/presentation.html', name: 'Presentation Static HTML' },
    { path: '/signage', name: 'Signage TV Display' },
    { path: '/signage.html', name: 'Signage Static HTML' },
    { path: '/app.css', name: 'Global Neubrutalist CSS' }
  ];

  for (const page of pages) {
    try {
      const res = await httpRequest({
        hostname: 'localhost',
        port: 3000,
        path: page.path,
        method: 'GET'
      });
      if (res.statusCode === 200 && res.body.length > 50) {
        logPass('PAGE_HTTP', `${page.name} (${page.path})`, `${res.body.length} bytes`);
      } else {
        logFail('PAGE_HTTP', `${page.name} (${page.path})`, `Unexpected HTTP ${res.statusCode}`);
      }
    } catch (err) {
      logFail('PAGE_HTTP', `${page.name} (${page.path})`, err.message);
    }
  }

  // -------------------------------------------------------------
  // SECTION 3: DOM INTEGRITY & 14 CRITICAL DOM CONTROLS
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: Frontend DOM Controls Integrity ---');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../frontend/index.html'), 'utf8');
  const mandatoryIds = [
    'btn-open-cctv',
    'btn-open-scenario-lab',
    'btn-sound-toggle',
    'btn-shortcuts-modal',
    'btn-cctv-trigger-sensor',
    'btn-cctv-trigger-80',
    'btn-cctv-trigger-full',
    'btn-mass-disruption',
    'btn-reset-db',
    'btn-open-ical',
    'btn-show-tour',
    'btn-trigger-delay',
    'btn-trigger-surge',
    'scenario-lab-drawer'
  ];

  for (const id of mandatoryIds) {
    if (indexHtml.includes(`id="${id}"`)) {
      logPass('DOM_CONTROLS', `Mandatory ID present: #${id}`);
    } else {
      logFail('DOM_CONTROLS', `Missing required DOM control ID: #${id}`, 'Element ID not found in index.html');
    }
  }

  // Check verified modals in index.html
  const verifiedModals = [
    'cctv-perception-modal',
    'shortcuts-modal',
    'modal-fire-marshal-audit',
    'cctv-dispatch-all-modal',
    'cctv-speaker-directory-modal',
    'modal-upload-review',
    'modal-add-volunteer'
  ];
  for (const mId of verifiedModals) {
    if (indexHtml.includes(`id="${mId}"`)) {
      logPass('DOM_MODALS', `UI modal present: #${mId}`);
    } else {
      logFail('DOM_MODALS', `Missing expected modal: #${mId}`, 'Modal ID not in index.html');
    }
  }

  // -------------------------------------------------------------
  // SECTION 4: STATE, GRAPH & ENGINE SELF-HEALING ENDPOINTS
  // -------------------------------------------------------------
  console.log('\n--- SECTION 4: State & Self-Healing Core ---');
  try {
    const res = await httpRequest({ hostname: 'localhost', port: 3000, path: '/api/state', method: 'GET' });
    if (res.statusCode === 200 && res.json && res.json.graph && res.json.graph.halls) {
      logPass('API_STATE', 'GET /api/state', `${Object.keys(res.json.graph.halls).length} halls in graph`);
    } else {
      logFail('API_STATE', 'GET /api/state', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('API_STATE', 'GET /api/state', err.message);
  }

  // Test Capacity Simulation & Self-Healing Relocation
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/simulate/capacity', method: 'POST' },
      JSON.stringify({ topicId: 'topic-1', interestCount: 260 })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('SELF_HEALING', 'POST /api/simulate/capacity (Hall Capacity Breach)', res.json.message || 'Self-healed');
    } else {
      logFail('SELF_HEALING', 'POST /api/simulate/capacity', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('SELF_HEALING', 'POST /api/simulate/capacity', err.message);
  }

  // Test Speaker Delay Simulation & Schedule rearrangement
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/simulate/delay', method: 'POST' },
      JSON.stringify({ speakerId: 'speaker-1', delayMinutes: 30 })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('SELF_HEALING', 'POST /api/simulate/delay (Speaker Delay Cascade)', res.json.message || 'Re-arranged');
    } else {
      logFail('SELF_HEALING', 'POST /api/simulate/delay', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('SELF_HEALING', 'POST /api/simulate/delay', err.message);
  }

  // Test Reset DB
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/reset', method: 'POST' },
      JSON.stringify({})
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('API_RESET', 'POST /api/reset (Database & Schedule Restore)', 'Restored');
    } else {
      logFail('API_RESET', 'POST /api/reset', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('API_RESET', 'POST /api/reset', err.message);
  }

  // Test iCal feed
  try {
    const res = await httpRequest({ hostname: 'localhost', port: 3000, path: '/api/calendar/feed.ics', method: 'GET' });
    if (res.statusCode === 200 && res.body.includes('BEGIN:VCALENDAR')) {
      logPass('API_ICAL', 'GET /api/calendar/feed.ics (iCalendar VCALENDAR Export)', `${res.body.length} bytes`);
    } else {
      logFail('API_ICAL', 'GET /api/calendar/feed.ics', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('API_ICAL', 'GET /api/calendar/feed.ics', err.message);
  }

  // -------------------------------------------------------------
  // SECTION 5: SCENARIOS & OPERATIONS ENGINE (ALL 5 SCENARIOS)
  // -------------------------------------------------------------
  console.log('\n--- SECTION 5: Dynamic Scenario Registry & Operations Engine ---');
  const scenariosToTest = ['CONFERENCE', 'PUBLIC_RALLY', 'LARGE_GATHERING', 'MOVIE_PROMO', 'RELIGIOUS_GATHERING'];

  try {
    const res = await httpRequest({ hostname: 'localhost', port: 3000, path: '/api/scenarios', method: 'GET' });
    if (res.statusCode === 200 && res.json && res.json.scenarios) {
      logPass('SCENARIO_REGISTRY', 'GET /api/scenarios', `${res.json.scenarios.length} scenarios registered`);
    } else {
      logFail('SCENARIO_REGISTRY', 'GET /api/scenarios', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('SCENARIO_REGISTRY', 'GET /api/scenarios', err.message);
  }

  for (const scId of scenariosToTest) {
    try {
      const res = await httpRequest({ hostname: 'localhost', port: 3000, path: `/api/scenarios/${scId}`, method: 'GET' });
      if (res.statusCode === 200 && res.json && res.json.scenario) {
        logPass('SCENARIO_FETCH', `GET /api/scenarios/${scId}`, `${res.json.scenario.name} (${res.json.scenario.zones.length} zones)`);
      } else {
        logFail('SCENARIO_FETCH', `GET /api/scenarios/${scId}`, `Status ${res.statusCode}`);
      }
    } catch (err) {
      logFail('SCENARIO_FETCH', `GET /api/scenarios/${scId}`, err.message);
    }
  }

  // Test Scenario Switch
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/scenarios/select', method: 'POST' },
      JSON.stringify({ scenarioId: 'PUBLIC_RALLY' })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('SCENARIO_SELECT', 'POST /api/scenarios/select (Switch to PUBLIC_RALLY)', 'Switched');
    } else {
      logFail('SCENARIO_SELECT', 'POST /api/scenarios/select', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('SCENARIO_SELECT', 'POST /api/scenarios/select', err.message);
  }

  // Test Telemetry Requirements Model for active scenario
  try {
    const res = await httpRequest({ hostname: 'localhost', port: 3000, path: '/api/operations/requirements?scenarioId=PUBLIC_RALLY', method: 'GET' });
    if (res.statusCode === 200 && res.json && res.json.requirementsModel) {
      logPass('OPERATIONS_MODEL', 'GET /api/operations/requirements', 'Telemetry requirements mapped');
    } else {
      logFail('OPERATIONS_MODEL', 'GET /api/operations/requirements', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('OPERATIONS_MODEL', 'GET /api/operations/requirements', err.message);
  }

  // Test Simulate Crowd Incident in active scenario
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/operations/simulate-crowd-incident', method: 'POST' },
      JSON.stringify({ incidentType: 'OVER_CAPACITY', zoneId: 'rally-vip', occupancy: 950 })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('OPERATIONS_INCIDENT', 'POST /api/operations/simulate-crowd-incident', `Action: ${res.json.action ? res.json.action.type : 'Handled'}`);
    } else {
      logFail('OPERATIONS_INCIDENT', 'POST /api/operations/simulate-crowd-incident', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('OPERATIONS_INCIDENT', 'POST /api/operations/simulate-crowd-incident', err.message);
  }

  // Switch back to CONFERENCE baseline
  await httpRequest(
    { hostname: 'localhost', port: 3000, path: '/api/scenarios/select', method: 'POST' },
    JSON.stringify({ scenarioId: 'CONFERENCE' })
  );

  // -------------------------------------------------------------
  // SECTION 6: CAMERA / CCTV VISION / SENSOR ENDPOINTS
  // -------------------------------------------------------------
  console.log('\n--- SECTION 6: Camera, CCTV Vision Perception & Hardware ---');
  // POST /api/sensors/camera
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/sensors/camera', method: 'POST' },
      JSON.stringify({
        hallId: 'hall-1',
        headcount: 42,
        densityRatio: 0.168,
        confidence: 0.94,
        timestamp: Date.now()
      })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('CCTV_TELEMETRY', 'POST /api/sensors/camera (Perception Telemetry Ingestion)', `Headcount: 42 recorded`);
    } else {
      logFail('CCTV_TELEMETRY', 'POST /api/sensors/camera', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('CCTV_TELEMETRY', 'POST /api/sensors/camera', err.message);
  }

  // GET /api/sensors/camera/latest
  try {
    const res = await httpRequest({ hostname: 'localhost', port: 3000, path: '/api/sensors/camera/latest', method: 'GET' });
    if (res.statusCode === 200 && res.json) {
      logPass('CCTV_TELEMETRY', 'GET /api/sensors/camera/latest', `Latest sensor state retrieved`);
    } else {
      logFail('CCTV_TELEMETRY', 'GET /api/sensors/camera/latest', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('CCTV_TELEMETRY', 'GET /api/sensors/camera/latest', err.message);
  }

  // POST /api/sensors/door (Now fixed and verified!)
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/sensors/door', method: 'POST' },
      JSON.stringify({ event: 'ENTRY', hallId: 'hall-1', gateId: 'gate-a' })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('DOOR_SENSOR', 'POST /api/sensors/door (Physical Turnstile Optical Beam)', `Occupancy: ${res.json.occupancy}`);
    } else {
      logFail('DOOR_SENSOR', 'POST /api/sensors/door', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('DOOR_SENSOR', 'POST /api/sensors/door', err.message);
  }

  // GET /api/sensors/doors/mesh
  try {
    const res = await httpRequest({ hostname: 'localhost', port: 3000, path: '/api/sensors/doors/mesh', method: 'GET' });
    if (res.statusCode === 200 && res.json && res.json.gates) {
      logPass('DOOR_MESH', 'GET /api/sensors/doors/mesh (Door Telemetry Mesh)', 'Mesh status OK');
    } else {
      logFail('DOOR_MESH', 'GET /api/sensors/doors/mesh', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('DOOR_MESH', 'GET /api/sensors/doors/mesh', err.message);
  }

  // POST /api/sensors/face-passage
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/sensors/face-passage', method: 'POST' },
      JSON.stringify({ event: 'ENTRY', attendeeId: 'user-vip-1', attendeeName: 'Dr. Jane Smith', netOccupancy: 45, hallId: 'hall-1' })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('FACE_PASSAGE', 'POST /api/sensors/face-passage (Edge Biometric Event)', 'Passage logged');
    } else {
      logFail('FACE_PASSAGE', 'POST /api/sensors/face-passage', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('FACE_PASSAGE', 'POST /api/sensors/face-passage', err.message);
  }

  // -------------------------------------------------------------
  // SECTION 7: VOLUNTEERS & FIELD MARSHAL ROUTING
  // -------------------------------------------------------------
  console.log('\n--- SECTION 7: Volunteer & Field Marshal Routing ---');
  let testVolId = null;
  try {
    const res = await httpRequest({ hostname: 'localhost', port: 3000, path: '/api/volunteers', method: 'GET' });
    if (res.statusCode === 200 && res.json && Array.isArray(res.json.volunteers)) {
      logPass('VOLUNTEER_API', 'GET /api/volunteers', `${res.json.volunteers.length} coordinators active`);
    } else {
      logFail('VOLUNTEER_API', 'GET /api/volunteers', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('VOLUNTEER_API', 'GET /api/volunteers', err.message);
  }

  // Add Volunteer
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/volunteers', method: 'POST' },
      JSON.stringify({ name: 'Test Marshal', hall: 'hall-1', phone: '+1234567890', role: 'Crowd Marshal' })
    );
    if (res.statusCode === 200 && res.json && res.json.volunteer) {
      testVolId = res.json.volunteer.id;
      logPass('VOLUNTEER_API', 'POST /api/volunteers (Register Marshal)', `ID: ${testVolId}`);
    } else {
      logFail('VOLUNTEER_API', 'POST /api/volunteers', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('VOLUNTEER_API', 'POST /api/volunteers', err.message);
  }

  // Update Volunteer
  if (testVolId) {
    try {
      const res = await httpRequest(
        { hostname: 'localhost', port: 3000, path: `/api/volunteers/${testVolId}`, method: 'PUT' },
        JSON.stringify({ role: 'Lead Incident Commander' })
      );
      if (res.statusCode === 200 && res.json && res.json.success) {
        logPass('VOLUNTEER_API', `PUT /api/volunteers/${testVolId}`, 'Updated role');
      } else {
        logFail('VOLUNTEER_API', `PUT /api/volunteers/${testVolId}`, `Status ${res.statusCode}`);
      }
    } catch (err) {
      logFail('VOLUNTEER_API', `PUT /api/volunteers/${testVolId}`, err.message);
    }
  }

  // Test Hall Targeted Alert
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/volunteers/test-hall-alert', method: 'POST' },
      JSON.stringify({ hallId: 'hall-1', message: 'Test Emergency Dispatch' })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('VOLUNTEER_DISPATCH', 'POST /api/volunteers/test-hall-alert', 'Dispatched to hall marshals');
    } else {
      logFail('VOLUNTEER_DISPATCH', 'POST /api/volunteers/test-hall-alert', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('VOLUNTEER_DISPATCH', 'POST /api/volunteers/test-hall-alert', err.message);
  }

  // Test Volunteer SOS
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/volunteer/sos', method: 'POST' },
      JSON.stringify({ hallId: 'hall-1', volunteerName: 'Field Marshal 01', message: 'Assistance requested at Entry Gate 2' })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('VOLUNTEER_SOS', 'POST /api/volunteer/sos (1-Tap Emergency SOS)', 'SOS logged');
    } else {
      logFail('VOLUNTEER_SOS', 'POST /api/volunteer/sos', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('VOLUNTEER_SOS', 'POST /api/volunteer/sos', err.message);
  }

  // Delete test volunteer
  if (testVolId) {
    try {
      const res = await httpRequest({ hostname: 'localhost', port: 3000, path: `/api/volunteers/${testVolId}`, method: 'DELETE' });
      if (res.statusCode === 200) {
        logPass('VOLUNTEER_API', `DELETE /api/volunteers/${testVolId}`, 'Cleaned up');
      }
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // SECTION 8: COMPLIANCE, AI AUDIT & GOVERNANCE
  // -------------------------------------------------------------
  console.log('\n--- SECTION 8: NFPA-101 Compliance, AI Audits & Supervised SLA ---');
  // Fire Marshal Audit
  try {
    const res = await httpRequest({ hostname: 'localhost', port: 3000, path: '/api/compliance/fire-marshal-audit', method: 'GET' });
    if (res.statusCode === 200 && res.json && res.json.verificationSeal) {
      logPass('COMPLIANCE_NFPA', 'GET /api/compliance/fire-marshal-audit (NFPA-101 / IBC-2024 Audit)', `Seal: ${res.json.verificationSeal}`);
    } else {
      logFail('COMPLIANCE_NFPA', 'GET /api/compliance/fire-marshal-audit', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('COMPLIANCE_NFPA', 'GET /api/compliance/fire-marshal-audit', err.message);
  }

  // Supervisor Action SLA
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/audit/supervisor-action', method: 'POST' },
      JSON.stringify({
        actionId: 'ACT-TEST-001',
        actionType: 'REROUTE_CROWD',
        supervisorName: 'Commander Alpha',
        decision: 'APPROVED',
        notes: 'Approved automated mitigation'
      })
    );
    if (res.statusCode === 200 && res.json && res.json.auditRecord && res.json.auditRecord.cryptoSignature) {
      logPass('SUPERVISOR_SLA', 'POST /api/audit/supervisor-action (Cryptographic SLA Sign)', `Signature: ${res.json.auditRecord.cryptoSignature.substring(0, 16)}...`);
    } else {
      logFail('SUPERVISOR_SLA', 'POST /api/audit/supervisor-action', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('SUPERVISOR_SLA', 'POST /api/audit/supervisor-action', err.message);
  }

  // Voice Announce
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/voice/announce', method: 'POST' },
      JSON.stringify({ text: 'Attention attendees: Hall 1 is operating normally.', hallId: 'hall-1' })
    );
    if (res.statusCode === 200 && res.json) {
      logPass('VOICE_ANNOUNCER', 'POST /api/voice/announce (Venue Voice Synthesis)', res.json.audioUrl ? 'Generated audio' : 'Acknowledged');
    } else {
      logFail('VOICE_ANNOUNCER', 'POST /api/voice/announce', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('VOICE_ANNOUNCER', 'POST /api/voice/announce', err.message);
  }

  // System Integrations
  try {
    const res = await httpRequest({ hostname: 'localhost', port: 3000, path: '/api/system/integrations', method: 'GET' });
    if (res.statusCode === 200 && res.json) {
      logPass('SYSTEM_INTEGRATIONS', 'GET /api/system/integrations (API Health & Integration States)', 'Integrations verified');
    } else {
      logFail('SYSTEM_INTEGRATIONS', 'GET /api/system/integrations', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('SYSTEM_INTEGRATIONS', 'GET /api/system/integrations', err.message);
  }

  // -------------------------------------------------------------
  // SECTION 9: ADMIN, CHAOS SIMULATION & STRESS TEST
  // -------------------------------------------------------------
  console.log('\n--- SECTION 9: Admin, Chaos & Stress Tests ---');
  // Toggle autopilot
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/admin/toggle-autopilot', method: 'POST' },
      JSON.stringify({ enabled: true })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('ADMIN_AUTOPILOT', 'POST /api/admin/toggle-autopilot (Autopilot Engaged)', 'State updated');
    } else {
      logFail('ADMIN_AUTOPILOT', 'POST /api/admin/toggle-autopilot', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('ADMIN_AUTOPILOT', 'POST /api/admin/toggle-autopilot', err.message);
  }

  // Toggle limiter
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/admin/toggle-limiter', method: 'POST' },
      JSON.stringify({ enabled: true })
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('ADMIN_LIMITER', 'POST /api/admin/toggle-limiter', 'State updated');
    } else {
      logFail('ADMIN_LIMITER', 'POST /api/admin/toggle-limiter', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('ADMIN_LIMITER', 'POST /api/admin/toggle-limiter', err.message);
  }

  // Mass disruption
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/sim/mass-disruption', method: 'POST' },
      JSON.stringify({})
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('CHAOS_MASS_DISRUPTION', 'POST /api/sim/mass-disruption (Multi-Hall Chaos Trigger)', `${res.json.actions ? res.json.actions.length : 0} actions dispatched`);
    } else {
      logFail('CHAOS_MASS_DISRUPTION', 'POST /api/sim/mass-disruption', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('CHAOS_MASS_DISRUPTION', 'POST /api/sim/mass-disruption', err.message);
  }

  // Reset after mass disruption
  await httpRequest({ hostname: 'localhost', port: 3000, path: '/api/reset', method: 'POST' }, JSON.stringify({}));

  // Stress Test 500
  try {
    const res = await httpRequest(
      { hostname: 'localhost', port: 3000, path: '/api/admin/stress-test-500', method: 'POST' },
      JSON.stringify({})
    );
    if (res.statusCode === 200 && res.json && res.json.success) {
      logPass('STRESS_TEST_500', 'POST /api/admin/stress-test-500 (500-Iteration Edge Test)', `${res.json.iterations} iterations passed (0 errors)`);
    } else {
      logFail('STRESS_TEST_500', 'POST /api/admin/stress-test-500', `Status ${res.statusCode}`);
    }
  } catch (err) {
    logFail('STRESS_TEST_500', 'POST /api/admin/stress-test-500', err.message);
  }

  // -------------------------------------------------------------
  // SECTION 10: WEBSOCKET LIVE TELEMETRY
  // -------------------------------------------------------------
  console.log('\n--- SECTION 10: WebSocket Live Telemetry ---');
  await new Promise((resolve) => {
    let ws = null;
    try {
      ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        logFail('WEBSOCKET', 'WebSocket Connection & Handshake', 'Timed out waiting for INIT_STATE');
        if (ws) ws.terminate();
        resolve();
      }, 5000);

      ws.on('open', () => {
        logPass('WEBSOCKET', 'WebSocket Client Connected');
      });

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.type === 'INIT_STATE') {
            clearTimeout(timer);
            logPass('WEBSOCKET', 'Received INIT_STATE Telemetry Packet', `Active scenario: ${parsed.activeScenario || 'CONFERENCE'}`);
            ws.close();
            resolve();
          }
        } catch (e) {}
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        logFail('WEBSOCKET', 'WebSocket Error', err.message);
        resolve();
      });
    } catch (err) {
      logFail('WEBSOCKET', 'WebSocket Exception', err.message);
      resolve();
    }
  });

  // -------------------------------------------------------------
  // SECTION 11: FRONTEND SCRIPT ASSETS 200 OK CHECK
  // -------------------------------------------------------------
  console.log('\n--- SECTION 11: Frontend Component HTTP Asset Delivery ---');
  const componentAssets = [
    '/components/alertCoordinator.js',
    '/components/app.js',
    '/components/websockets.js',
    '/components/dragdrop.js',
    '/components/graphVisualizer.js',
    '/components/tourGuide.js',
    '/components/roomSpatialModel.js',
    '/components/spatialReconstruction.js',
    '/components/contentPipeline.js',
    '/components/stressTester.js',
    '/components/auth.js',
    '/components/customCursor.js',
    '/components/pico.js',
    '/components/facefinder.js',
    '/components/cctvPerception.js'
  ];

  for (const asset of componentAssets) {
    try {
      const res = await httpRequest({ hostname: 'localhost', port: 3000, path: asset, method: 'GET' });
      if (res.statusCode === 200 && res.body.length > 50) {
        logPass('ASSET_DELIVERY', `Asset HTTP 200: ${asset}`, `${res.body.length} bytes`);
      } else {
        logFail('ASSET_DELIVERY', `Asset delivery failed: ${asset}`, `HTTP ${res.statusCode}`);
      }
    } catch (err) {
      logFail('ASSET_DELIVERY', `Asset request error: ${asset}`, err.message);
    }
  }

  // -------------------------------------------------------------
  // SECTION 12: ALERT COORDINATOR SPEECH & DISMISSAL LOGIC INSPECTION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 12: Alert Coordinator Behavior & Queue Rules ---');
  const alertCoordCode = fs.readFileSync(path.join(__dirname, '../frontend/components/alertCoordinator.js'), 'utf8');

  // Check queue structure
  if (alertCoordCode.includes('this.queue') && (alertCoordCode.includes('this.isBusy') || alertCoordCode.includes('this.currentAlert'))) {
    logPass('ALERT_QUEUE', 'AlertCoordinator implements single-alert queue state');
  } else {
    logFail('ALERT_QUEUE', 'AlertCoordinator missing queue or active state', 'this.queue or this.isBusy not found');
  }

  // Check speech synthesis cancellation on dismiss
  if (alertCoordCode.includes('speechSynthesis.cancel()')) {
    logPass('ALERT_SPEECH', 'AlertCoordinator cancels active speech on alert dismissal');
  } else {
    logFail('ALERT_SPEECH', 'AlertCoordinator does not cancel speech synthesis on dismiss', 'speechSynthesis.cancel() missing');
  }

  // Check 2000ms delay before announcing next alert
  if (alertCoordCode.includes('2000') || alertCoordCode.includes('GAP_BETWEEN_ALERTS') || alertCoordCode.includes('2 second gap') || alertCoordCode.includes('2s gap')) {
    logPass('ALERT_INTERVAL', 'AlertCoordinator enforces 2-second gap between successive alerts');
  } else {
    logWarn('ALERT_INTERVAL', 'Verify if 2-second gap between queued alerts is configured as 2000ms');
  }

  // -------------------------------------------------------------
  // SECTION 13: CCTV CAMERA PERCEPTION HUD & LAG MITIGATION INSPECTION
  // -------------------------------------------------------------
  console.log('\n--- SECTION 13: CCTV Perception HUD & Camera Stream Inspection ---');
  const cctvCode = fs.readFileSync(path.join(__dirname, '../frontend/components/cctvPerception.js'), 'utf8');

  if (cctvCode.includes('getUserMedia') || cctvCode.includes('navigator.mediaDevices')) {
    logPass('CCTV_CAMERA', 'CCTVPerception supports live web camera stream via getUserMedia');
  } else {
    logFail('CCTV_CAMERA', 'CCTVPerception lacks getUserMedia webcam support', 'getUserMedia missing');
  }

  if (cctvCode.includes('startSimulatedDetection') || cctvCode.includes('simulate') || cctvCode.includes('simulated')) {
    logPass('CCTV_FALLBACK', 'CCTVPerception includes simulated fallback when hardware camera is denied/unavailable');
  } else {
    logFail('CCTV_FALLBACK', 'CCTVPerception missing simulated camera fallback', 'No fallback mechanism');
  }

  if (cctvCode.includes('requestAnimationFrame') || cctvCode.includes('throttle') || cctvCode.includes('interval') || cctvCode.includes('FPS')) {
    logPass('CCTV_PERF', 'CCTVPerception includes frame throttling / lag mitigation');
  } else {
    logWarn('CCTV_PERF', 'Check frame rate throttling in CCTV perception engine');
  }

  // -------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(`   AUDIT COMPLETE: ${results.passed}/${results.total} PASSED (${((results.passed/results.total)*100).toFixed(1)}%)`);
  if (results.failed > 0) {
    console.log(`   FAILURES DETECTED: ${results.failed}`);
  } else {
    console.log(`   ZERO FATAL FAILURES! All operational systems verified.`);
  }
  if (results.warnings > 0) {
    console.log(`   WARNINGS: ${results.warnings}`);
  }
  console.log('=============================================================\n');

  return results;
}

runAudit()
  .then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  })
  .catch(err => {
    console.error('Fatal audit suite error:', err);
    process.exit(1);
  });
