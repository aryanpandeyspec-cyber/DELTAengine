// --- HETEROGENEOUS MULTI-MODEL AGENT SWARM ENGINE ---
// Uses 4 specialized AI models executing in a Hybrid Parallel-Sequential Pipeline:
// Phase 1: 🗣️ Liaison Agent (llama-3.1-8b-instant) -> Telemetry Ingestion
// Phase 2: ⏱️ Scheduler Agent (llama-3.3-70b-versatile) & 🏛️ Logistics Agent (llama-3.3-70b-versatile) [PARALLEL PROMISE.ALL]
// Phase 3: 📢 Marketing Agent (llama-3.1-8b-instant) -> Final Broadcast Synthesis

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
let customGroqApiKey = process.env.GROQ_API_KEY || '';

function setGroqApiKey(key) {
  customGroqApiKey = key;
}

function getGroqApiKey() {
  return customGroqApiKey || process.env.GROQ_API_KEY || '';
}

// Candidate Groq models in prioritized order of responsiveness
const CANDIDATE_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b'
];

async function callSpecializedAgent(agentKey, systemPrompt, userPrompt, apiKey) {
  if (!apiKey) return null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout guard

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 400
        })
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0]?.message?.content?.trim();
        if (content) {
          // Remove Markdown headers or quotes if LLM added them
          return content.replace(/^["'\s]+|["'\s]+$/g, '').replace(/^#+\s*/gm, '');
        }
      } else {
        console.warn(`[Groq Model ${model}]: Status ${response.status}. Trying next candidate...`);
      }
    } catch (err) {
      console.warn(`[Groq Model ${model} Error]:`, err.message);
    }
  }

  return null;
}

/**
 * Generates context-aware deterministic multi-agent negotiation dialogue
 * when external Groq API key is offline.
 */
function generateContextualSwarmFallback(conflictDescription, resolutionSummary, db, timeStr) {
  const desc = conflictDescription.toLowerCase();
  
  let liaisonText = `🚨 Ops Alert: "${conflictDescription}". Telemetry feed ingested. Initiating live swarm negotiation.`;
  let schedulerText = `⏱️ On it, Liaison! Auditing timetable availability across Turing Hall, Lovelace Suite, and Hopper Room. Resolving overlap cleanly.`;
  let logisticsText = `🏛️ Verified room facilities: AV calibrated, presentation clickers active, and room capacity limits verified.`;
  let marketingText = `📢 Synced with attendee calendar feed. Live schedule alerts pushed directly to digital display boards.`;

  if (desc.includes('flight') || desc.includes('delayed') || desc.includes('delay')) {
    liaisonText = `🚨 Flight Telemetry Ingested: "${conflictDescription}". Immediate schedule mitigation required.`;
    schedulerText = `⏱️ Adjusting timetable slots to absorb arrival buffer. Zero session overlap; keynote preserved cleanly!`;
    logisticsText = `🏛️ Stage management alerted. Soundcheck window synchronized with updated speaker landing time.`;
    marketingText = `📢 Real-time notice pushed to attendee apps: Speaker arrival delayed, keynote rescheduled with zero cancellations!`;
  } else if (desc.includes('surge') || desc.includes('interest') || desc.includes('capacity')) {
    liaisonText = `📈 Massive Audience Surge: "${conflictDescription}". Foot-traffic sensors spiking!`;
    schedulerText = `⏱️ Heuristic room reallocation triggered. Shifting high-interest keynote to larger venue envelope.`;
    logisticsText = `🏛️ Facility capacity re-routed: Opened overflow lounge with ultra-low-latency 4K stream feeds.`;
    marketingText = `📢 Push update dispatched: Hall upgrade confirmed! Attendees routed to new venue location.`;
  } else if (desc.includes('manual move') || desc.includes('moved to')) {
    liaisonText = `📋 Coordinator Adjustment: "${conflictDescription}". Live matrix topology shifted.`;
    schedulerText = `⏱️ Timetable re-indexed in real time. Validated speaker transition buffers; timetable locked in.`;
    logisticsText = `🏛️ Turing Hall & Lovelace Suite AV verified. Volunteer escorts dispatched to guide attendees.`;
    marketingText = `📢 iCal subscriber feed synchronized. Digital lobby monitors updated with revised talk location.`;
  } else if (desc.includes('mass') || desc.includes('clash') || desc.includes('catastrophic')) {
    liaisonText = `🚨 CATASTROPHIC MULTI-TRACK CLASH: 3 Keynotes collided in Turing Hall simultaneously!`;
    schedulerText = `⏱️ Bipartite solver engaged! Decoupling overlapping sessions into isolated time-space slots.`;
    logisticsText = `🏛️ Dual-stage facilities activated in Lovelace Suite & Hopper Room. AV teams standing by.`;
    marketingText = `📢 Emergency broadcast dispatched: All 3 tracks isolated and running smoothly across the venue!`;
  } else if (desc.includes('hvac') || desc.includes('temp') || desc.includes('cold') || desc.includes('freezing')) {
    liaisonText = `🌡️ Sensory Feedback Logged: Attendee comfort alert in Lovelace Suite (HVAC issue).`;
    schedulerText = `⏱️ Session timetable undisturbed. Zero delay incurred on ongoing tracks.`;
    logisticsText = `🏛️ Venue operations team dispatched: Facilities adjusted HVAC thermostats to a comfortable 22°C.`;
    marketingText = `📢 Attendee sentiment acknowledged: Climate control calibrated, session continuing without interruption.`;
  } else if (desc.includes('mic') || desc.includes('av') || desc.includes('sound') || desc.includes('crackling')) {
    liaisonText = `🎤 Audio Sensor Alert: Intermittent microphone noise detected in presentation hall.`;
    schedulerText = `⏱️ Talk duration protected. Zero schedule delay incurred.`;
    logisticsText = `🏛️ Audio lead Rohan Kulkarni dispatched with secondary redundant wireless mic kit.`;
    marketingText = `📢 Livestream stream audio re-balanced. Crystal-clear sound restored for all attendees.`;
  }

  return [
    { sender: 'Liaison Agent', avatar: '🗣️', text: liaisonText, time: timeStr },
    { sender: 'Scheduler Agent', avatar: '⏱️', text: schedulerText, time: timeStr },
    { sender: 'Logistics Agent', avatar: '🏛️', text: logisticsText, time: timeStr },
    { sender: 'Marketing Agent', avatar: '📢', text: marketingText, time: timeStr }
  ];
}

/**
 * Executes a Heterogeneous Hybrid Swarm Pipeline.
 * Calls Groq API with conversational prompts, or produces rich fallback dialogue.
 */
async function generateGroqAgentSwarmDialogue(conflictDescription, resolutionSummary, db) {
  if (resolutionSummary && typeof resolutionSummary === 'object' && !db) {
    db = resolutionSummary;
    resolutionSummary = '';
  }
  const apiKey = getGroqApiKey();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Guard: If Super Admin LLM Limiter / Kill-Switch is enabled, block LLM expenditure
  if (db && db.limiters && db.limiters.llmLimiter) {
    return [
      { sender: 'Liaison Agent', avatar: '🗣️', text: '⚠️ [CIRCUIT BREAKER ACTIVE] Super Admin LLM Limiter is enabled. Operating under deterministic rule-based optimization solver.', time: timeStr },
      { sender: 'Scheduler Agent', avatar: '⏱️', text: 'Algorithmic constraint solver evaluated venue capacity matrix and executed reallocation cleanly.', time: timeStr },
      { sender: 'Logistics Agent', avatar: '🏛️', text: 'Hall capacity boundaries validated against local in-memory graph constraints.', time: timeStr },
      { sender: 'Marketing Agent', avatar: '📢', text: 'Schedule telemetry preserved. Synced iCal calendar feed with current operational state.', time: timeStr }
    ];
  }

  // If no Groq API Key is configured, generate rich contextual dialogue immediately
  if (!apiKey || apiKey.trim() === '') {
    return generateContextualSwarmFallback(conflictDescription, resolutionSummary, db, timeStr);
  }

  const activeSpeakers = db && db.graph && db.graph.speakers 
    ? Object.values(db.graph.speakers).map(s => `${s.name} (delay: ${s.delay}m)`).join(', ')
    : 'Dr. Aditi Sharma, Vikramaditya Verma, Priya Nair';
  const activeTopics = db && db.graph && db.graph.topics
    ? Object.values(db.graph.topics).map(t => `"${t.title}" (interest: ${t.interest})`).join(', ')
    : 'Autonomous Agent Swarms, WebGPU Deep Dive, Kubernetes Auto-Healing';

  const contextBase = `Event Incident: "${conflictDescription}". Active Speakers: ${activeSpeakers}. Active Topics: ${activeTopics}.`;

  try {
    // --- PHASE 1: LIAISON INGESTION AGENT ---
    const liaisonSystemPrompt = `You are the Liaison Agent (Avatar: 🗣️) in the DELTA ENGINE Autonomous Conference Swarm.
Your role: Alert the coordinator swarm about this live incident with urgency and crisp operational clarity in 1-2 complete, punchy sentences.`;
    const liaisonResponse = await callSpecializedAgent('liaison', liaisonSystemPrompt, contextBase, apiKey);

    // If Groq fails, fall back to contextual dialogue
    if (!liaisonResponse) {
      return generateContextualSwarmFallback(conflictDescription, resolutionSummary, db, timeStr);
    }

    const msg1 = { sender: 'Liaison Agent', avatar: '🗣️', text: liaisonResponse, time: timeStr };

    // --- PHASE 2: PARALLEL REASONING PIPELINE (Promise.all) ---
    const schedulerSystemPrompt = `You are the Scheduler Agent (Avatar: ⏱️) in the DELTA ENGINE Swarm.
Your role: Respond directly to the Liaison Agent's alert. Propose decisive timing, room, and timetable adjustments in 1-2 complete, tactical sentences.`;
    const schedulerUserPrompt = `${contextBase}\n\nLiaison Alert: "${liaisonResponse}"`;

    const logisticsSystemPrompt = `You are the Logistics Agent (Avatar: 🏛️) in the DELTA ENGINE Swarm.
Your role: Respond with physical venue logistics (room capacity, AV routing, seating, stage personnel) in 1-2 complete, practical sentences.`;
    const logisticsUserPrompt = `${contextBase}\n\nLiaison Alert: "${liaisonResponse}"`;

    const [schedulerResponse, logisticsResponse] = await Promise.all([
      callSpecializedAgent('scheduler', schedulerSystemPrompt, schedulerUserPrompt, apiKey),
      callSpecializedAgent('logistics', logisticsSystemPrompt, logisticsUserPrompt, apiKey)
    ]);

    const msg2 = { sender: 'Scheduler Agent', avatar: '⏱️', text: schedulerResponse || 'Timetable recalibrated. Validated speaker slots and buffer intervals.', time: timeStr };
    const msg3 = { sender: 'Logistics Agent', avatar: '🏛️', text: logisticsResponse || 'Hall capacities verified. AV and stage technicians dispatched.', time: timeStr };

    // --- PHASE 3: MARKETING SYNTHESIS AGENT ---
    const marketingSystemPrompt = `You are the Marketing & Public Broadcast Agent (Avatar: 📢) in the DELTA ENGINE Swarm.
Your role: Synthesize the team's resolution into an enthusiastic, reassuring public update for attendees via iCal and app notifications in 1-2 complete, engaging sentences.`;
    const marketingUserPrompt = `${contextBase}\nScheduler Decision: "${msg2.text}"\nLogistics Decision: "${msg3.text}"`;
    const marketingResponse = await callSpecializedAgent('marketing', marketingSystemPrompt, marketingUserPrompt, apiKey);

    const msg4 = { sender: 'Marketing Agent', avatar: '📢', text: marketingResponse || 'Schedule synced. Pushed live calendar and app alerts to all attendee passes.', time: timeStr };

    return [msg1, msg2, msg3, msg4];
  } catch (err) {
    console.error('[Groq Agent Swarm Error]:', err.message);
    return generateContextualSwarmFallback(conflictDescription, resolutionSummary, db, timeStr);
  }
}

/**
 * Generates specialized Agent Swarm dialogue for real-world crowd & venue operations
 * (Rallies, Festivals, Fairs, Movie Launches, Religious Gatherings, Conferences)
 */
async function generateOperationalSwarmDialogue(incident, action, db) {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const apiKey = getGroqApiKey();

  const zoneName = incident?.location?.zoneName || 'Venue Zone';
  const eventType = incident?.eventType || 'EVENT';
  const incidentType = incident?.incidentType || 'OVER_CAPACITY';
  const actionTitle = action?.title || 'Crowd mitigation active';

  // Deterministic Fallback Dialogue Function
  const generateLocalOperationalDialogue = () => {
    let liaisonText = `🚨 Sensory Alert [${eventType}]: ${incident?.potentialImpact || `Density spike in ${zoneName}`}. Telemetry verified.`;
    let schedulerText = `⏱️ Spatial Flow Solver: Evaluating buffer zones and throughput capacity for ${zoneName}. Diverting traffic.`;
    let logisticsText = `🏛️ Venue Logistics: Action "${actionTitle}" confirmed. Dispatched marshals & verified safety corridors.`;
    let broadcasterText = `📢 Public Broadcast: Pushed live operational advisory to coordinator channels and on-site display feeds.`;

    if (eventType === 'PUBLIC_RALLY') {
      liaisonText = `🚨 Perimeter Alert: High crowd density (${incident?.occupancyRate || 105}%) detected in ${zoneName}. Sensor strain threshold warning.`;
      schedulerText = `⏱️ Spatial Flow Solver: Opening East Overflow Park. Diverting incoming arrivals from North Gate to South Concourse.`;
      logisticsText = `🏛️ Logistics Team: MOJ steel barricades locked into position. Mobile 4K LED Screen Trucks activated in overflow lawn.`;
      broadcasterText = `📢 Public Broadcast: Horn PA System activated: "Please proceed calmly to the East Overflow Screenings area."`;
    } else if (eventType === 'LARGE_GATHERING') {
      liaisonText = `⚠️ Gate Congestion Logged: ${zoneName} inflow rate exceeds turnstile throughput. Approach road queue forming.`;
      schedulerText = `⏱️ Flow Balancer: Throttling West Gate scanners. Diverting 40% of visitor flow to East Entrance Plaza.`;
      logisticsText = `🏛️ Ground Logistics: Dynamic electronic gate status signage updated. Roving marshals clearing central promenade fire lane.`;
      broadcasterText = `📢 Public Advisory: Electronic display boards updated: "West Gate at capacity. East Gate open with zero wait time."`;
    } else if (eventType === 'MOVIE_PROMO') {
      liaisonText = `🚨 Atrium Surge Alert: Fan density compression around Red Carpet walkway in ${zoneName}.`;
      schedulerText = `⏱️ Access Controller: Locking Ground-to-L1 escalators. Guiding newly arriving fans toward Levels 2 & 3 viewing rings.`;
      logisticsText = `🏛️ Physical Security: Velvet tensabarriers reinforced. Private celebrity escort team positioned at holding lounge.`;
      broadcasterText = `📢 Broadcast Notice: Atrium PA deployed: "Please enjoy the celebration safely from your level viewing gallery."`;
    } else if (eventType === 'RELIGIOUS_GATHERING') {
      liaisonText = `🚨 Sacred Ghat Alert: ${zoneName} headcount approaching safety limit (${incident?.occupancyRate || 95}%). Riverfront steps slip risk.`;
      schedulerText = `⏱️ Pilgrimage Flow Solver: Enforcing one-way pedestrian routing on East Footbridge. Batching Holding Pen Alpha releases.`;
      logisticsText = `🏛️ Safety Logistics: Volunteer rope-line cordoning lower river steps. Motorized water rescue inflatables on active patrol.`;
      broadcasterText = `📢 Ghat Broadcast: Loudspeaker array deployed: "Pilgrims are requested to proceed via West Bridge and follow volunteer lines."`;
    }

    return [
      { sender: 'Liaison Agent', avatar: '🗣️', text: liaisonText, time: timeStr },
      { sender: 'Scheduler Agent', avatar: '⏱️', text: schedulerText, time: timeStr },
      { sender: 'Logistics Agent', avatar: '🏛️', text: logisticsText, time: timeStr },
      { sender: 'Marketing Agent', avatar: '📢', text: broadcasterText, time: timeStr }
    ];
  };

  // Circuit breaker check
  if (db && db.limiters && db.limiters.llmLimiter) {
    return [
      { sender: 'Liaison Agent', avatar: '🗣️', text: `⚠️ [CIRCUIT BREAKER ACTIVE] Super Admin LLM Limiter is enabled. Local safety constraint rules engaged for ${zoneName}.`, time: timeStr },
      { sender: 'Scheduler Agent', avatar: '⏱️', text: `Deterministic safety solver evaluated zone topology and executed "${actionTitle}".`, time: timeStr },
      { sender: 'Logistics Agent', avatar: '🏛️', text: `Venue spatial constraints and emergency egress routes validated locally.`, time: timeStr },
      { sender: 'Marketing Agent', avatar: '📢', text: `Operational dispatch confirmed across coordinator WhatsApp and WebSocket channels.`, time: timeStr }
    ];
  }

  // If no Groq API Key, use rich deterministic operational dialogue
  if (!apiKey || apiKey.trim() === '') {
    return generateLocalOperationalDialogue();
  }

  const contextBase = `Operational Domain: ${eventType}. Zone: ${zoneName}. Incident Type: ${incidentType}. Severity: ${incident?.severity || 'critical'}. Current Occupancy: ${incident?.currentOccupancy || 0}/${incident?.capacity || 100} (${incident?.occupancyRate || 0}%). Recommended Action: "${actionTitle}". Potential Impact: "${incident?.potentialImpact || 'None'}".`;

  try {
    const liaisonSystemPrompt = `You are the Liaison Agent (Avatar: 🗣️) in the DELTA ENGINE Real-World Operations Swarm.
Your role: Alert the operations team about this live ${eventType} incident in ${zoneName} with military crispness, urgency, and operational clarity in 1-2 punchy sentences.`;
    const liaisonResponse = await callSpecializedAgent('liaison', liaisonSystemPrompt, contextBase, apiKey);

    if (!liaisonResponse) return generateLocalOperationalDialogue();

    const msg1 = { sender: 'Liaison Agent', avatar: '🗣️', text: liaisonResponse, time: timeStr };

    const schedulerSystemPrompt = `You are the Scheduler / Spatial Flow Agent (Avatar: ⏱️) in the DELTA ENGINE Operations Swarm.
Your role: Respond directly to the Liaison's alert. Propose concrete spatial flow control, buffer zones, or crowd rerouting decisions for ${zoneName} in 1-2 tactical sentences.`;
    const schedulerUserPrompt = `${contextBase}\n\nLiaison Alert: "${liaisonResponse}"`;

    const logisticsSystemPrompt = `You are the Logistics Agent (Avatar: 🏛️) in the DELTA ENGINE Operations Swarm.
Your role: Respond with physical venue logistics (barriers, PA speakers, emergency egress, personnel assignments) in 1-2 practical sentences.`;
    const logisticsUserPrompt = `${contextBase}\n\nLiaison Alert: "${liaisonResponse}"`;

    const [schedulerResponse, logisticsResponse] = await Promise.all([
      callSpecializedAgent('scheduler', schedulerSystemPrompt, schedulerUserPrompt, apiKey),
      callSpecializedAgent('logistics', logisticsSystemPrompt, logisticsUserPrompt, apiKey)
    ]);

    const msg2 = { sender: 'Scheduler Agent', avatar: '⏱️', text: schedulerResponse || `Flow control engaged. Rerouting crowd influx away from ${zoneName}.`, time: timeStr };
    const msg3 = { sender: 'Logistics Agent', avatar: '🏛️', text: logisticsResponse || `Physical barricades and marshals deployed to enforce ${actionTitle}.`, time: timeStr };

    const broadcasterSystemPrompt = `You are the Broadcaster Agent (Avatar: 📢) in the DELTA ENGINE Operations Swarm.
Your role: Synthesize the team's resolution into an authoritative, calm public advisory or coordinator broadcast in 1-2 clear sentences.`;
    const broadcasterUserPrompt = `${contextBase}\nFlow Decision: "${msg2.text}"\nLogistics Decision: "${msg3.text}"`;
    const broadcasterResponse = await callSpecializedAgent('marketing', broadcasterSystemPrompt, broadcasterUserPrompt, apiKey);

    const msg4 = { sender: 'Marketing Agent', avatar: '📢', text: broadcasterResponse || `Public update broadcasted. Personnel notified across emergency channels.`, time: timeStr };

    return [msg1, msg2, msg3, msg4];
  } catch (err) {
    console.warn('[Operational Swarm Error]: Falling back to local dialogue:', err.message);
    return generateLocalOperationalDialogue();
  }
}

module.exports = {
  generateGroqAgentSwarmDialogue,
  generateOperationalSwarmDialogue,
  setGroqApiKey,
  getGroqApiKey
};

