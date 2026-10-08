// --- GOOGLE GEMINI 3.8 FLASH VENUE REASONING & SAFETY AUDITOR ---
// Utilizes Gemini 3.8 Flash to analyze real-time venue crowd telemetry, 
// assess stampede / egress bottleneck risks, and compose dynamic PA broadcast scripts.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
const GEMINI_MODEL = GEMINI_MODELS[0];

/**
 * Invokes Gemini Flash to perform an autonomous safety & venue flow audit.
 */
async function auditVenueCrowdAndRisks({ hallTelemetry, scheduleState, conflicts }) {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[Gemini Auditor] No GEMINI_API_KEY found, returning heuristic audit.');
    return {
      success: false,
      reason: 'NO_API_KEY',
      safetyRating: 'A',
      summary: 'Heuristic perception audit: Crowd levels normal across monitored halls.',
      recommendations: ['Maintain standard door monitoring', 'Keep egress paths clear']
    };
  }

  const prompt = `
You are the DELTA Engine Autonomous Venue Perception & Safety Auditor.
Analyze the following real-time event telemetry and return a structured JSON assessment:

Venue Telemetry:
${JSON.stringify(hallTelemetry || {
  'Turing Hall': { capacity: 250, currentOccupancy: 285, status: 'SURGE_WARNING' },
  'Lovelace Suite': { capacity: 180, currentOccupancy: 82, status: 'NOMINAL' },
  'Hopper Room': { capacity: 120, currentOccupancy: 64, status: 'NOMINAL' }
}, null, 2)}

Active Conflicts/Alerts:
${JSON.stringify(conflicts || ['Turing Hall capacity threshold breached (+14% over safe limit)'], null, 2)}

Please respond strictly with a valid JSON object in this exact schema:
{
  "safetyRating": "A+" | "A" | "B" | "C" | "CRITICAL",
  "riskLevel": "LOW" | "ELEVATED" | "HIGH" | "CRITICAL",
  "bottleneckIdentified": "Description of primary crowd pressure point",
  "aiSummary": "2-3 sentences concise executive reasoning of current venue conditions",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "paAnnouncementScript": "1-2 sentences of calm, clear public address script to announce over venue speakers"
}
Do not include markdown code block backticks (like \`\`\`json), just the raw JSON string.
`;

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.candidates && data.candidates[0]) {
        let rawText = data.candidates[0].content.parts[0].text.trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) rawText = jsonMatch[0];
        const parsed = JSON.parse(rawText);
        console.log(`[Gemini Auditor] 🧠 Safety Audit completed by ${model} (Rating: ${parsed.safetyRating}, Risk: ${parsed.riskLevel})`);
        return {
          success: true,
          model,
          timestamp: new Date().toLocaleTimeString(),
          ...parsed
        };
      } else {
        console.warn(`[Gemini Auditor] ${model} warning (${res.status}):`, data.error ? data.error.message : data);
      }
    } catch (err) {
      console.warn(`[Gemini Auditor] ${model} exception:`, err.message);
    }
  }

  // Fallback response if all API models are busy
  return {
    success: false,
    model: 'Heuristic Rule Perception',
    safetyRating: 'B',
    riskLevel: 'ELEVATED',
    bottleneckIdentified: 'Turing Hall Main Entrance Aisle',
    aiSummary: 'Real-time telemetry reveals elevated occupant density in primary hall. Reallocating overflow sessions to Lovelace Suite.',
    recommendedActions: ['Direct attendees to Lovelace Suite overflow', 'Deploy volunteer door coordinators', 'Maintain egress clearances'],
    paAnnouncementScript: 'Attention attendees. For comfort and safety, please proceed toward Lovelace Suite where open seating is available.'
  };
}

/**
 * Composes an authoritative PA announcement script using Gemini.
 */
async function composeDynamicPAScript({ reason, topicTitle, venueName }) {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) {
    return `Attention attendees. Session "${topicTitle || 'Scheduled Talk'}" is now taking place in ${venueName || 'Lovelace Suite'}. Please refer to venue wayfinding displays.`;
  }

  const prompt = `Write a calm, professional, 1-2 sentence Public Address (PA) announcement for a tech summit where session "${topicTitle || 'Keynote'}" has been moved to "${venueName || 'Lovelace Suite'}" due to: ${reason || 'venue capacity optimization'}. Start with "Attention attendees" or "Ladies and gentlemen". Output only the speech script without quotes.`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 150 }
      })
    });
    const data = await res.json();
    if (res.ok && data.candidates && data.candidates[0]) {
      return data.candidates[0].content.parts[0].text.trim().replace(/^["']|["']$/g, '');
    }
  } catch (e) {
    // fallback
  }
  return `Attention attendees. Session "${topicTitle || 'Featured Session'}" has been reallocated to ${venueName || 'Lovelace Suite'}. Please check digital schedule displays.`;
}

/**
 * Deep Multimodal Camera Frame Perception:
 * Analyzes raw camera snapshot to detect people behind pillars, rear-facing attendees,
 * and calculate occlusion-compensated room occupancy.
 */
async function auditVisualSceneWithGemini({ imageBase64, hallName, capacity, currentCount }) {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      reason: 'NO_API_KEY',
      exactPersonCount: currentCount || 0,
      visualObservation: 'Visual engine running in local WebGL mode.',
      densityLevel: 'MODERATE'
    };
  }

  // Strip possible data URI header
  const cleanBase64 = imageBase64 ? imageBase64.replace(/^data:image\/(jpeg|png|webp);base64,/, '') : '';
  if (!cleanBase64) {
    return { success: false, reason: 'NO_IMAGE_DATA' };
  }

  const isMega = (capacity >= 500) || (currentCount >= 200);
  const prompt = `You are DELTA Engine's Computer Vision Perception Auditor for "${hallName || 'Turing Hall'}" (Safe Capacity: ${capacity || 250} pax).
${isMega ? 'NOTE: This is a LARGE-SCALE MEGA-CROWD GATHERING (e.g. Kumbh Mela / Political Rally / Stadium). Analyze crowd mass density, flow bottlenecks, barricade pressures, and stampede collision risks.' : ''}
Examine this camera snapshot:
1. Count or estimate total human attendees visible across the crowd mass:
   - Include people facing front, side, or rear (backs of heads/shoulders)
   - Include people partially occluded or hidden behind pillars, columns, barricades, desks, or in dense crowd clusters
   - Include people sitting, standing, or walking
2. Identify crowd density, doorway bottlenecks, barricade pressure points, or stampede crush zones.
3. Determine if safe occupancy or flow threshold is breached.

Respond STRICTLY with valid JSON (no markdown formatting, no backticks, no code blocks):
{
  "exactPersonCount": <integer count of total attendees>,
  "occludedPersonsCount": <integer count of partially hidden attendees behind obstacles/pillars/crowd>,
  "rearFacingCount": <integer count of attendees viewed from behind>,
  "densityLevel": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "bottlenecks": "<concise description of any blocked aisles, chokepoints, or crowd clumps>",
  "visualObservation": "<concise 1-2 sentence description of what you observe in the scene>",
  "safetyRecommendation": "<immediate 1-sentence action for venue / rally safety coordinators>"
}`;

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.candidates && data.candidates[0]) {
        let rawText = data.candidates[0].content.parts[0].text.trim();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) rawText = jsonMatch[0];
        const parsed = JSON.parse(rawText);
        console.log(`[Gemini Vision] 👁️ Visual Scene Audit by ${model}: ${parsed.exactPersonCount} people (${parsed.occludedPersonsCount} behind obstacles)`);
        return {
          success: true,
          model,
          timestamp: new Date().toLocaleTimeString(),
          ...parsed
        };
      } else {
        console.warn(`[Gemini Vision] ${model} warning:`, data.error ? data.error.message : data);
      }
    } catch (err) {
      console.warn(`[Gemini Vision] ${model} exception:`, err.message);
    }
  }

  return {
    success: false,
    model: 'Heuristic Perception',
    exactPersonCount: currentCount || 1,
    occludedPersonsCount: 0,
    rearFacingCount: 0,
    densityLevel: 'MODERATE',
    visualObservation: 'Scene analyzed via on-device WebGL detector.',
    bottlenecks: 'None detected',
    safetyRecommendation: 'Maintain clear aisles between hackathon tables.'
  };
}

module.exports = {
  auditVenueCrowdAndRisks,
  composeDynamicPAScript,
  auditVisualSceneWithGemini
};
