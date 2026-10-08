// --- ELEVENLABS AUTONOMOUS VENUE PA VOICE ANNOUNCER ---
// Generates studio-grade realistic voice announcements for emergency capacity surges
// and dynamic schedule reallocations over venue PA speakers.

const fs = require('fs');
const path = require('path');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
// Premade Broadcaster Voice ID: "onwK4e9ZLuTAKqWW03F9" (Daniel - Steady Broadcaster)
const DEFAULT_VOICE_ID = 'onwK4e9ZLuTAKqWW03F9';

async function generateVenueVoiceAnnouncement(announcementText, customVoiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY || ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log('[Voice Announcer] No ELEVENLABS_API_KEY configured. Operating in simulation mode.');
    return { success: false, reason: 'NO_API_KEY' };
  }

  const voiceId = customVoiceId || DEFAULT_VOICE_ID;
  const cleanText = announcementText || 'Attention attendees. DELTA Engine autonomous venue safety perception is active.';

  try {
    console.log(`[Voice Announcer] 🎙️ Synthesizing announcement with ElevenLabs: "${cleanText.substring(0, 60)}..."`);
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Voice Announcer] ElevenLabs API error (${response.status}):`, errText);
      return { success: false, error: errText };
    }

    const audioBuffer = await response.arrayBuffer();
    const audioDir = path.join(__dirname, '../../frontend/audio_announcements');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const filename = `announcement_${Date.now()}.mp3`;
    const filepath = path.join(audioDir, filename);
    fs.writeFileSync(filepath, Buffer.from(audioBuffer));

    const publicUrl = `audio_announcements/${filename}`;
    console.log(`[Voice Announcer] ✅ Generated venue announcement audio: ${publicUrl} (${audioBuffer.byteLength} bytes)`);

    return {
      success: true,
      audioUrl: publicUrl,
      text: cleanText,
      timestamp: new Date().toLocaleTimeString(),
      voice: 'Daniel (Broadcaster)'
    };
  } catch (err) {
    console.error('[Voice Announcer] Synthesis exception:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  generateVenueVoiceAnnouncement
};
