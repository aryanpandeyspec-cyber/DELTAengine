/**
 * DELTA ENGINE — Autonomous Operations Engine
 * 
 * Implements the decoupled Detection → Action architecture:
 * 1. Telemetry Ingestion & Anomaly Detection (Deterministic)
 * 2. Incident Instantiation & Requirements Evaluation
 * 3. Downstream Impact Analysis
 * 4. Deterministic Safety Constraint Solver
 * 5. Optional Multi-Agent Swarm Enrichment (LLM with local fallback)
 * 6. Multi-Channel Action Execution & Dispatch
 * 7. Verification & Post-Action Monitoring
 */

const { createIncident, evaluateTelemetryRequirements, evaluateActionFeasibility, transitionIncidentState, COMMON_INCIDENT_TYPES, RESOLUTION_STATES } = require('./incidentModel');
const { getActiveScenario, getScenario } = require('./scenarioManager');
const { generateOperationalSwarmDialogue } = require('./agentSwarm');
const { runSelfHealingAgent } = require('./selfHealing');

/**
 * 1. DETECTION: Analyzes raw telemetry against physical thresholds
 */
function detectIncidentsFromTelemetry(telemetry = {}, db, customScenario = null) {
  const scenario = customScenario || getActiveScenario();
  const zoneId = telemetry.zoneId || telemetry.hallId || 'hall-1';
  const zone = (db && db.getZone && db.getZone(zoneId)) || 
               scenario.zones.find(z => z.id === zoneId) || 
               { id: zoneId, name: 'Main Venue', capacity: 250 };

  const currentCount = parseInt(telemetry.peopleDetected ?? telemetry.netOccupancy ?? telemetry.occupancy ?? 0, 10);
  const targetCap = parseInt(telemetry.capacity || zone.capacity || 250, 10);
  const flowRate = parseInt(telemetry.flowRate || telemetry.entryRate || 0, 10);
  const maxFlow = parseInt(telemetry.flowRateMax || 300, 10);

  const incidents = [];

  // Check 1: Capacity Breach (>100%)
  if (currentCount > targetCap) {
    const overflowCount = currentCount - targetCap;
    const incident = createIncident({
      eventType: scenario.id,
      incidentType: COMMON_INCIDENT_TYPES.OVER_CAPACITY,
      location: {
        zoneId: zone.id,
        zoneName: zone.name,
        venueId: scenario.venue.id,
        venueName: scenario.venue.name
      },
      currentOccupancy: currentCount,
      capacity: targetCap,
      severity: currentCount >= targetCap * 1.2 ? 'emergency' : 'critical',
      potentialImpact: `Excess of ${overflowCount} people in ${zone.name}. Risk of egress blockage, spatial compression, and safety hazard.`,
      requiredTelemetry: ['zone_occupancy', 'zone_capacity'],
      optionalTelemetry: ['cctv_facial_variance', 'entry_rate'],
      source: telemetry.source || 'CCTV_HEAD_PERCEPTION',
      description: `Critical Capacity Breach: ${zone.name} is at ${Math.round((currentCount / targetCap) * 100)}% capacity (${currentCount}/${targetCap} pax).`
    });
    incidents.push(incident);
  }
  // Check 2: Near Capacity Warning (80% - 99%)
  else if (currentCount >= Math.round(targetCap * 0.8) && currentCount <= targetCap) {
    const incident = createIncident({
      eventType: scenario.id,
      incidentType: COMMON_INCIDENT_TYPES.OVER_CAPACITY,
      location: {
        zoneId: zone.id,
        zoneName: zone.name,
        venueId: scenario.venue.id,
        venueName: scenario.venue.name
      },
      currentOccupancy: currentCount,
      capacity: targetCap,
      severity: 'warning',
      potentialImpact: `Zone is nearing critical threshold (${Math.round((currentCount / targetCap) * 100)}%). Influx without queue regulation will cause breach.`,
      requiredTelemetry: ['zone_occupancy', 'zone_capacity'],
      source: telemetry.source || 'CCTV_HEAD_PERCEPTION',
      description: `Near-Capacity Warning: ${zone.name} is ${Math.round((currentCount / targetCap) * 100)}% full (${currentCount}/${targetCap} pax).`
    });
    incidents.push(incident);
  }

  // Check 3: Entry Gate Bottleneck (Rate exceeds safe limit)
  if (flowRate > maxFlow && maxFlow > 0) {
    const incident = createIncident({
      eventType: scenario.id,
      incidentType: COMMON_INCIDENT_TYPES.ENTRY_BOTTLENECK,
      location: {
        zoneId: zone.id,
        zoneName: zone.name,
        venueId: scenario.venue.id,
        venueName: scenario.venue.name
      },
      currentOccupancy: currentCount,
      capacity: targetCap,
      severity: 'critical',
      potentialImpact: `Ingress flow rate of ${flowRate} pax/min exceeds gate design limit of ${maxFlow} pax/min. Crowd crush risk at turnstiles.`,
      requiredTelemetry: ['entry_flow_rate', 'gate_turnstile_status'],
      source: telemetry.source || 'IOT_LASER_TOF',
      description: `Gate Congestion Spike: ${zone.name} entry flow rate (${flowRate} pax/min) exceeds limit (${maxFlow} pax/min).`
    });
    incidents.push(incident);
  }

  return incidents;
}

/**
 * 2. IMPACT ASSESSMENT: Identifies downstream consequences on the spatial graph
 */
function assessOperationalImpact(incident, db, scenario = null) {
  const sc = scenario || getScenario(incident.eventType);
  const zoneId = incident.location.zoneId;

  // Query connected zones from spatial graph
  const connectedZones = db && db.getConnectedZones ? db.getConnectedZones(zoneId) : [];
  const availableAlt = db && db.findAlternativeZone ? db.findAlternativeZone(zoneId, incident.currentOccupancy) : null;

  const affectedEntities = [
    { id: zoneId, type: 'ZONE', name: incident.location.zoneName, status: 'CONGESTED' }
  ];

  connectedZones.forEach(z => {
    affectedEntities.push({
      id: z.id,
      type: 'CONNECTED_ZONE',
      name: z.name,
      status: 'RECEIVING_SPILLOVER'
    });
  });

  let potentialImpact = incident.potentialImpact;
  if (incident.incidentType === COMMON_INCIDENT_TYPES.OVER_CAPACITY) {
    if (sc.id === 'CONFERENCE') {
      potentialImpact = `Auditorium fire code exceeded. Downstream keynote schedule will face session delay if talk is not reallocated.`;
    } else if (sc.id === 'PUBLIC_RALLY') {
      potentialImpact = `Perimeter crowd pressure building on front stage barriers. East Overflow Park activation required immediately.`;
    } else if (sc.id === 'LARGE_GATHERING') {
      potentialImpact = `Central walkway bottleneck restricts emergency ambulance corridor. Diversion to secondary entry required.`;
    } else if (sc.id === 'MOVIE_PROMO') {
      potentialImpact = `Atrium floor density compressing ground ring. Escalator ingress must be locked to prevent crush.`;
    } else if (sc.id === 'RELIGIOUS_GATHERING') {
      potentialImpact = `Riverfront ghat stairs slip risk. Water edge rope-line and holding pen batch release must be enforced.`;
    }
  }

  incident.affectedEntities = affectedEntities;
  incident.potentialImpact = potentialImpact;

  return incident;
}

/**
 * 3. LOCAL DETERMINISTIC CONSTRAINT SOLVER: Calculates optimal operational action
 */
function solveOperationalAction(incident, db, scenario = null) {
  const sc = scenario || getScenario(incident.eventType);
  const zoneId = incident.location.zoneId;
  const currentCount = incident.currentOccupancy;

  let recommendedAction = null;
  const availableActions = [];

  // Determine personnel assigned to this zone
  const personnel = db && db.getPersonnelForZone ? db.getPersonnelForZone(zoneId) : (sc.personnel || []);
  const alternativeZone = db && db.findAlternativeZone ? db.findAlternativeZone(zoneId, currentCount) : null;

  if (incident.eventType === 'CONFERENCE' && incident.incidentType === COMMON_INCIDENT_TYPES.OVER_CAPACITY) {
    // Conference overflow: Reallocate talk to larger hall
    const targetHall = alternativeZone || { id: 'hall-1', name: 'Turing Hall', capacity: 250 };
    recommendedAction = {
      id: 'act_' + Date.now(),
      type: 'REALLOCATE_VENUE',
      title: `Reallocate Session to ${targetHall.name}`,
      details: `Shift overflowing talk to ${targetHall.name} (Capacity: ${targetHall.capacity} pax).`,
      targetZoneId: targetHall.id,
      targetZoneName: targetHall.name,
      assignedPersonnel: personnel.slice(0, 2),
      requiredResources: ['res_av_4k', 'res_signage'],
      requiredRoles: ['coordinator', 'lead']
    };
    availableActions.push(recommendedAction);
    availableActions.push({
      id: 'act_halt_conf',
      type: 'HALT_ADMISSIONS',
      title: `Halt Further Admissions to ${incident.location.zoneName}`,
      details: `Position doorway volunteer to cap admissions at ${incident.capacity} pax.`
    });
  } else if (incident.eventType === 'PUBLIC_RALLY') {
    // Rally overflow: Activate East Overflow Park + Reroute via South Gate
    recommendedAction = {
      id: 'act_' + Date.now(),
      type: 'ACTIVATE_OVERFLOW',
      title: 'Open East Overflow Park with LED Relay & Reroute Traffic',
      details: 'Divert incoming crowd from North Gate to South Concourse and activate 4K LED Screen Trucks in East Overflow Park.',
      targetZoneId: 'rally-overflow',
      targetZoneName: 'East Overflow Park & Screenings',
      assignedPersonnel: personnel,
      requiredResources: ['res_barricades_heavy', 'res_loudspeaker_pa'],
      requiredRoles: ['marshal', 'commander']
    };
    availableActions.push(recommendedAction);
    availableActions.push({
      id: 'act_throttle_rally',
      type: 'RESTRICT_INGRESS',
      title: 'Throttle North Gate Turnstiles to 150 pax/min',
      details: 'Slow admissions rate to prevent surge pressure on central lawns.'
    });
  } else if (incident.eventType === 'LARGE_GATHERING') {
    // Mela / Fair bottleneck: Divert to East Gate Plaza + Clear Central Promenade
    recommendedAction = {
      id: 'act_' + Date.now(),
      type: 'REROUTE_CROWD',
      title: 'Divert Ingress to East Gate Plaza & Clear Central Promenade',
      details: 'Activate dynamic gate status signage, throttle West Gate ticketing, and clear central fire lane.',
      targetZoneId: 'fair-promenade',
      targetZoneName: 'Central Boulevard & Promenade',
      assignedPersonnel: personnel,
      requiredResources: ['res_stanchions', 'res_gate_displays'],
      requiredRoles: ['marshal', 'safety']
    };
    availableActions.push(recommendedAction);
  } else if (incident.eventType === 'MOVIE_PROMO') {
    // Movie Promo atrium surge: Lock Escalator L1 & Route Fans to Upper Rings
    recommendedAction = {
      id: 'act_' + Date.now(),
      type: 'LOCK_INGRESS',
      title: 'Lock Ground-to-L1 Escalator & Guide Crowd to Levels 2 & 3',
      details: 'Halt ground atrium compression, enforce red carpet buffer, and route arriving public to upper gallery rings.',
      targetZoneId: 'promo-gallery-l2',
      targetZoneName: 'Viewing Ring Level 2 & 3',
      assignedPersonnel: personnel,
      requiredResources: ['res_velvet_barriers', 'res_security_radios'],
      requiredRoles: ['security', 'marshal']
    };
    availableActions.push(recommendedAction);
  } else if (incident.eventType === 'RELIGIOUS_GATHERING') {
    // Pilgrimage / Ghats surge: Phased batch release from Holding Pen + Cordon Lower Steps
    recommendedAction = {
      id: 'act_' + Date.now(),
      type: 'BATCH_RELEASE',
      title: 'Release Holding Pen in Phased 500-Person Batches & Cordon Water Edge',
      details: 'Enforce one-way flow on East Footbridge, pause Holding Pen Alpha gate, and deploy volunteer rope-line on lower river steps.',
      targetZoneId: 'pen-alpha',
      targetZoneName: 'Holding Pen Alpha & River Steps',
      assignedPersonnel: personnel,
      requiredResources: ['res_bamboo_ballis', 'res_water_rescue'],
      requiredRoles: ['magistrate', 'safety', 'marshal']
    };
    availableActions.push(recommendedAction);
  } else {
    // Generic fallback action
    recommendedAction = {
      id: 'act_' + Date.now(),
      type: 'REGULATE_FLOW',
      title: `Regulate Crowd Flow in ${incident.location.zoneName}`,
      details: `Throttle ingress and deploy operations team to maintain safe occupant density.`,
      targetZoneId: incident.location.zoneId,
      targetZoneName: incident.location.zoneName,
      assignedPersonnel: personnel
    };
    availableActions.push(recommendedAction);
  }

  incident.availableActions = availableActions;
  incident.recommendedAction = recommendedAction;
  incident.assignedPersonnel = personnel;

  return { incident, recommendedAction, availableActions };
}

/**
 * 4. ACTION EXECUTION & DISPATCH: Executes the decision and broadcasts across channels
 */
async function executeOperationalAction(incident, action, db, broadcast, options = {}) {
  transitionIncidentState(incident, RESOLUTION_STATES.ACTION_DISPATCHED, `Action selected: ${action ? action.title : 'Standard Mitigation'}`);

  // Evaluate requirements model
  const availableTelemetry = (db && db.telemetrySources) || ['zone_occupancy', 'zone_capacity', 'cctv_facial_variance'];
  const telemetryEval = evaluateTelemetryRequirements(incident, availableTelemetry);

  const availableResources = (db && db.graph && db.graph.resources) ? Object.values(db.graph.resources) : [];
  const actionFeasibility = evaluateActionFeasibility(action, availableResources, incident.assignedPersonnel);

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Optional Multi-Agent Swarm Enrichment
  let swarmChat = null;
  try {
    swarmChat = await generateOperationalSwarmDialogue(incident, action, db);
  } catch (err) {
    console.warn('[Operations Engine Swarm]: Falling back to local dialogue:', err.message);
  }

  // Construct Notification Message
  const notificationMsg = `[OPERATIONAL ACTION EXECUTED] ${action ? action.title : 'Crowd safety regulation active'} in ${incident.location.zoneName}. State: ${incident.resolutionState}.`;

  const notifications = [
    {
      id: 'notif_' + Date.now(),
      type: incident.severity === 'emergency' || incident.severity === 'critical' ? 'critical' : 'warning',
      message: notificationMsg,
      incidentId: incident.id,
      timestamp: timeStr
    }
  ];

  // Record incident in graph database
  if (db && db.recordIncident) {
    db.recordIncident(incident);
  }

  // Multi-Channel WebSocket Broadcast
  if (typeof broadcast === 'function') {
    broadcast({
      type: 'OPERATIONAL_INCIDENT_RESOLVED',
      data: {
        incident,
        action,
        swarmChat,
        notifications,
        telemetryEval,
        actionFeasibility,
        timestamp: timeStr
      }
    });

    broadcast({
      type: 'ADMIN_AUDIT',
      data: {
        message: `🛡️ [OPERATIONS ENGINE] Resolved ${incident.incidentType} in ${incident.location.zoneName} (${incident.occupancyRate}% Density). Action: ${action ? action.title : 'Mitigation complete'}.`,
        time: timeStr,
        action: action ? action.type : 'MITIGATE'
      }
    });
  }

  // Verification step: Transition to MONITORING or RESOLVED
  transitionIncidentState(incident, RESOLUTION_STATES.RESOLVED, 'Mitigation dispatched cleanly. Venue operating within safety envelope.');

  return {
    success: true,
    incident,
    action,
    swarmChat,
    notifications,
    telemetryEval,
    actionFeasibility
  };
}

/**
 * End-to-End Orchestrator: Ingests telemetry, detects incident, solves action, and dispatches
 */
async function processOperationalTelemetry(telemetry = {}, db, broadcast, options = {}) {
  const scenario = options.scenario || (options.scenarioId ? getScenario(options.scenarioId) : getActiveScenario());
  
  // 1. Detection
  const incidents = detectIncidentsFromTelemetry(telemetry, db, scenario);
  if (incidents.length === 0) {
    return { detected: false, message: 'Telemetry within normal operational thresholds.' };
  }

  const primaryIncident = incidents[0];

  // 2. Impact Assessment
  assessOperationalImpact(primaryIncident, db, scenario);

  // 3. Solution
  const { recommendedAction } = solveOperationalAction(primaryIncident, db, scenario);

  // 4. Execution & Verification
  const executionReport = await executeOperationalAction(primaryIncident, recommendedAction, db, broadcast, options);

  return {
    detected: true,
    incident: primaryIncident,
    action: recommendedAction,
    ...executionReport
  };
}

/**
 * Backward compatibility wrapper for Conference Self-Healing
 */
async function handleConferenceSelfHealing(eventDescription, db, broadcast, options = {}) {
  return await runSelfHealingAgent(eventDescription, db, broadcast, options);
}

module.exports = {
  detectIncidentsFromTelemetry,
  assessOperationalImpact,
  solveOperationalAction,
  executeOperationalAction,
  processOperationalTelemetry,
  handleConferenceSelfHealing
};
