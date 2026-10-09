// --- TWILIO WHATSAPP & SMS CLOUD DISPATCHER ---
// Integrates with Twilio Programmable Messaging API to dispatch real-time
// WhatsApp coordinator and speaker alerts during emergency schedule changes.

const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

/**
 * Checks if active Twilio credentials exist and are not documentation placeholders.
 */
function isTwilioConfigured() {
  const sid = process.env.TWILIO_ACCOUNT_SID || '';
  const token = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_SECRET || '';
  
  if (!sid || sid.includes('XXXX') || sid.length < 30) return false;
  if (!token || token.includes('XXXX') || token.length < 20) return false;
  return true;
}

/**
 * Dispatches an automated WhatsApp alert via Twilio REST API.
 * Gracefully falls back to web-intent click-to-chat links if credentials are in sandbox/demo mode.
 */
async function dispatchTwilioWhatsApp({ recipientName, phoneNumber, messageText }) {
  const cleanPhone = (phoneNumber || '').replace(/[^0-9+]/g, '');
  const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const waUrl = `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodeURIComponent(messageText)}`;

  if (!isTwilioConfigured()) {
    console.log(`[Twilio WhatsApp] 💬 Simulation Mode: Alert queued for ${recipientName} (${formattedPhone}). Real credentials not detected.`);
    return {
      success: true,
      mode: 'SIMULATED_CLICK_TO_CHAT',
      sid: 'wa_sim_' + Date.now(),
      recipientName,
      phoneNumber: formattedPhone,
      messageText,
      timestamp,
      waUrl,
      note: 'Provide valid TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to enable autonomous background delivery.'
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_SECRET;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Default Twilio WhatsApp sandbox

  try {
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('From', fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`);
    params.append('To', formattedPhone.startsWith('whatsapp:') ? formattedPhone : `whatsapp:${formattedPhone}`);
    params.append('Body', messageText);

    console.log(`[Twilio WhatsApp] 🚀 Sending real WhatsApp message via Twilio API to ${formattedPhone}...`);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await res.json();
    if (res.ok) {
      console.log(`[Twilio WhatsApp] ✅ Message delivered! Twilio SID: ${data.sid}`);
      return {
        success: true,
        mode: 'TWILIO_REST_API',
        sid: data.sid,
        recipientName,
        phoneNumber: formattedPhone,
        messageText,
        timestamp,
        waUrl,
        status: data.status
      };
    } else {
      console.warn('[Twilio WhatsApp] Twilio API responded with error:', data.message || data);
      return {
        success: false,
        error: data.message || 'Twilio API error',
        mode: 'FALLBACK_TO_INTENT',
        waUrl,
        recipientName,
        phoneNumber: formattedPhone,
        messageText,
        timestamp
      };
    }
  } catch (err) {
    console.error('[Twilio WhatsApp] Exception sending message:', err.message);
    return {
      success: false,
      error: err.message,
      mode: 'FALLBACK_TO_INTENT',
      waUrl,
      recipientName,
      phoneNumber: formattedPhone,
      messageText,
      timestamp
    };
  }
}

module.exports = {
  isTwilioConfigured,
  dispatchTwilioWhatsApp
};
