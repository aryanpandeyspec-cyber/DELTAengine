// --- INTELLIGENT HALL-AWARE VOLUNTEER ROUTING ENGINE ---
// Automatically maps venue halls to stationed volunteers and safety personnel.
// Guarantees that incidents at Hall A alert ONLY Hall A volunteers, eliminating
// volunteer spam and broadcast fatigue across large event venues (20+ staff).

const { dispatchTwilioWhatsApp } = require('./twilioDispatcher');

/**
 * Normalizes hall identifier strings to canonical hall IDs (e.g. 'hall-1', 'hall-2')
 */
function normalizeHallId(input) {
  if (!input) return '';
  const str = String(input).toLowerCase().trim();
  if (str.includes('turing') || str === 'hall-1') return 'hall-1';
  if (str.includes('lovelace') || str === 'hall-2') return 'hall-2';
  if (str.includes('hopper') || str === 'hall-3') return 'hall-3';
  if (str.includes('keynote') || str.includes('arena') || str === 'hall-4') return 'hall-4';
  if (str.includes('kumbh')) return 'hall-kumbh';
  if (str.includes('rally')) return 'hall-rally';
  if (str.includes('stadium')) return 'hall-stadium';
  if (str.includes('gate-a') || str.includes('entrance a')) return 'gate-a';
  if (str === 'all' || str.startsWith('all ') || str.includes('all venue') || str.includes('central')) return 'ALL';
  return str;
}

/**
 * Returns human-readable hall name from canonical ID
 */
function getHallDisplayName(hallId, db) {
  const norm = normalizeHallId(hallId) || 'hall-1';
  if (db && db.graph && db.graph.halls && db.graph.halls[norm]) {
    return db.graph.halls[norm].name;
  }
  const nameMap = {
    'hall-1': 'Turing Hall',
    'hall-2': 'Lovelace Suite',
    'hall-3': 'Hopper Room',
    'hall-4': 'Keynote Arena',
    'hall-kumbh': 'Kumbh Mela Sector A (Ghat)',
    'hall-rally': 'Mega Election Rally Grounds',
    'hall-stadium': 'Olympic / Tech Stadium Arena',
    'gate-a': 'Main Entrance Gate A',
    'ALL': 'Central Command (All Halls)'
  };
  return nameMap[norm] || norm;
}

/**
 * Queries all registered volunteers and contacts stationed at a specific hall.
 * Excludes volunteers stationed at other halls.
 * Optionally includes Central Command / Lead Coordinators (assignedHallId === 'ALL') for critical events.
 */
function getAssignedPersonnelForHall(hallId, db, options = {}) {
  const normHall = normalizeHallId(hallId) || 'hall-1';
  const includeCentralLead = options.includeCentralLead !== false;
  const volunteers = (db && Array.isArray(db.volunteers)) ? db.volunteers : [];
  const contacts = (db && Array.isArray(db.contacts)) ? db.contacts : [];

  const matchedVolunteers = [];
  const excludedVolunteers = [];

  // 1. Scan db.volunteers (Primary Volunteer Registry)
  for (const vol of volunteers) {
    const volHall = normalizeHallId(vol.assignedHallId || vol.hallId || vol.location);
    const isCentral = volHall === 'ALL' || vol.role?.toLowerCase().includes('lead systems') || vol.role?.toLowerCase().includes('central');

    if (volHall === normHall) {
      matchedVolunteers.push({
        id: vol.id,
        name: vol.name,
        role: vol.role,
        phone: vol.phone,
        email: vol.email || '',
        assignedHallId: normHall,
        location: vol.location || getHallDisplayName(normHall, db),
        task: vol.task || 'Active Duty',
        status: vol.status || 'ON DUTY',
        isLead: false
      });
    } else if (isCentral && includeCentralLead) {
      matchedVolunteers.push({
        id: vol.id,
        name: vol.name,
        role: vol.role,
        phone: vol.phone,
        email: vol.email || '',
        assignedHallId: 'ALL',
        location: vol.location || 'Central Control Desk',
        task: 'Oversight & Escalation',
        status: vol.status || 'ON DUTY',
        isLead: true
      });
    } else {
      excludedVolunteers.push({
        id: vol.id,
        name: vol.name,
        assignedHallId: volHall || 'Unassigned',
        role: vol.role
      });
    }
  }

  // 2. Also check db.contacts for coordinators (strictly filtering out guest speakers)
  for (const cnt of contacts) {
    // Skip guest speakers
    if (cnt.role?.toLowerCase().includes('speaker')) continue;

    const cntHall = normalizeHallId(cnt.hall || cnt.assignedHallId);
    const isCentral = cntHall === 'ALL' || cnt.role?.toLowerCase().includes('lead event coordinator');
    const alreadyIncluded = matchedVolunteers.some(m => m.name === cnt.name || m.phone === cnt.phone);

    if (!alreadyIncluded) {
      if (cntHall === normHall) {
        matchedVolunteers.push({
          id: cnt.id,
          name: cnt.name,
          role: cnt.role,
          phone: cnt.phone,
          email: cnt.email || '',
          assignedHallId: normHall,
          location: cnt.hall || getHallDisplayName(normHall, db),
          task: 'Hall Operations Oversight',
          status: cnt.status || 'Online',
          isLead: false
        });
      } else if (isCentral && includeCentralLead) {
        matchedVolunteers.push({
          id: cnt.id,
          name: cnt.name,
          role: cnt.role,
          phone: cnt.phone,
          email: cnt.email || '',
          assignedHallId: 'ALL',
          location: 'Central Control Desk',
          task: 'Incident Command',
          status: cnt.status || 'Online',
          isLead: true
        });
      } else {
        excludedVolunteers.push({
          id: cnt.id,
          name: cnt.name,
          assignedHallId: cntHall || 'Unassigned',
          role: cnt.role
        });
      }
    }
  }

  return {
    targetHallId: normHall,
    targetHallName: getHallDisplayName(normHall, db),
    assigned: matchedVolunteers,
    excludedCount: excludedVolunteers.length,
    excludedList: excludedVolunteers
  };
}

/**
 * Generates customized, role-tailored action instructions for a specific volunteer
 * based on the incident type and their station at the venue.
 */
function generateContextualTask(volunteer, incidentType, hallName, details = {}) {
  const roleStr = (volunteer.role || '').toLowerCase();
  const occ = details.occupiedPercent || 100;
  const count = details.currentCount || 0;
  const cap = details.capacity || 250;

  switch (incidentType) {
    case 'CAPACITY_BREACH':
    case 'ROOM_FULL':
      if (roleStr.includes('crowd') || roleStr.includes('entrance') || roleStr.includes('door')) {
        return {
          task: 'HALT ENTRANCE & REDIRECT ATTENDEES',
          whatsappMsg: `🚨 [URGENT: ${hallName.toUpperCase()}] Room reached ${occ}% capacity (${count}/${cap} Pax). HALT incoming admissions immediately and redirect attendees to overflow halls.`
        };
      }
      if (roleStr.includes('stage') || roleStr.includes('operations')) {
        return {
          task: 'CLEAR AISLES & VERIFY EMERGENCY EGRESS',
          whatsappMsg: `🚨 [URGENT: ${hallName.toUpperCase()}] 100% capacity reached. Clear stage access aisles, check fire egress doors, and verify stage safety clearance.`
        };
      }
      return {
        task: 'COORDINATE VENUE REDIRECTION',
        whatsappMsg: `🚨 [CCTV BREACH: ${hallName.toUpperCase()}] Capacity threshold breached (${occ}%). Active gate closure initiated.`
      };

    case 'ROOM_80_PERCENT':
    case 'NEAR_CAPACITY':
      if (roleStr.includes('crowd') || roleStr.includes('entrance') || roleStr.includes('door')) {
        return {
          task: 'PREPARE OVERFLOW HOLDING QUEUE',
          whatsappMsg: `⚠️ [WARNING: ${hallName.toUpperCase()}] Room is 80% FULL (${count}/${cap} Pax). Form holding queues at Entrance Gate and prep overflow boards.`
        };
      }
      if (roleStr.includes('stage') || roleStr.includes('operations')) {
        return {
          task: 'MONITOR SEAT ROW DENSITY',
          whatsappMsg: `⚠️ [NOTICE: ${hallName.toUpperCase()}] 80% room capacity reached. Monitor seating rows and ensure center walkway remains unobstructed.`
        };
      }
      return {
        task: 'STANDBY FOR CAPACITY CUTOFF',
        whatsappMsg: `⚠️ [NOTICE: ${hallName.toUpperCase()}] Near capacity warning active (${occ}% Occupied).`
      };

    case 'ROOM_EMPTY':
      if (roleStr.includes('stage') || roleStr.includes('operations')) {
        return {
          task: 'STAGE SETUP & MIC CHECKS AUTHORIZED',
          whatsappMsg: `ℹ️ [CLEARED: ${hallName.toUpperCase()}] Hall is 100% vacated. Stage and AV crew cleared to enter for podium, mic, and slide setup.`
        };
      }
      return {
        task: 'STANDBY FOR NEXT SESSION INGRESS',
        whatsappMsg: `ℹ️ [CLEARED: ${hallName.toUpperCase()}] Hall vacated. Reset door scanners for next scheduled batch.`
      };

    case 'SPEAKER_DELAY':
      return {
        task: 'NOTIFY WAITING AUDIENCE',
        whatsappMsg: `📢 [SCHEDULE CHANGE: ${hallName.toUpperCase()}] Speaker delayed by ${details.delayMinutes || 30} mins. Talk "${details.topicTitle || 'Session'}" relocated. Announce to audience.`
      };

    default:
      return {
        task: 'STATION MONITORING',
        whatsappMsg: `ℹ️ [OPERATIONAL NOTICE: ${hallName.toUpperCase()}] ${details.message || 'Standard venue perception alert.'}`
      };
  }
}

/**
 * Dispatches an automated, hall-targeted alert to ONLY the assigned volunteers.
 * Broadcasts the targeted dispatch over WebSocket and sends WhatsApp alerts.
 */
async function dispatchHallTargetedAlert({ hallId, eventType, details = {}, db, broadcast, sendWhatsAppNotification }) {
  const normHall = normalizeHallId(hallId);
  const hallName = getHallDisplayName(normHall, db);
  const { assigned, excludedCount, excludedList } = getAssignedPersonnelForHall(normHall, db);

  console.log(`\n🎯 [Targeted Dispatch] Hall: "${hallName}" (${normHall}) | Alert: ${eventType}`);
  console.log(`   👥 Targeted Personnel: ${assigned.map(a => `${a.name} (${a.role})`).join(', ') || 'None assigned'}`);
  console.log(`   🚫 Excluded Staff at other venues: ${excludedCount} personnel (No spam delivered)\n`);

  const dispatchResults = [];
  const assignedVolunteersPayload = [];

  for (const person of assigned) {
    const { task, whatsappMsg } = generateContextualTask(person, eventType, hallName, details);

    assignedVolunteersPayload.push({
      name: person.name,
      role: person.role,
      phone: person.phone,
      location: person.location,
      task: task,
      isLead: person.isLead
    });

    // Execute targeted notification
    if (typeof sendWhatsAppNotification === 'function') {
      try {
        const notifResult = await sendWhatsAppNotification(
          `${person.name} (${person.role})`,
          person.phone,
          whatsappMsg
        );
        dispatchResults.push({
          name: person.name,
          phone: person.phone,
          task,
          status: notifResult?.status || 'DISPATCHED',
          waUrl: notifResult?.waUrl
        });
      } catch (err) {
        console.warn(`[Targeted Dispatch] Could not dispatch to ${person.name}:`, err.message);
      }
    }
  }

  // Construct comprehensive targeted WebSocket alert for UI
  const targetedAlertPayload = {
    id: `targeted_alert_${normHall}_${Date.now()}`,
    type: eventType,
    hallId: normHall,
    hallName: hallName,
    severity: (eventType === 'CAPACITY_BREACH' || eventType === 'ROOM_FULL') ? 'critical' : (eventType === 'ROOM_80_PERCENT' ? 'warning' : 'info'),
    timestamp: new Date().toLocaleTimeString(),
    occupiedPercent: details.occupiedPercent || 0,
    emptyPercent: details.emptyPercent || 0,
    peopleDetected: details.currentCount || 0,
    capacity: details.capacity || 250,
    message: `${hallName}: ${eventType.replace(/_/g, ' ')} detected. Dispatched instructions exclusively to on-duty hall personnel.`,
    targetedVolunteers: assignedVolunteersPayload,
    assignedVolunteers: assignedVolunteersPayload, // backward-compatible for existing HUD banner
    excludedCount: excludedCount,
    excludedHallsNote: `${excludedCount} volunteers at other venues shielded from irrelevant alerts.`,
    dispatchResults
  };

  if (typeof broadcast === 'function') {
    broadcast({
      type: 'VOLUNTEER_ALERT',
      data: targetedAlertPayload
    });
  }

  return targetedAlertPayload;
}

module.exports = {
  normalizeHallId,
  getHallDisplayName,
  getAssignedPersonnelForHall,
  generateContextualTask,
  dispatchHallTargetedAlert
};
