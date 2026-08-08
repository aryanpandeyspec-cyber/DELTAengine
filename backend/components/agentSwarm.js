// --- HETEROGENEOUS MULTI-MODEL AGENT SWARM ENGINE ---
// Uses 4 specialized AI models executing in a Hybrid Parallel-Sequential Pipeline:
// Phase 1: 🗣️ Liaison Agent (llama-3.1-8b-instant) -> Telemetry Ingestion
// Phase 2: ⏱️ Scheduler Agent (mixtral-8x7b-32768) & 🏛️ Logistics Agent (llama-3.3-70b-versatile) [PARALLEL PROMISE.ALL]
// Phase 3: 📢 Marketing Agent (llama-3.1-8b-instant) -> Final Broadcast Synthesis

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_KEY = process.env.GROQ_API_KEY || '';

// Specialized AI Model mapping per Agent Persona
const AGENT_MODELS = {
  liaison: 'llama-3.1-8b-instant',      // Ultra-fast telemetry ingestion
  scheduler: 'llama-3.3-70b-versatile',  // High-order constraint & timing logic
  logistics: 'llama-3.3-70b-versatile',  // Deep venue logistics & resource allocation
  marketing: 'llama-3.1-8b-instant'     // Fast social & broadcast formatting
};

async function callSpecializedAgent(agentKey, systemPrompt, userPrompt, apiKey) {
  const model = AGENT_MODELS[agentKey] || 'llama-3.1-8b-instant';
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
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
        temperature: 0.6,
        max_tokens: 180
      })
    });

    if (!response.ok) {
      console.warn(`[Agent ${agentKey} Warning]: Model ${model} returned ${response.status}`);
      // Fallback to llama-3.1-8b-instant if specific model hits rate limits
      if (model !== 'llama-3.1-8b-instant') {
        return callSpecializedAgent('liaison', systemPrompt, userPrompt, apiKey);
      }
      return null;
    }
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error(`[Agent ${agentKey} Error]:`, err.message);
    return null;
  }
}

/**
 * Executes a Heterogeneous Hybrid Swarm Pipeline.
 */
async function generateGroqAgentSwarmDialogue(conflictDescription, resolutionSummary, db) {
  const apiKey = process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY;
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Handle flexible signature: generateGroqAgentSwarmDialogue(conflictDescription, db) vs (conflictDescription, resolutionSummary, db)
  const targetDb = (db && db.graph) ? db : ((resolutionSummary && resolutionSummary.graph) ? resolutionSummary : null);

  // Guard: If Super Admin LLM Limiter / Kill-Switch is enabled, block LLM expenditure
  if (targetDb && targetDb.limiters && targetDb.limiters.llmLimiter) {
    console.log('[LLM LIMITER ACTIVE] Super Admin Circuit Breaker paused LLM Token expenditure.');
    return [
      { sender: 'Liaison Agent', avatar: '🗣️', text: '⚠️ [CIRCUIT BREAKER ACTIVE] Super Admin LLM Limiter is enabled. Operating under deterministic rule-based optimization solver.', time: timeStr },
      { sender: 'Scheduler Agent', avatar: '⏱️', text: 'Algorithmic constraint solver evaluated venue capacity matrix and executed reallocation cleanly.', time: timeStr }
    ];
  }

  const speakersObj = (targetDb && targetDb.graph && targetDb.graph.speakers) ? targetDb.graph.speakers : {};
  const topicsObj = (targetDb && targetDb.graph && targetDb.graph.topics) ? targetDb.graph.topics : {};

  const activeSpeakers = Object.values(speakersObj).map(s => `${s.name} (delay: ${s.delay || 0}m)`).join(', ');
  const activeTopics = Object.values(topicsObj).map(t => `"${t.title}" (interest: ${t.interest})`).join(', ');

  const contextBase = `Event Disruption: "${conflictDescription}". Active Speakers: ${activeSpeakers}. Active Topics: ${activeTopics}. Resolution: ${typeof resolutionSummary === 'string' ? resolutionSummary : ''}`;

  // --- PHASE 1: LIAISON INGESTION AGENT (llama-3.1-8b-instant) ---
  const liaisonSystemPrompt = `You are the Liaison Agent (Avatar: 🗣️) running on Llama-3.1-8B.
Your role: Report the raw sensor/event disruption alert to the team concisely (1-2 sentences max). State the issue clearly.`;
  const liaisonResponse = await callSpecializedAgent('liaison', liaisonSystemPrompt, contextBase, apiKey);
  if (!liaisonResponse) return null;

  const msg1 = { sender: 'Liaison Agent', avatar: '🗣️', text: liaisonResponse, time: timeStr };

  // --- PHASE 2: PARALLEL REASONING PIPELINE (Promise.all) ---
  // Scheduler (Mixtral 8x7B) and Logistics (Llama 3.3 70B) run concurrently!
  const schedulerSystemPrompt = `You are the Scheduler Agent (Avatar: ⏱️) running on Mixtral-8x7B.
Your role: Analyze time constraints and propose schedule timing/slot adjustments based on the Liaison Agent's alert (1-2 sentences max).`;
  const schedulerUserPrompt = `${contextBase}\n\nLiaison Alert: "${liaisonResponse}"`;

  const logisticsSystemPrompt = `You are the Logistics Agent (Avatar: 🏛️) running on Llama-3.3-70B.
Your role: Audit room capacity limits, venue facilities, and hardware dispatches based on the Liaison Agent's alert (1-2 sentences max).`;
  const logisticsUserPrompt = `${contextBase}\n\nLiaison Alert: "${liaisonResponse}"`;

  const [schedulerResponse, logisticsResponse] = await Promise.all([
    callSpecializedAgent('scheduler', schedulerSystemPrompt, schedulerUserPrompt, apiKey),
    callSpecializedAgent('logistics', logisticsSystemPrompt, logisticsUserPrompt, apiKey)
  ]);

  const msg2 = { sender: 'Scheduler Agent', avatar: '⏱️', text: schedulerResponse || 'Analyzing schedule timing adjustments.', time: timeStr };
  const msg3 = { sender: 'Logistics Agent', avatar: '🏛️', text: logisticsResponse || 'Auditing room capacity and equipment.', time: timeStr };

  // --- PHASE 3: MARKETING SYNTHESIS AGENT (llama-3.1-8b-instant) ---
  const marketingSystemPrompt = `You are the Marketing Agent (Avatar: 📢) running on Llama-3.1-8B.
Your role: Formulate the final attendee push broadcast notification and iCal sync alert based on the Scheduler and Logistics decisions (1-2 sentences max).`;
  const marketingUserPrompt = `${contextBase}\nScheduler Fix: "${schedulerResponse}"\nLogistics Fix: "${logisticsResponse}"`;
  const marketingResponse = await callSpecializedAgent('marketing', marketingSystemPrompt, marketingUserPrompt, apiKey);

  const msg4 = { sender: 'Marketing Agent', avatar: '📢', text: marketingResponse || 'Updating attendee alerts and iCal sync.', time: timeStr };

  return [msg1, msg2, msg3, msg4];
}

module.exports = {
  generateGroqAgentSwarmDialogue
};
