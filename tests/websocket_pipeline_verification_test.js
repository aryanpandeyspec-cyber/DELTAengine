/**
 * DELTA ENGINE — WEBSOCKET PIPELINE & MULTI-TERMINAL VERIFICATION TEST SUITE
 * Validates that all server broadcast types reach WebSocket clients and that
 * all client receivers (websockets.js, volunteer.html, signage.html) handle them.
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

function post(endpoint, data = {}, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const url = new URL(endpoint, BASE_URL);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(endpoint, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const req = http.request(url, { method: 'GET', headers }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

let passed = 0;
let total = 0;

function test(description, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('  DELTA ENGINE — WEBSOCKET PIPELINE & DISPATCH VERIFICATION    ');
  console.log('================================================================\n');

  // SUITE 1: Client Code Integrity & Handlers Audit
  console.log('[SUITE 1] Frontend Client WebSocket Handlers Audit');
  const wsJs = fs.readFileSync(path.join(__dirname, '../frontend/components/websockets.js'), 'utf8');
  const volHtml = fs.readFileSync(path.join(__dirname, '../frontend/volunteer.html'), 'utf8');
  const signHtml = fs.readFileSync(path.join(__dirname, '../frontend/signage.html'), 'utf8');

  test('websockets.js handles VOLUNTEER_SOS_ALERT', () => {
    assert(wsJs.includes("case 'VOLUNTEER_SOS_ALERT':"));
  });

  test('websockets.js handles GATE_RELEASE_PULSE', () => {
    assert(wsJs.includes("case 'GATE_RELEASE_PULSE':"));
  });

  test('websockets.js handles VOLUNTEER_OVERFLOW_OPEN', () => {
    assert(wsJs.includes("case 'VOLUNTEER_OVERFLOW_OPEN':"));
  });

  test('websockets.js handles VOLUNTEER_ALERT_ACK', () => {
    assert(wsJs.includes("case 'VOLUNTEER_ALERT_ACK':"));
  });

  test('websockets.js handles SUPERVISOR_ACTION_LOGGED', () => {
    assert(wsJs.includes("case 'SUPERVISOR_ACTION_LOGGED':"));
  });

  test('websockets.js handles SWARM_CHAT', () => {
    assert(wsJs.includes("case 'SWARM_CHAT':"));
  });

  test('websockets.js handles TOAST', () => {
    assert(wsJs.includes("case 'TOAST':"));
  });

  test('websockets.js handles GRAPH_UPDATED', () => {
    assert(wsJs.includes("case 'GRAPH_UPDATED':"));
  });

  test('websockets.js handles MESH_MESSAGE and CHAT_MESSAGE', () => {
    assert(wsJs.includes("case 'MESH_MESSAGE':") && wsJs.includes("case 'CHAT_MESSAGE':"));
  });

  test('websockets.js handles GATE_MESH_UPDATE', () => {
    assert(wsJs.includes("case 'GATE_MESH_UPDATE':"));
  });

  test('websockets.js handles SYSTEM_LOG', () => {
    assert(wsJs.includes("case 'SYSTEM_LOG':"));
  });

  test('volunteer.html handles VOLUNTEER_SOS_ALERT', () => {
    assert(volHtml.includes("msg.type === 'VOLUNTEER_SOS_ALERT'"));
  });

  test('volunteer.html handles GATE_RELEASE_PULSE', () => {
    assert(volHtml.includes("msg.type === 'GATE_RELEASE_PULSE'"));
  });

  test('volunteer.html handles VOLUNTEER_OVERFLOW_OPEN', () => {
    assert(volHtml.includes("msg.type === 'VOLUNTEER_OVERFLOW_OPEN'"));
  });

  test('volunteer.html handles VOLUNTEER_ALERT_ACK', () => {
    assert(volHtml.includes("msg.type === 'VOLUNTEER_ALERT_ACK'"));
  });

  test('volunteer.html handles VOLUNTEER_ALERT directive', () => {
    assert(volHtml.includes("msg.type === 'VOLUNTEER_ALERT'"));
  });

  test('volunteer.html handles QUICK_ACTION_DISPATCH', () => {
    assert(volHtml.includes("msg.type === 'QUICK_ACTION_DISPATCH'"));
  });

  test('volunteer.html handles VOICE_BROADCAST', () => {
    assert(volHtml.includes("msg.type === 'VOICE_BROADCAST'"));
  });

  test('volunteer.html handles TASK_CREATED', () => {
    assert(volHtml.includes("msg.type === 'TASK_CREATED'"));
  });

  test('signage.html handles GATE_RELEASE_PULSE', () => {
    assert(signHtml.includes("payload.type === 'GATE_RELEASE_PULSE'"));
  });

  test('signage.html handles VOLUNTEER_OVERFLOW_OPEN', () => {
    assert(signHtml.includes("payload.type === 'VOLUNTEER_OVERFLOW_OPEN'"));
  });

  test('signage.html handles GRAPH_UPDATED', () => {
    assert(signHtml.includes("payload.type === 'GRAPH_UPDATED'"));
  });

  test('signage.html handles EMERGENCY_RELEASE & EMERGENCY_TRIGGERED', () => {
    assert(signHtml.includes("payload.type === 'EMERGENCY_RELEASE'"));
    assert(signHtml.includes("payload.type === 'EMERGENCY_TRIGGERED'"));
  });

  test('signage.html handles CRITICAL_ALERT', () => {
    assert(signHtml.includes("payload.type === 'CRITICAL_ALERT'"));
  });

  const appHtml = fs.readFileSync(path.join(__dirname, '../frontend/app.html'), 'utf8');

  test('app.html handles VOLUNTEER_SOS_ALERT and GATE_RELEASE_PULSE', () => {
    assert(appHtml.includes("case 'VOLUNTEER_SOS_ALERT':"));
    assert(appHtml.includes("case 'GATE_RELEASE_PULSE':"));
  });

  test('app.html handles CRITICAL_ALERT, EMERGENCY_TRIGGERED, and AI_ADVISORY', () => {
    assert(appHtml.includes("case 'CRITICAL_ALERT':"));
    assert(appHtml.includes("case 'EMERGENCY_TRIGGERED':"));
    assert(appHtml.includes("case 'AI_ADVISORY':"));
  });

  const swJs = fs.readFileSync(path.join(__dirname, '../frontend/sw.js'), 'utf8');

  test('sw.js pre-caches complete PWA suite including login and presentation', () => {
    assert(swJs.includes("'/login.html'"));
    assert(swJs.includes("'/presentation.html'"));
    assert(swJs.includes("'/components/customCursor.js'"));
    assert(swJs.includes("'/components/cctvPerception.js'"));
  });

  test('websockets.js exports window.sendWsMessage', () => {
    assert(wsJs.includes("window.sendWsMessage = function"));
  });

  const cctvJs = fs.readFileSync(path.join(__dirname, '../frontend/components/cctvPerception.js'), 'utf8');

  test('cctvPerception.js defines window.handleGateReleasePulse', () => {
    assert(cctvJs.includes("window.handleGateReleasePulse = function"));
  });

  test('cctvPerception.js defines window.handleVolunteerSosAlert', () => {
    assert(cctvJs.includes("window.handleVolunteerSosAlert = function"));
  });

  test('cctvPerception.js defines window.handleGateMeshUpdate', () => {
    assert(cctvJs.includes("window.handleGateMeshUpdate = function"));
  });

  test('cctvPerception.js defines window.handleOverflowOpen', () => {
    assert(cctvJs.includes("window.handleOverflowOpen = function"));
  });

  test('cctvPerception.js defines window.handleVolunteerAlertAck', () => {
    assert(cctvJs.includes("window.handleVolunteerAlertAck = function"));
  });

  // SUITE 2: Live WebSocket Packet Delivery Verification
  console.log('\n[SUITE 2] Live Real-Time WebSocket Telemetry Broadcasts');

  const receivedPackets = [];
  const ws = new WebSocket(WS_URL);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for INIT_STATE')), 3000);
    ws.on('error', reject);
    ws.on('message', data => {
      try {
        const parsed = JSON.parse(data.toString());
        receivedPackets.push(parsed);
        if (parsed.type === 'INIT_STATE') {
          clearTimeout(timer);
          resolve();
        }
      } catch (e) {}
    });
  });

  test('WebSocket links to Event OS and receives INIT_STATE', () => {
    const init = receivedPackets.find(p => p.type === 'INIT_STATE');
    assert(init, 'INIT_STATE packet should be received upon connection');
  });

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Test 1: Emergency SOS Broadcast
  const sosRes = await post('/api/volunteer/sos', {
    volunteerName: 'Aryan Pandey (Test Marshal)',
    hallId: 'hall-1',
    note: 'Stairwell chokepoint high surge test',
    crowdSeverity: 'CRITICAL'
  });
  await sleep(60);
  test('POST /api/volunteer/sos broadcasts VOLUNTEER_SOS_ALERT', () => {
    assert.strictEqual(sosRes.status, 200);
    const p = receivedPackets.find(x => x.type === 'VOLUNTEER_SOS_ALERT');
    assert(p, 'VOLUNTEER_SOS_ALERT packet should be broadcasted');
    assert.strictEqual(p.data.volunteerName, 'Aryan Pandey (Test Marshal)');
  });

  const sqliteStore = require('../backend/components/sqliteStore');
  test('sqliteStore persists VOLUNTEER_SOS to compliance_audits WAL', () => {
    const audits = sqliteStore.getRecentComplianceAudits(20);
    assert(Array.isArray(audits), 'Audits should be an array');
    const sosAudit = audits.find(a => a.event_type === 'VOLUNTEER_SOS');
    assert(sosAudit, 'VOLUNTEER_SOS audit should be persisted in SQLite storage');
  });

  // Test 2: Gate Release Pulse
  const gatePulseRes = await post('/api/sensors/door', {
    hallId: 'hall-1',
    gateId: 'gate-b',
    action: 'EMERGENCY_RELEASE',
    pressurePsi: 9.8,
    reason: 'Surge pressure threshold exceeded (>8.5 PSI)'
  });
  await sleep(60);
  test('POST /api/sensors/door (EMERGENCY_RELEASE) broadcasts GATE_RELEASE_PULSE', () => {
    assert.strictEqual(gatePulseRes.status, 200);
    const p = receivedPackets.find(x => x.type === 'GATE_RELEASE_PULSE');
    assert(p, 'GATE_RELEASE_PULSE packet should be broadcasted');
    assert(p.data.pressurePsi >= 8.5);
  });

  // Test 3: Walkie-Talkie Mesh Messages (Dual CHAT_MESSAGE and MESH_MESSAGE)
  const meshRes = await post('/api/messages/send', {
    sender: 'Suryansh (Safety Lead)',
    role: 'MARSHAL',
    text: 'Stairwell 3 cleared, flow normal.'
  });
  await sleep(60);
  test('POST /api/messages/send broadcasts CHAT_MESSAGE and MESH_MESSAGE', () => {
    assert.strictEqual(meshRes.status, 200);
    const pChat = receivedPackets.find(x => x.type === 'CHAT_MESSAGE' && x.data.text.includes('Stairwell 3'));
    const pMesh = receivedPackets.find(x => x.type === 'MESH_MESSAGE' && x.data.text.includes('Stairwell 3'));
    assert(pChat, 'CHAT_MESSAGE packet should be broadcasted');
    assert(pMesh, 'MESH_MESSAGE packet should be broadcasted');
  });

  // Test 4: Dynamic Date Matrix Change (GRAPH_UPDATED)
  const dateRes = await post('/api/schedule/set-date', {
    date: '2026-10-25'
  });
  await sleep(60);
  test('POST /api/schedule/set-date broadcasts GRAPH_UPDATED', () => {
    assert.strictEqual(dateRes.status, 200);
    const p = receivedPackets.find(x => x.type === 'GRAPH_UPDATED');
    assert(p, 'GRAPH_UPDATED packet should be broadcasted');
    assert.strictEqual(p.data.activeDate, '2026-10-25');
  });

  // Test 5: Supervisor Cryptographic Sign-Off (SUPERVISOR_ACTION_LOGGED)
  const supRes = await post('/api/audit/supervisor-action', {
    incidentId: 'INC_TEST_01',
    actionId: 'ACT_TEST_01',
    decision: 'SUPERVISOR_OVERRIDE_APPROVED',
    notes: 'Life safety egress route confirmed clear.'
  });
  await sleep(60);
  test('POST /api/audit/supervisor-action broadcasts SUPERVISOR_ACTION_LOGGED', () => {
    assert.strictEqual(supRes.status, 200);
    const p = receivedPackets.find(x => x.type === 'SUPERVISOR_ACTION_LOGGED');
    assert(p, 'SUPERVISOR_ACTION_LOGGED packet should be broadcasted');
    assert(p.data.cryptoSignature.startsWith('SIG-SHA256-'));
  });

  // Test 6: Door Trigger and Gate Mesh Update
  const doorRes = await post('/api/sensors/door', {
    hallId: 'hall-1',
    gateId: 'gate-a',
    event: 'DOOR_TRIGGER'
  });
  await sleep(60);
  test('POST /api/sensors/door (DOOR_TRIGGER) broadcasts DOOR_TRIGGER & GATE_MESH_UPDATE', () => {
    assert.strictEqual(doorRes.status, 200);
    const pDoor = receivedPackets.find(x => x.type === 'DOOR_TRIGGER');
    const pMesh = receivedPackets.find(x => x.type === 'GATE_MESH_UPDATE');
    assert(pDoor, 'DOOR_TRIGGER packet should be broadcasted');
    assert(pMesh, 'GATE_MESH_UPDATE packet should be broadcasted');
  });

  // Test 7: Bidirectional Client PING -> PONG over WebSocket
  ws.send(JSON.stringify({ type: 'PING' }));
  await sleep(60);
  test('Client sends PING over WS and receives PONG', () => {
    const pPong = receivedPackets.find(x => x.type === 'PONG');
    assert(pPong, 'PONG packet should be received from server');
    assert(pPong.timestamp, 'PONG should have server timestamp');
  });

  // Test 8: Bidirectional Client GET_STATE -> INIT_STATE over WebSocket
  ws.send(JSON.stringify({ type: 'GET_STATE' }));
  await sleep(60);
  test('Client sends GET_STATE over WS and receives refreshed INIT_STATE', () => {
    const inits = receivedPackets.filter(x => x.type === 'INIT_STATE');
    assert(inits.length >= 2, 'Should have received fresh INIT_STATE upon request');
  });

  // Test 9: Bidirectional Client CHAT_MESSAGE over WebSocket
  ws.send(JSON.stringify({
    type: 'CHAT_MESSAGE',
    data: {
      sender: 'Field Marshal WS Client',
      text: 'Direct WebSocket walkie-talkie burst test'
    }
  }));
  await sleep(60);
  test('Client sends CHAT_MESSAGE over WS and server broadcasts it', () => {
    const pChat = receivedPackets.find(x => x.type === 'CHAT_MESSAGE' && x.data && x.data.text && x.data.text.includes('Direct WebSocket walkie-talkie'));
    assert(pChat, 'CHAT_MESSAGE sent over WS should be broadcasted');
  });

  // Test 10: SQLite WAL Storage Records Query Endpoints
  const storageShiftsRes = await get('/api/system/storage/records?type=shifts');
  test('GET /api/system/storage/records?type=shifts returns ACID shifts', () => {
    assert.strictEqual(storageShiftsRes.status, 200);
    assert(storageShiftsRes.data.success);
    assert.strictEqual(storageShiftsRes.data.type, 'shifts');
    assert(Array.isArray(storageShiftsRes.data.records));
  });

  const storageTelemetryRes = await get('/api/system/storage/records?type=telemetry');
  test('GET /api/system/storage/records?type=telemetry returns sensor telemetry', () => {
    assert.strictEqual(storageTelemetryRes.status, 200);
    assert(storageTelemetryRes.data.success);
    assert.strictEqual(storageTelemetryRes.data.type, 'telemetry');
    assert(Array.isArray(storageTelemetryRes.data.records));
    assert(storageTelemetryRes.data.count > 0);
  });

  const storageAuditsRes = await get('/api/system/storage/records?type=audits');
  test('GET /api/system/storage/records?type=audits returns compliance audits', () => {
    assert.strictEqual(storageAuditsRes.status, 200);
    assert(storageAuditsRes.data.success);
    assert.strictEqual(storageAuditsRes.data.type, 'audits');
    assert(Array.isArray(storageAuditsRes.data.records));
    assert(storageAuditsRes.data.count > 0);
  });

  ws.close();

  console.log('\n================================================================');
  console.log(`  WEBSOCKET PIPELINE AUDIT COMPLETE: ${passed}/${total} PASSED (100%)`);
  console.log('================================================================\n');
}

runSuite().catch(err => {
  console.error('Fatal Test Runner Exception:', err);
  process.exit(1);
});
