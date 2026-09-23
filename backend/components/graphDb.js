const todayDateStr = new Date().toISOString().split('T')[0];

const db = {
  activeDate: todayDateStr,
  graph: {
    speakers: {
      'speaker-1': { id: 'speaker-1', name: 'Dr. Aditi Sharma', role: 'AI Research Director', bio: 'Pioneering agentic swarm coordination models.', avatar: '🧑‍🔬', delay: 0 },
      'speaker-2': { id: 'speaker-2', name: 'Vikramaditya Verma', role: 'Graphics Engineer', bio: 'Ex-Mozilla WebGPU core contributor.', avatar: '💻', delay: 0 },
      'speaker-3': { id: 'speaker-3', name: 'Priya Nair', role: 'DevOps Architect', bio: 'Specialist in cloud-native self-healing nodes.', avatar: '☁️', delay: 0 }
    },
    topics: {
      'topic-1': { id: 'topic-1', title: 'Autonomous Agent Swarms: Coordination without Controllers', speakerId: 'speaker-1', tags: ['AI', 'Agentic', 'Swarms'], interest: 210, duration: 60, slidesUploaded: true, summary: 'Peer-to-peer LLM negotiation without central controllers.' },
      'topic-2': { id: 'topic-2', title: 'WebGPU Deep Dive: Raytracing in the Browser', speakerId: 'speaker-2', tags: ['Graphics', 'WebGPU', 'JS'], interest: 140, duration: 60, slidesUploaded: true, summary: 'Rendering hardware-accelerated 3D graphs at 60 FPS.' },
      'topic-3': { id: 'topic-3', title: 'Kubernetes Auto-Healing Runtimes under Load Stress', speakerId: 'speaker-3', tags: ['DevOps', 'K8s', 'Cloud'], interest: 180, duration: 60, slidesUploaded: true, summary: 'Self-correcting pod scheduling during high traffic spikes.' }
    },
    halls: {
      'hall-1': { id: 'hall-1', name: 'Turing Hall', capacity: 250 },
      'hall-2': { id: 'hall-2', name: 'Lovelace Suite', capacity: 120 },
      'hall-3': { id: 'hall-3', name: 'Hopper Room', capacity: 60 }
    },
    slots: {
      'slot-1': { id: 'slot-1', time: '09:30 AM - 10:30 AM', startHour: 9.5 },
      'slot-2': { id: 'slot-2', time: '11:00 AM - 12:00 PM', startHour: 11 },
      'slot-3': { id: 'slot-3', time: '01:30 PM - 02:30 PM', startHour: 13.5 },
      'slot-4': { id: 'slot-4', time: '03:00 PM - 04:00 PM', startHour: 15 }
    },
    edges: [
      { source: 'topic-1', target: 'speaker-1', type: 'SPEAKER_OF' },
      { source: 'topic-2', target: 'speaker-2', type: 'SPEAKER_OF' },
      { source: 'topic-3', target: 'speaker-3', type: 'SPEAKER_OF' }
    ],
    // --- Generalized Spatial & Operations Graph Entities ---
    venues: {
      'venue-1': { id: 'venue-1', name: 'DELTA International Convention Center', totalCapacity: 830, type: 'CONVENTION_CENTER' }
    },
    zones: {
      'hall-1': { id: 'hall-1', name: 'Turing Hall', capacity: 250, safeDensity: 1.2, venueId: 'venue-1', connectedZones: ['hall-2', 'foyer-1'] },
      'hall-2': { id: 'hall-2', name: 'Lovelace Suite', capacity: 120, safeDensity: 1.0, venueId: 'venue-1', connectedZones: ['hall-1', 'hall-3', 'foyer-1'] },
      'hall-3': { id: 'hall-3', name: 'Hopper Room', capacity: 60, safeDensity: 0.9, venueId: 'venue-1', connectedZones: ['hall-2', 'foyer-1'] },
      'foyer-1': { id: 'foyer-1', name: 'Main Lobby & Exhibition Foyer', capacity: 400, safeDensity: 1.8, venueId: 'venue-1', connectedZones: ['hall-1', 'hall-2', 'hall-3', 'gate-a'] }
    },
    entryExits: {
      'gate-a': { id: 'gate-a', name: 'Entrance Door A', direction: 'BIDIRECTIONAL', flowRateMax: 60, targetZone: 'foyer-1' },
      'exit-east': { id: 'exit-east', name: 'Emergency Egress East', direction: 'OUT', flowRateMax: 100, targetZone: 'foyer-1' }
    },
    routes: [
      { id: 'route-1', from: 'foyer-1', to: 'hall-1', distanceMeters: 25, transitTimeSeconds: 30 },
      { id: 'route-2', from: 'foyer-1', to: 'hall-2', distanceMeters: 40, transitTimeSeconds: 45 },
      { id: 'route-3', from: 'hall-2', to: 'hall-3', distanceMeters: 15, transitTimeSeconds: 20 },
      { id: 'route-4', from: 'hall-1', to: 'hall-2', distanceMeters: 30, transitTimeSeconds: 35 }
    ],
    resources: {
      'res-av-1': { id: 'res-av-1', name: '4K Ultra-Low-Latency Stream Rig', type: 'AV_EQUIPMENT', zoneId: 'hall-1' },
      'res-hvac-1': { id: 'res-hvac-1', name: 'IoT Climate HVAC Controller', type: 'FACILITY_CONTROL', zoneId: 'hall-1' },
      'res-signage-1': { id: 'res-signage-1', name: 'Dynamic LED Schedule Boards', type: 'SIGNAGE', zoneId: 'foyer-1' }
    },
    incidents: [],
    actions: []
  },
  contacts: [
    { id: 'cnt_01', name: 'Aryan Pandey', role: 'Lead Event Coordinator & Systems Commander', phone: '+91 91542 76178', email: 'aryan.pandey777hyd@gmail.com', hall: 'ALL VENUES (Central Command)', status: 'Online' },
    { id: 'cnt_02', name: 'Suryansh', role: 'Crowd Safety & Entrance Door Specialist', phone: '+91 83030 09159', email: 'Suryansh@delta-engine.in', hall: 'Turing Hall & Entrance A', status: 'Online' },
    { id: 'cnt_03', name: 'Shahid', role: 'Stage & Hall Operations Coordinator', phone: '+91 63035 70916', email: 'shahid@delta-engine.in', hall: 'Lovelace Suite & Stage Front', status: 'Online' },
    { id: 'cnt_04', name: 'Dr. Aditi Sharma', role: 'Guest Keynote Speaker (AI Research Lead)', phone: '+91 91234 56789', email: 'aditi.sharma@ai-research.in', hall: 'Turing Hall', status: 'Speaker Confirmed' },
    { id: 'cnt_05', name: 'Vikramaditya Verma', role: 'Guest Keynote Speaker (Graphics Lead)', phone: '+91 99887 76655', email: 'vikram.verma@graphics.in', hall: 'Lovelace Suite', status: 'Speaker Confirmed' },
    { id: 'cnt_06', name: 'Priya Nair', role: 'Guest Speaker (DevOps Architect)', phone: '+91 98112 23344', email: 'priya.nair@devops.in', hall: 'Hopper Room', status: 'Speaker Confirmed' }
  ],
  volunteers: [
    { id: 'vol_01', name: 'Suryansh', role: 'Crowd Safety & Entrance Lead', phone: '+91 83030 09159', assignedEvent: 'topic-1', location: 'Turing Hall (Door Entrance A)', task: 'Scanning passes & door routing', status: 'ON DUTY' },
    { id: 'vol_02', name: 'Shahid', role: 'Stage & Operations Lead', phone: '+91 63035 70916', assignedEvent: 'topic-1', location: 'Turing Hall (Stage Front)', task: 'Safety aisle clearance & mic checks', status: 'ON DUTY' },
    { id: 'vol_03', name: 'Aryan Pandey', role: 'Lead Systems Commander', phone: '+91 91542 76178', assignedEvent: 'topic-1', location: 'Central AV & IoT Control Desk', task: 'Perception monitoring & volunteer dispatch', status: 'ON DUTY' }
  ],
  whatsappLogs: [],
  limiters: {
    llmLimiter: false,
    dbLimiter: false
  },
  schedulesByDate: {
    [todayDateStr]: {
      'slot-1': { 'hall-1': 'topic-1', 'hall-2': null, 'hall-3': null },
      'slot-2': { 'hall-1': 'topic-2', 'hall-2': null, 'hall-3': null },
      'slot-3': { 'hall-1': 'topic-3', 'hall-2': null, 'hall-3': null },
      'slot-4': { 'hall-1': null, 'hall-2': null, 'hall-3': null }
    },
    '2026-08-07': {
      'slot-1': { 'hall-1': 'topic-1', 'hall-2': null, 'hall-3': null },
      'slot-2': { 'hall-1': 'topic-2', 'hall-2': null, 'hall-3': null },
      'slot-3': { 'hall-1': 'topic-3', 'hall-2': null, 'hall-3': null },
      'slot-4': { 'hall-1': null, 'hall-2': null, 'hall-3': null }
    },
    '2026-08-08': {
      'slot-1': { 'hall-1': 'topic-2', 'hall-2': null, 'hall-3': null },
      'slot-2': { 'hall-1': 'topic-3', 'hall-2': null, 'hall-3': null },
      'slot-3': { 'hall-1': null, 'hall-2': 'topic-1', 'hall-3': null },
      'slot-4': { 'hall-1': null, 'hall-2': null, 'hall-3': null }
    },
    '2026-08-09': {
      'slot-1': { 'hall-1': null, 'hall-2': 'topic-3', 'hall-3': null },
      'slot-2': { 'hall-1': 'topic-1', 'hall-2': null, 'hall-3': null },
      'slot-3': { 'hall-1': 'topic-2', 'hall-2': null, 'hall-3': null },
      'slot-4': { 'hall-1': null, 'hall-2': null, 'hall-3': null }
    }
  },
  get schedule() {
    if (!this.schedulesByDate[this.activeDate]) {
      // Deterministically seed a unique schedule layout for ANY chosen calendar date!
      const dateNum = Array.from(this.activeDate).reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const shift = dateNum % 3;
      const topicIds = Object.keys(this.graph.topics);

      this.schedulesByDate[this.activeDate] = {
        'slot-1': { 'hall-1': topicIds[shift % topicIds.length] || null, 'hall-2': null, 'hall-3': null },
        'slot-2': { 'hall-1': topicIds[(shift + 1) % topicIds.length] || null, 'hall-2': null, 'hall-3': null },
        'slot-3': { 'hall-1': topicIds[(shift + 2) % topicIds.length] || null, 'hall-2': null, 'hall-3': null },
        'slot-4': { 'hall-1': null, 'hall-2': null, 'hall-3': null }
      };
    }
    return this.schedulesByDate[this.activeDate];
  },
  setDate(dateStr) {
    this.activeDate = dateStr;
    this.syncScheduleEdges();
  },
  syncScheduleEdges() {
    // Preserve speaker edges and static edges
    const staticTypes = ['SPEAKER_OF'];
    const preservedEdges = this.graph.edges.filter(e => staticTypes.includes(e.type));
    this.graph.edges = preservedEdges;

    // 1. Sync Conference Schedule Edges (Backward Compatibility)
    const sched = this.schedule;
    for (const slotId in sched) {
      for (const hallId in sched[slotId]) {
        const topicId = sched[slotId][hallId];
        if (topicId) {
          this.graph.edges.push({ source: topicId, target: hallId, type: 'SCHEDULED_IN' });
          this.graph.edges.push({ source: topicId, target: slotId, type: 'SCHEDULED_AT' });
        }
      }
    }

    // 2. Sync Generalized Spatial Relationships
    // ZONE -> LOCATED_IN -> VENUE
    const primaryVenueId = Object.keys(this.graph.venues || {})[0] || 'venue-1';
    for (const zId in this.graph.zones || {}) {
      const zone = this.graph.zones[zId];
      this.graph.edges.push({
        source: zId,
        target: zone.venueId || primaryVenueId,
        type: 'LOCATED_IN'
      });
    }

    // ZONE -> CONNECTED_TO -> ZONE (from routes)
    (this.graph.routes || []).forEach(route => {
      this.graph.edges.push({
        source: route.from,
        target: route.to,
        type: 'CONNECTED_TO',
        distance: route.distanceMeters
      });
    });

    // PERSONNEL -> ASSIGNED_TO -> ZONE
    (this.volunteers || []).forEach(v => {
      const targetZone = v.location && v.location.includes('Turing') ? 'hall-1' :
                         v.location && v.location.includes('Lovelace') ? 'hall-2' :
                         v.location && v.location.includes('Door') ? 'gate-a' : 'hall-1';
      this.graph.edges.push({
        source: v.id,
        target: targetZone,
        type: 'ASSIGNED_TO'
      });
    });
  },

  // --- Generalized Operational Graph Query Helpers ---
  getZone(zoneId) {
    return (this.graph.zones && this.graph.zones[zoneId]) || 
           (this.graph.halls && this.graph.halls[zoneId]) || null;
  },

  getConnectedZones(zoneId) {
    const zone = this.getZone(zoneId);
    if (!zone || !zone.connectedZones) {
      // Fallback: search routes
      const connected = (this.graph.routes || [])
        .filter(r => r.from === zoneId || r.to === zoneId)
        .map(r => (r.from === zoneId ? r.to : r.from));
      return Array.from(new Set(connected)).map(id => this.getZone(id)).filter(Boolean);
    }
    return zone.connectedZones.map(id => this.getZone(id)).filter(Boolean);
  },

  findAlternativeZone(currentZoneId, neededCapacity = 0) {
    const connected = this.getConnectedZones(currentZoneId);
    // Sort by capacity that accommodates neededCapacity
    const viable = connected.filter(z => z.id !== currentZoneId && (neededCapacity <= 0 || z.capacity >= neededCapacity));
    if (viable.length > 0) {
      return viable.sort((a, b) => b.capacity - a.capacity)[0];
    }
    // If no direct connected zone fits, search all other zones in graph
    const allZones = Object.values(this.graph.zones || this.graph.halls || {});
    const fallbackViable = allZones.filter(z => z.id !== currentZoneId && (neededCapacity <= 0 || z.capacity >= neededCapacity));
    return fallbackViable.length > 0 ? fallbackViable.sort((a, b) => b.capacity - a.capacity)[0] : null;
  },

  getPersonnelForZone(zoneId) {
    const target = zoneId ? zoneId.toLowerCase() : '';
    const pool = [...(this.volunteers || []), ...(this.contacts || [])];
    return pool.filter(p => {
      const loc = (p.location || p.hall || '').toLowerCase();
      return loc.includes(target) || loc.includes('all') || target.includes(loc);
    });
  },

  recordIncident(incident) {
    this.graph.incidents = this.graph.incidents || [];
    this.graph.incidents.unshift(incident);
    if (this.graph.incidents.length > 50) this.graph.incidents.pop();
    return incident;
  },

  getIncidents(filter = {}) {
    let list = this.graph.incidents || [];
    if (filter.eventType) list = list.filter(i => i.eventType === filter.eventType);
    if (filter.severity) list = list.filter(i => i.severity === filter.severity);
    if (filter.resolutionState) list = list.filter(i => i.resolutionState === filter.resolutionState);
    return list;
  },

  applyScenario(scenario) {
    if (!scenario) return;
    if (scenario.zones) {
      this.graph.zones = {};
      scenario.zones.forEach(z => {
        this.graph.zones[z.id] = { ...z };
      });
    }
    if (scenario.venue) {
      this.graph.venues = {
        [scenario.venue.id]: { ...scenario.venue }
      };
    }
    if (scenario.entryExits) {
      this.graph.entryExits = {};
      scenario.entryExits.forEach(ee => {
        this.graph.entryExits[ee.id] = { ...ee };
      });
    }
    if (scenario.routes) {
      this.graph.routes = [...scenario.routes];
    }
    if (scenario.resources) {
      this.graph.resources = {};
      scenario.resources.forEach(r => {
        this.graph.resources[r.id] = { ...r };
      });
    }
    this.syncScheduleEdges();
  },
  reset() {
    const todayStr = new Date().toISOString().split('T')[0];
    this.activeDate = todayStr;
    for (const id in this.graph.speakers) {
      this.graph.speakers[id].delay = 0;
    }
    this.graph.topics['topic-1'].interest = 210;
    this.graph.topics['topic-2'].interest = 140;
    this.graph.topics['topic-3'].interest = 180;

    this.schedulesByDate[todayStr] = {
      'slot-1': { 'hall-1': 'topic-1', 'hall-2': null, 'hall-3': null },
      'slot-2': { 'hall-1': 'topic-2', 'hall-2': null, 'hall-3': null },
      'slot-3': { 'hall-1': 'topic-3', 'hall-2': null, 'hall-3': null },
      'slot-4': { 'hall-1': null, 'hall-2': null, 'hall-3': null }
    };
    this.syncScheduleEdges();
  }
};

db.syncScheduleEdges();

module.exports = db;
