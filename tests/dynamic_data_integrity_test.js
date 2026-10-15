// tests/dynamic_data_integrity_test.js
// Validates that all pages are dynamic, connected to real data streams, with zero fake mock/static placeholders

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BASE_URL = 'http://localhost:3000';

async function runDynamicDataAudit() {
  console.log('================================================================');
  console.log('  DELTA ENGINE — REAL-WORLD DYNAMIC DATA & HARDWARE AUDIT       ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  // --- SUITE 1: Signage TV Live Kiosk Display ---
  console.log('[SUITE 1] Hallway Digital Signage TV Kiosk Dynamic State');
  const signageHtml = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'signage.html'), 'utf8');

  test('Signage defaults to live kiosk display (display:block)', () => {
    assert(signageHtml.includes('id="live-signage-kiosk-view" style="display:block;"'), 'live-signage-kiosk-view should be visible by default');
  });

  test('Signage coming-soon view is hidden by default (display:none)', () => {
    assert(signageHtml.includes('id="signage-coming-soon-view" style="display:none;"'), 'signage-coming-soon-view should be hidden by default');
  });

  test('Signage contains zero "COMMING SOON" typos or fake preview flags', () => {
    assert(!signageHtml.includes('COMMING SOON'), 'Signage should have zero COMMING SOON typos');
  });

  test('Signage boots directly into showLiveKiosk()', () => {
    assert(signageHtml.includes('showLiveKiosk();'), 'Signage should invoke showLiveKiosk() on load');
  });

  // --- SUITE 2: Mobile Field Marshal Terminal Dynamic State ---
  console.log('\n[SUITE 2] Volunteer Mobile Terminal Dynamic Headcount & Egress');
  const volunteerHtml = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'volunteer.html'), 'utf8');

  test('Volunteer operator badge is dynamic (not hardcoded to Priya Sharma)', () => {
    assert(!volunteerHtml.includes('👤 Priya Sharma (Door Marshal)'), 'Operator badge should not hardcode Priya Sharma');
    assert(volunteerHtml.includes('id="vol-operator-badge"'), 'Operator badge ID must be present');
  });

  test('Volunteer zone occupancy initializes to 0 (not hardcoded 180)', () => {
    assert(!volunteerHtml.includes('<div id="vol-pax-count" class="vol-count-big">180</div>'), 'Occupancy should not hardcode 180');
    assert(volunteerHtml.includes('<div id="vol-pax-count" class="vol-count-big">0</div>'), 'Occupancy should initialize to 0');
  });

  test('Volunteer door egress rate initializes dynamically (not hardcoded 180 pax/min)', () => {
    assert(!volunteerHtml.includes('180 pax/min'), 'Flow rate should not hardcode 180 pax/min');
    assert(volunteerHtml.includes('0 pax/min'), 'Flow rate should initialize to 0 pax/min');
  });

  test('Volunteer implements rolling 60-second passage rate calculation', () => {
    assert(volunteerHtml.includes('recordPassageEvent()'), 'Should record passage events');
    assert(volunteerHtml.includes('passageTimestamps'), 'Should track passage timestamps array');
  });

  test('Volunteer syncHallState reads live CCTV and Gate Mesh occupancy', () => {
    assert(volunteerHtml.includes('data.gatesMesh?.[currentHallId]?.netOccupancy'), 'Should read gatesMesh netOccupancy');
    assert(volunteerHtml.includes('data.cctvState?.[currentHallId]?.peopleDetected'), 'Should read cctvState peopleDetected');
  });

  // --- SUITE 3: Dashboard & Admin Capacity Realism ---
  console.log('\n[SUITE 3] Venue Topologies & Target Capacity Calibration');
  const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'index.html'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'admin.html'), 'utf8');

  test('index.html initializes capacity to real Turing Hall 250 Pax (not demo 25)', () => {
    assert(indexHtml.includes('0 / 250 Pax'), 'Headcount metric must show 0 / 250 Pax');
    assert(!indexHtml.includes('0 / 25 Pax'), 'Headcount metric must not show 0 / 25 Pax');
    assert(indexHtml.includes('value="250"'), 'Capacity slider/input must default to 250');
  });

  test('admin.html initializes capacity to real Turing Hall 250 Pax (not demo 25)', () => {
    assert(adminHtml.includes('0 / 250 Pax'), 'Admin metric must show 0 / 250 Pax');
    assert(!adminHtml.includes('0 / 25 Pax'), 'Admin metric must not show 0 / 25 Pax');
    assert(adminHtml.includes('value="250"'), 'Admin input must default to 250');
  });

  test('Zero fake "+1-555" dummy phone numbers exist in admin HTML', () => {
    assert(!adminHtml.includes('+1-555'), 'Admin HTML must not contain fake +1-555 phone numbers');
  });

  // --- SUITE 4: Mesh Walkie-Talkie & Inter-Device Messaging API ---
  console.log('\n[SUITE 4] Real-Time Mesh Walkie-Talkie API Endpoints');

  await asyncTest('POST /api/messages/send dispatches and broadcasts message', async () => {
    const res = await fetch(`${BASE_URL}/api/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: 'Shahid',
        recipient: 'Aryan Pandey',
        recipientPhone: '+919154276178',
        text: 'Stage mic check complete, perimeter is nominal.'
      })
    });
    assert.strictEqual(res.status, 200, 'Status should be 200 OK');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.delivered, true);
    assert.strictEqual(data.message.sender, 'Shahid');
    assert.strictEqual(data.message.text, 'Stage mic check complete, perimeter is nominal.');
  });

  await asyncTest('GET /api/messages returns active mesh message stream', async () => {
    const res = await fetch(`${BASE_URL}/api/messages`);
    assert.strictEqual(res.status, 200, 'Status should be 200 OK');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(Array.isArray(data.messages), 'messages must be an array');
    assert(data.messages.length > 0, 'messages array should contain sent message');
  });

  // --- SUITE 5: Dynamic Volunteer Directory Rendering ---
  console.log('\n[SUITE 5] Dynamic Volunteer Directory & Duty Assignment');
  const authJs = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'components', 'auth.js'), 'utf8');
  const cctvPerceptionJs = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'components', 'cctvPerception.js'), 'utf8');

  test('auth.js exports window.renderVolunteersDutyList function', () => {
    assert(authJs.includes('window.renderVolunteersDutyList = function'), 'Must export renderVolunteersDutyList');
  });

  test('cctvPerception.js invokes renderVolunteersDutyList on venue selection change', () => {
    assert(cctvPerceptionJs.includes('window.renderVolunteersDutyList(currentVenueId)'), 'Must call renderVolunteersDutyList on venue switch');
  });

  test('cctvPerception.js implements delegated click handling for dynamic WhatsApp buttons', () => {
    assert(cctvPerceptionJs.includes('e.target.closest(\'.btn-wa-single\')'), 'Must have event delegation for dynamic .btn-wa-single elements');
  });

  console.log('\n================================================================');
  console.log(`  DYNAMIC DATA AUDIT COMPLETE: ${passed}/${total} PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runDynamicDataAudit().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
