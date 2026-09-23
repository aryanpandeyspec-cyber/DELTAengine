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
    ]
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
    this.graph.edges = this.graph.edges.filter(e => e.type !== 'SCHEDULED_IN' && e.type !== 'SCHEDULED_AT');
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
