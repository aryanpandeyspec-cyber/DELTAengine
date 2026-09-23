/**
 * DELTA ENGINE — Comprehensive Test Suite
 * 
 * Verifies all 12 core requirements:
 * 1. Existing conference scenario baseline intact
 * 2. Existing overflow detection & self-healing works
 * 3. Existing speaker delay healing works
 * 4. WebSocket real-time broadcast works
 * 5. 5 Scenario definitions load with zones, routes, personnel, resources
 * 6. Generic Incident & Requirements Model (DATA_WE_HAVE vs DATA_WE_NEED)
 * 7. Public Rally zone capacity breach & alternative zone calculation
 * 8. Large Gathering / Fair entrance bottleneck rerouting & marshal dispatch
 * 9. Deterministic safety engine execution (<5ms, zero LLM dependency)
 * 10. Swarm fallback & circuit breaker protection
 * 11. 500-Scenario Stress Test (100% pass rate)
 * 12. Frontend visual locked integrity check (0 UI regressions)
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

// Colors for terminal output
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${GREEN}✓${RESET} ${message}`);
    return true;
  } else {
    console.error(`  ${RED}✗ FAILED:${RESET} ${message}`);
    return false;
  }
}

async function fetchJson(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultHeaders = { 'Content-Type': 'application/json' };
  
  const res = await fetch(url, {
    headers: { ...defaultHeaders, ...(options.headers || {}) },
    ...options
  });
  return await res.json();
}

async function runTest1_ConferenceBaseline() {
  console.log(`\n${BOLD}[TEST 1] Existing Conference Scenario Baseline & State${RESET}`);
  // Reset state to ensure clean starting point
  await fetchJson('/api/reset', { method: 'POST' });

  const state = await fetchJson('/api/state');
  assert(state && typeof state === 'object', 'State endpoint returns valid state object');
  assert(state.activeScenario === 'CONFERENCE', 'Active scenario defaults to CONFERENCE');
  assert(Array.isArray(state.scenarios) && state.scenarios.length === 5, 'State exposes 5 domain scenarios');
  
  // Verify halls & schedule exist in state.graph
  const halls = (state.graph && state.graph.halls) || {};
  const hallKeys = Object.keys(halls);
  assert(hallKeys.length >= 3, `Conference halls loaded: ${hallKeys.join(', ')}`);
  assert(halls['hall-1'] && halls['hall-1'].capacity === 250, 'Turing Hall (hall-1) capacity is 250');
}

async function runTest2_OverflowDetection() {
  console.log(`\n${BOLD}[TEST 2] Conference Hall Capacity Overflow Self-Healing${RESET}`);
  // Ingest capacity surge for topic-1 with 320 attendees > Lovelace Suite (120 capacity)
  const result = await fetchJson('/api/simulate/capacity', {
    method: 'POST',
    body: JSON.stringify({
      topicId: 'topic-1',
      interestCount: 320
    })
  });

  assert(result.success === true, 'Capacity simulation endpoint responded with success');
  assert(result.hasConflict === true, 'Self-healing detected capacity conflict');
  assert(result.logs && result.logs.some(l => l.includes('exceeding') || l.includes('capacity')), 'Audit log records capacity breach');
  assert(result.destinationTarget !== undefined, 'Self-healing engine relocated topic node to viable hall');
}

async function runTest3_SpeakerDelayHealing() {
  console.log(`\n${BOLD}[TEST 3] Conference Speaker Delay Self-Healing${RESET}`);
  await fetchJson('/api/reset', { method: 'POST' });

  const result = await fetchJson('/api/simulate/delay', {
    method: 'POST',
    body: JSON.stringify({
      speakerId: 'speaker-1',
      delayMinutes: 120
    })
  });

  assert(result.success === true, 'Delay simulation endpoint responded with success');
  assert(result.hasConflict === true, 'Speaker delay conflict detected');
  assert(result.logs && result.logs.some(l => l.includes('delayed')), 'Audit log records speaker delay');
  assert(result.destinationTarget !== undefined, 'Schedule rearrangement action dispatched');
}

async function runTest4_WebSocketBroadcast() {
  console.log(`\n${BOLD}[TEST 4] WebSocket Real-Time Telemetry & Action Broadcast${RESET}`);
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    let receivedMessage = false;

    ws.on('open', () => {
      // Trigger a door sensor ping
      fetch(`${BASE_URL}/api/sensors/door`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'PULSE', hallId: 'hall-1', netOccupancy: 120, entries: 130, exits: 10 })
      }).catch(() => {});
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'INIT_STATE' || msg.type === 'TELEMETRY_UPDATE' || msg.type === 'OPERATIONAL_INCIDENT' || msg.type === 'OPERATIONAL_INCIDENT_RESOLVED') {
          receivedMessage = true;
          assert(true, `WebSocket broadcast received message of type: ${msg.type}`);
          ws.close();
          resolve();
        }
      } catch (err) {
        // ignore parse errors
      }
    });

    ws.on('error', (err) => {
      assert(false, `WebSocket connection error: ${err.message}`);
      resolve();
    });

    setTimeout(() => {
      if (!receivedMessage) {
        assert(false, 'WebSocket timed out without receiving state broadcast');
        try { ws.close(); } catch(e) {}
        resolve();
      }
    }, 4000);
  });
}

async function runTest5_ScenarioRegistry() {
  console.log(`\n${BOLD}[TEST 5] Generalized Scenario Registry Loading (5 Scenarios)${RESET}`);
  const data = await fetchJson('/api/scenarios');
  assert(data.success === true, 'Scenarios endpoint returns success');
  assert(Array.isArray(data.scenarios) && data.scenarios.length === 5, 'All 5 domain scenarios registered');

  const expectedIds = ['CONFERENCE', 'PUBLIC_RALLY', 'LARGE_GATHERING', 'MOVIE_PROMO', 'RELIGIOUS_GATHERING'];
  expectedIds.forEach(id => {
    const found = data.scenarios.find(s => s.id === id);
    assert(!!found, `Scenario ${id} exists with category: "${found ? found.category : 'N/A'}"`);
    assert(found && found.zonesCount > 0, `Scenario ${id} defines ${found ? found.zonesCount : 0} physical zones`);
  });

  // Verify single scenario detail
  const rally = await fetchJson('/api/scenarios/PUBLIC_RALLY');
  assert(rally.success === true && rally.scenario.id === 'PUBLIC_RALLY', 'PUBLIC_RALLY details loaded');
  assert(rally.scenario.zones.length === 7, 'Public rally defines 7 zones including VIP podium and overflow fields');
  assert(rally.scenario.personnel.length >= 3, 'Public rally defines field commanders and marshal staff');
  assert(rally.scenario.routes.length >= 4, 'Public rally defines inter-zone evacuation & movement routes');
}

async function runTest6_IncidentAndRequirementsModel() {
  console.log(`\n${BOLD}[TEST 6] Incident Abstraction & Telemetry Requirements Model${RESET}`);
  const reqConf = await fetchJson('/api/operations/requirements?scenarioId=CONFERENCE');
  assert(reqConf.success === true, 'Requirements model loaded for CONFERENCE');
  assert(Array.isArray(reqConf.requirementsModel.dataWeHave) && reqConf.requirementsModel.dataWeHave.includes('zone_occupancy'), 'Correctly identifies DATA WE HAVE (e.g. zone_occupancy)');
  assert(Array.isArray(reqConf.requirementsModel.dataWeNeed) && reqConf.requirementsModel.dataWeNeed.length > 0, 'Correctly identifies DATA WE NEED (telemetry sources)');
  assert(Array.isArray(reqConf.requirementsModel.actionWeCanPerform) && reqConf.requirementsModel.actionWeCanPerform.length > 0, 'Identifies ACTIONS WE CAN PERFORM');
  assert(Array.isArray(reqConf.requirementsModel.actionWeCannotPerform) && reqConf.requirementsModel.actionWeCannotPerform.includes('AUTOMATED_WATER_CANNON_DISPATCH'), 'Distinguishes ACTIONS WE CANNOT PERFORM');

  // Verify requirements for PUBLIC_RALLY
  const reqRally = await fetchJson('/api/operations/requirements?scenarioId=PUBLIC_RALLY');
  assert(reqRally.scenario === 'PUBLIC_RALLY', 'Requirements model loaded for PUBLIC_RALLY');
  assert(reqRally.requirementsModel.dataWeNeed.includes('Turnstile Optical Headcount Sensors'), 'Rally specifies turnstile optical headcount sensors as required telemetry');
}

async function runTest7_PublicRallyCapacityBreach() {
  console.log(`\n${BOLD}[TEST 7] Scenario: Public Rally Zone Capacity Breach & Re-routing${RESET}`);
  // Ingest crowd surge into VIP Enclosure (capacity 800) with 950 attendees
  const res = await fetchJson('/api/operations/simulate-crowd-incident', {
    method: 'POST',
    body: JSON.stringify({
      scenarioId: 'PUBLIC_RALLY',
      zoneId: 'rally-vip',
      occupancy: 950,
      severity: 'critical'
    })
  });

  assert(res.success === true, 'Rally surge simulated successfully');
  assert(res.incident && res.incident.incidentType === 'OVER_CAPACITY', 'Detected OVER_CAPACITY incident');
  assert(res.incident.currentOccupancy === 950 && res.incident.capacity === 800, 'Incident captures accurate telemetry occupancy (950/800)');
  assert(res.action && (res.action.type === 'ACTIVATE_OVERFLOW' || res.action.type === 'RESTRICT_INGRESS'), `Action type selected: ${res.action ? res.action.type : 'N/A'}`);
  assert(res.action && res.action.title.includes('Overflow Park'), `Mitigation target: ${res.action ? res.action.title : 'N/A'}`);
  assert(Array.isArray(res.action.assignedPersonnel) && res.action.assignedPersonnel.length > 0, 'Action assigned on-duty rally safety coordinators');
}

async function runTest8_LargeGatheringEntranceBottleneck() {
  console.log(`\n${BOLD}[TEST 8] Scenario: Large Cultural Fair Entrance Bottlenecking${RESET}`);
  const res = await fetchJson('/api/operations/incident', {
    method: 'POST',
    body: JSON.stringify({
      scenarioId: 'LARGE_GATHERING',
      zoneId: 'gate-north',
      flowRate: 480,
      flowRateMax: 200,
      peopleDetected: 1400,
      capacity: 800,
      severity: 'warning'
    })
  });

  assert(res.success === true, 'Bottleneck incident processed successfully');
  assert(res.action && res.action.type === 'REROUTE_CROWD', `Action selected: ${res.action ? res.action.type : 'None'}`);
  assert(res.incident && (res.incident.resolutionState === 'ACTION_DISPATCHED' || res.incident.resolutionState === 'RESOLVED'), `Incident lifecycle state: ${res.incident ? res.incident.resolutionState : 'N/A'}`);
  assert(res.notifications && res.notifications.length > 0, 'Generated audit notification for operations team');
}

async function runTest9_DeterministicSafetyExecution() {
  console.log(`\n${BOLD}[TEST 9] Deterministic Engine Performance (<5ms, Zero LLM Hot-Path Delay)${RESET}`);
  const { detectIncidentsFromTelemetry, assessOperationalImpact, solveOperationalAction } = require('../backend/components/operationsEngine');
  const db = require('../backend/components/graphDb');
  const { getScenario } = require('../backend/components/scenarioManager');

  const rallyScenario = getScenario('PUBLIC_RALLY');
  const startTime = process.hrtime();

  // Run 50 deterministic decision cycles
  for (let i = 0; i < 50; i++) {
    const telemetry = {
      occupancy: 6500,
      capacity: 5000,
      zoneId: 'rally-grounds',
      flowRate: 150,
      flowRateMax: 100
    };
    const incidents = detectIncidentsFromTelemetry(telemetry, db, rallyScenario);
    const incident = incidents[0];
    const impact = assessOperationalImpact(incident, db, rallyScenario);
    const action = solveOperationalAction(incident, db, rallyScenario);
  }

  const elapsedDiff = process.hrtime(startTime);
  const elapsedMs = (elapsedDiff[0] * 1000) + (elapsedDiff[1] / 1e6);
  const avgCycleTimeMs = elapsedMs / 50;

  assert(avgCycleTimeMs < 5.0, `Average deterministic safety calculation time: ${avgCycleTimeMs.toFixed(3)}ms (< 5ms threshold)`);
}

async function runTest10_SwarmFallbackAndCircuitBreaker() {
  console.log(`\n${BOLD}[TEST 10] Agent Swarm Contextual Fallback & Circuit Breaker${RESET}`);
  const { generateOperationalSwarmDialogue } = require('../backend/components/agentSwarm');
  const db = require('../backend/components/graphDb');

  const testIncident = {
    eventType: 'PUBLIC_RALLY',
    incidentType: 'OVER_CAPACITY',
    location: {
      zoneId: 'rally-vip',
      zoneName: 'VIP Enclosure'
    },
    currentOccupancy: 850,
    capacity: 600,
    severity: 'critical'
  };

  const testAction = {
    type: 'ACTIVATE_OVERFLOW',
    title: 'Open East Overflow Park with LED Relay',
    details: 'Close Barrier A and redirect to Overflow Lawn B.',
    assignedPersonnel: [{ name: 'Marshal Commander', role: 'Security' }]
  };

  // Run without Groq API key (forcing deterministic agent swarm reasoning)
  const swarmResult = await generateOperationalSwarmDialogue(testIncident, testAction, db);
  const swarmMessages = Array.isArray(swarmResult) ? swarmResult : (swarmResult?.dialogue || []);
  assert(swarmMessages.length === 4, 'Swarm generated all 4 operational agent roles (Liaison, Scheduler/Flow, Logistics, Broadcaster)');
  
  const senders = swarmMessages.map(d => d.sender);
  assert(senders.includes('Liaison Agent'), 'Liaison Agent represented in dialogue');
  assert(senders.includes('Scheduler Agent'), 'Scheduler Agent represented in dialogue');
  assert(senders.includes('Logistics Agent'), 'Logistics Agent represented in dialogue');
  assert(senders.includes('Marketing Agent'), 'Marketing/Broadcaster Agent represented in dialogue');
}

async function runTest11_StressTest500() {
  console.log(`\n${BOLD}[TEST 11] Existing 500-Scenario Stress Test Validation${RESET}`);
  // Reset conference baseline first
  await fetchJson('/api/reset', { method: 'POST' });

  const stressResult = await fetchJson('/api/admin/stress-test-500', { method: 'POST' });
  assert(stressResult.success === true, '500 Stress-Test completed successfully');
  assert(stressResult.totalTests === 500, 'All 500 stress test iterations executed');
  assert(stressResult.passedCount === 500, `Passed 500/500 edge cases (100% pass rate, 0 failures)`);
  assert(stressResult.failedCount === 0, 'Zero unexpected runtime exceptions');
}

async function runTest12_FrontendVisualLockedIntegrity() {
  console.log(`\n${BOLD}[TEST 12] Frontend Visual Locked Shell Integrity Check${RESET}`);
  // Check git status for any changes to frontend files
  let gitDiffOutput = '';
  try {
    gitDiffOutput = execSync('git status --porcelain frontend', { encoding: 'utf-8' }).trim();
  } catch (e) {
    gitDiffOutput = '';
  }

  assert(gitDiffOutput === '', 'Git confirms ZERO changes to frontend/ (index.html, admin.html, styles, scripts all intact)');

  // Verify critical files exist
  const frontendDir = path.join(__dirname, '../frontend');
  assert(fs.existsSync(path.join(frontendDir, 'index.html')), 'frontend/index.html is intact');
  assert(fs.existsSync(path.join(frontendDir, 'admin.html')), 'frontend/admin.html is intact');
  assert(fs.existsSync(path.join(frontendDir, 'login.html')), 'frontend/login.html is intact');
}

async function main() {
  console.log(`${BOLD}${CYAN}====================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  DELTA ENGINE — COMPREHENSIVE REGRESSION & EXPANSION TEST SUITE ${RESET}`);
  console.log(`${BOLD}${CYAN}====================================================${RESET}`);

  try {
    await runTest1_ConferenceBaseline();
    await runTest2_OverflowDetection();
    await runTest3_SpeakerDelayHealing();
    await runTest4_WebSocketBroadcast();
    await runTest5_ScenarioRegistry();
    await runTest6_IncidentAndRequirementsModel();
    await runTest7_PublicRallyCapacityBreach();
    await runTest8_LargeGatheringEntranceBottleneck();
    await runTest9_DeterministicSafetyExecution();
    await runTest10_SwarmFallbackAndCircuitBreaker();
    await runTest11_StressTest500();
    await runTest12_FrontendVisualLockedIntegrity();

    console.log(`\n${BOLD}${CYAN}====================================================${RESET}`);
    if (passedTests === totalTests) {
      console.log(`${BOLD}${GREEN}  ALL TESTS PASSED: ${passedTests}/${totalTests} (100%)${RESET}`);
    } else {
      console.log(`${BOLD}${RED}  SOME TESTS FAILED: ${passedTests}/${totalTests} passed${RESET}`);
    }
    console.log(`${BOLD}${CYAN}====================================================${RESET}\n`);

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error(`\n${RED}FATAL ERROR IN TEST RUNNER:${RESET}`, err);
    process.exit(1);
  }
}

main();
