/**
 * DELTA ENGINE — Problem → Action Operational Model
 * 
 * Generalizes incident management for high-footfall venues:
 * PROBLEM / INCIDENT
 *         ↓
 * WHAT IS HAPPENING?
 *         ↓
 * WHO / WHAT IS AFFECTED?
 *         ↓
 * WHAT COULD BE AFFECTED NEXT?
 *         ↓
 * WHAT CAN DELTA DO?
 *         ↓
 * WHAT INFORMATION / TELEMETRY IS REQUIRED?
 *         ↓
 * WHAT ACTION SHOULD BE EXECUTED?
 *         ↓
 * WHO / WHAT SHOULD RECEIVE THE ACTION?
 *         ↓
 * VERIFY WHETHER THE INCIDENT IS RESOLVED
 */

const SEVERITY_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
  EMERGENCY: 'emergency'
};

const RESOLUTION_STATES = {
  DETECTED: 'DETECTED',
  EVALUATING: 'EVALUATING',
  ACTION_DISPATCHED: 'ACTION_DISPATCHED',
  MONITORING: 'MONITORING',
  RESOLVED: 'RESOLVED'
};

const COMMON_INCIDENT_TYPES = {
  OVER_CAPACITY: 'OVER_CAPACITY',
  ENTRY_BOTTLENECK: 'ENTRY_BOTTLENECK',
  UNEXPECTED_CROWD_SURGE: 'UNEXPECTED_CROWD_SURGE',
  STAGE_PERIMETER_BREACH: 'STAGE_PERIMETER_BREACH',
  FLOW_RESTRICTION: 'FLOW_RESTRICTION',
  SCHEDULE_CLASH: 'SCHEDULE_CLASH',
  SPEAKER_DELAY: 'SPEAKER_DELAY',
  HVAC_CLIMATE_SURGE: 'HVAC_CLIMATE_SURGE',
  AUDIO_HARDWARE_FAILURE: 'AUDIO_HARDWARE_FAILURE'
};

/**
 * Creates a normalized Operational Incident instance
 */
function createIncident(params = {}) {
  const now = new Date();
  const id = params.id || `inc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const currentOccupancy = parseInt(params.currentOccupancy, 10) || 0;
  const capacity = parseInt(params.capacity, 10) || 1;
  const occupancyRate = Math.min(300, Math.round((currentOccupancy / capacity) * 100));

  let calculatedSeverity = params.severity;
  if (!calculatedSeverity) {
    if (occupancyRate >= 120) calculatedSeverity = SEVERITY_LEVELS.EMERGENCY;
    else if (occupancyRate >= 95) calculatedSeverity = SEVERITY_LEVELS.CRITICAL;
    else if (occupancyRate >= 80) calculatedSeverity = SEVERITY_LEVELS.WARNING;
    else calculatedSeverity = SEVERITY_LEVELS.INFO;
  }

  return {
    id,
    eventType: params.eventType || 'CONFERENCE',
    incidentType: params.incidentType || COMMON_INCIDENT_TYPES.OVER_CAPACITY,
    location: {
      zoneId: params.location?.zoneId || params.zoneId || 'zone-1',
      zoneName: params.location?.zoneName || params.zoneName || 'Main Area',
      venueId: params.location?.venueId || params.venueId || 'venue-1',
      venueName: params.location?.venueName || params.venueName || 'DELTA Main Complex'
    },
    currentOccupancy,
    capacity,
    occupancyRate,
    severity: calculatedSeverity,
    affectedEntities: params.affectedEntities || [],
    potentialImpact: params.potentialImpact || 'Potential crowding and safety margin compression in immediate zone.',
    availableActions: params.availableActions || [],
    requiredTelemetry: params.requiredTelemetry || ['zone_occupancy', 'zone_capacity'],
    optionalTelemetry: params.optionalTelemetry || ['cctv_facial_variance', 'queue_length'],
    requiredInfrastructure: params.requiredInfrastructure || ['directional_barriers', 'notification_system'],
    recommendedAction: params.recommendedAction || null,
    assignedPersonnel: params.assignedPersonnel || [],
    notificationChannels: params.notificationChannels || ['WHATSAPP', 'EMAIL', 'WEBSOCKET_BROADCAST'],
    resolutionState: params.resolutionState || RESOLUTION_STATES.DETECTED,
    source: params.source || 'IOT_LASER_TOF',
    timestamp: params.timestamp || now.toISOString(),
    formattedTime: params.formattedTime || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    auditTrail: [
      {
        state: RESOLUTION_STATES.DETECTED,
        timestamp: now.toISOString(),
        note: params.description || `Incident detected: ${params.incidentType || 'OVER_CAPACITY'}`
      }
    ]
  };
}

/**
 * Requirements Model: Evaluates DATA_WE_HAVE vs DATA_WE_NEED
 */
function evaluateTelemetryRequirements(incident, availableTelemetrySources = []) {
  const availableSet = new Set((availableTelemetrySources || []).map(s => s.toLowerCase()));
  const required = incident.requiredTelemetry || [];
  const optional = incident.optionalTelemetry || [];

  const satisfiedRequired = required.filter(item => availableSet.has(item.toLowerCase()));
  const missingRequired = required.filter(item => !availableSet.has(item.toLowerCase()));
  const satisfiedOptional = optional.filter(item => availableSet.has(item.toLowerCase()));

  const hasAllRequired = missingRequired.length === 0;
  let telemetryStatus = 'COMPLETE';
  if (!hasAllRequired) {
    telemetryStatus = satisfiedRequired.length > 0 ? 'PARTIAL' : 'DEFICIENT';
  }

  return {
    incidentId: incident.id,
    telemetryStatus,
    hasAllRequired,
    dataWeHave: Array.from(availableSet),
    dataWeNeed: {
      required,
      missingRequired,
      satisfiedRequired,
      optional,
      satisfiedOptional
    }
  };
}

/**
 * Action Feasibility: Evaluates ACTION_WE_CAN_PERFORM vs ACTION_WE_CANNOT_PERFORM
 */
function evaluateActionFeasibility(action, availableResources = [], availablePersonnel = []) {
  if (!action) return { feasible: false, reason: 'No action specified' };

  const resSet = new Set((availableResources || []).map(r => (typeof r === 'string' ? r : r.id || r.type).toLowerCase()));
  const reqRes = action.requiredResources || [];
  const missingResources = reqRes.filter(r => !resSet.has(r.toLowerCase()));

  const requiredRoles = action.requiredRoles || [];
  const activePersonnelRoles = new Set((availablePersonnel || []).map(p => (p.role || '').toLowerCase()));
  const missingRoles = requiredRoles.filter(role => {
    return !Array.from(activePersonnelRoles).some(r => r.includes(role.toLowerCase()));
  });

  const feasible = missingResources.length === 0 && (requiredRoles.length === 0 || missingRoles.length === 0);

  return {
    actionId: action.id,
    actionType: action.type,
    feasible,
    actionWeCanPerform: feasible,
    missingResources,
    missingRoles,
    matchedPersonnel: (availablePersonnel || []).filter(p => 
      requiredRoles.some(role => (p.role || '').toLowerCase().includes(role.toLowerCase()))
    )
  };
}

/**
 * Transitions an incident through its lifecycle
 */
function transitionIncidentState(incident, newState, note = '') {
  if (!incident) return null;
  incident.resolutionState = newState;
  incident.auditTrail = incident.auditTrail || [];
  incident.auditTrail.push({
    state: newState,
    timestamp: new Date().toISOString(),
    note: note || `State transitioned to ${newState}`
  });
  return incident;
}

module.exports = {
  createIncident,
  evaluateTelemetryRequirements,
  evaluateActionFeasibility,
  transitionIncidentState,
  SEVERITY_LEVELS,
  RESOLUTION_STATES,
  COMMON_INCIDENT_TYPES
};
