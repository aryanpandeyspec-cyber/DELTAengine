// --- IN-MEMORY DYNAMIC GRAPH DATABASE ---

const db = {
  activeDate: '2026-08-07',
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
    { id: 'cnt_01', name: 'Ananya Roy', role: 'Lead Event Coordinator', phone: '+91 98765 43210', email: 'ananya.roy@delta-engine.in', hall: 'Turing Hall & Lovelace Suite', status: 'Online' },
    { id: 'cnt_02', name: 'Dr. Aditi Sharma', role: 'AI Keynote Speaker & Research Lead', phone: '+91 91234 56789', email: 'aditi.sharma@ai-research.in', hall: 'Turing Hall', status: 'Online' },
    { id: 'cnt_03', name: 'Vikramaditya Verma', role: 'WebGPU Speaker & Graphics Lead', phone: '+91 99887 76655', email: 'vikram.verma@graphics.in', hall: 'Lovelace Suite', status: 'Online' },
    { id: 'cnt_04', name: 'Priya Nair', role: 'DevOps Speaker & Cloud Lead', phone: '+91 98112 23344', email: 'priya.nair@devops.in', hall: 'Hopper Room', status: 'Online' },
    { id: 'cnt_05', name: 'Arjun Mehta', role: 'Super Admin & Infrastructure Director', phone: '+91 98990 01122', email: 'arjun.mehta@delta-engine.in', hall: 'ALL VENUES (Root)', status: 'Active' },
    { id: 'cnt_06', name: 'Rohan Kulkarni', role: 'AV Systems & Facility Stage Lead', phone: '+91 97112 24455', email: 'rohan.kulkarni@venue-av.in', hall: 'All Venue Halls', status: 'Active' }
  ],
  volunteers: [
    { id: 'vol_01', name: 'Rohan Sharma', role: 'Lead Stage Volunteer', phone: '+91 98761 23456', assignedEvent: 'topic-1', location: 'Turing Hall (Stage Front)', task: 'Speaker Mic & Slide Clicker Check', status: 'ON DUTY' },
    { id: 'vol_02', name: 'Priya Patel', role: 'Crowd & Door Volunteer', phone: '+91 98123 45678', assignedEvent: 'topic-1', location: 'Turing Hall (Door Entrance A)', task: 'Scanning QR Badges & Seating Pass', status: 'ON DUTY' },
    { id: 'vol_03', name: 'Aarav Mehta', role: 'Q&A Mic Runner', phone: '+91 99001 12233', assignedEvent: 'topic-1', location: 'Turing Hall (Aisle 2)', task: 'Passing Wireless Mics to Audience', status: 'ACTIVE' },
    { id: 'vol_04', name: 'Ananya Sen', role: 'AV & Stream Volunteer', phone: '+91 97890 12345', assignedEvent: 'topic-1', location: 'Turing Hall (AV Desk)', task: 'Monitoring 4K Live Stream Feed', status: 'ON DUTY' },
    { id: 'vol_05', name: 'Kabir Verma', role: 'Lovelace Stage Volunteer', phone: '+91 96543 21098', assignedEvent: 'topic-2', location: 'Lovelace Suite', task: 'Pre-session Setup & Hospitality', status: 'READY' }
  ],
  whatsappLogs: [],
  limiters: {
    llmLimiter: false,
    dbLimiter: false
  },
  schedulesByDate: {
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
    this.activeDate = '2026-08-07';
    for (const id in this.graph.speakers) {
      this.graph.speakers[id].delay = 0;
    }
    this.graph.topics['topic-1'].interest = 210;
    this.graph.topics['topic-2'].interest = 140;
    this.graph.topics['topic-3'].interest = 180;

    this.schedulesByDate['2026-08-07'] = {
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
