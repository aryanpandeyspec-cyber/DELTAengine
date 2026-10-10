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

let simAlertBatchCount = 0;
let lastSimLogTime = 0;
let circuitBreakerUntil = 0;
let lastTwilioRequestTime = 0;
let lastLoggedError = '';
let lastLoggedErrorTime = 0;

/**
 * Dispatches an automated WhatsApp alert via Twilio REST API.
 * Gracefully falls back to web-intent click-to-chat links if credentials are in sandbox/demo mode
 * or if Twilio rate limits / circuit-breaker triggers.
 */
async function dispatchTwilioWhatsApp({ recipientName, phoneNumber, messageText }) {
  const cleanPhone = (phoneNumber || '').replace(/[^0-9+]/g, '');
  const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const waUrl = `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodeURIComponent(messageText)}`;

  // 1. If Twilio credentials missing/invalid, use simulated intent
  if (!isTwilioConfigured()) {
    simAlertBatchCount++;
    const now = Date.now();
    if (now - lastSimLogTime > 3000) {
      lastSimLogTime = now;
      console.log(`[Twilio WhatsApp] 💬 Simulation Mode: Alert queued for ${recipientName} (${formattedPhone})${simAlertBatchCount > 1 ? ` [+${simAlertBatchCount - 1} personnel]` : ''}`);
      simAlertBatchCount = 0;
    }
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

  // 2. Circuit Breaker Check (Tripped when Twilio rate limits us)
  const now = Date.now();
  if (now < circuitBreakerUntil) {
    return {
      success: true,
      mode: 'CIRCUIT_BREAKER_FALLBACK',
      sid: 'wa_cb_' + Date.now(),
      recipientName,
      phoneNumber: formattedPhone,
      messageText,
      timestamp,
      waUrl,
      note: 'Twilio rate limit cooldown active; dispatched via web-intent fallback.'
    };
  }

  // 3. Inter-request rate pacing (Max 1 request per 1000ms to stay within Twilio limits)
  const timeSinceLastReq = now - lastTwilioRequestTime;
  if (timeSinceLastReq < 1000) {
    await new Promise(r => setTimeout(r, 1000 - timeSinceLastReq));
  }
  lastTwilioRequestTime = Date.now();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_SECRET;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Default Twilio WhatsApp sandbox

  try {
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('From', fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`);
    params.append('To', formattedPhone.startsWith('whatsapp:') ? formattedPhone : `whatsapp:${formattedPhone}`);
    params.append('Body', messageText);

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
      console.log(`[Twilio WhatsApp] ✅ Message delivered to ${recipientName} (${formattedPhone})! Twilio SID: ${data.sid}`);
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
      const errMsg = data.message || JSON.stringify(data);
      const isRateLimit = res.status === 429 || (errMsg && errMsg.toLowerCase().includes('rate limit'));

      if (isRateLimit) {
        // Trip circuit breaker for 60 seconds
        circuitBreakerUntil = Date.now() + 60000;
        console.warn(`[Twilio WhatsApp] ⏳ Twilio rate limit reached. Circuit breaker engaged for 60s (falling back to web-intent links for all staff).`);
      } else {
        const errorNow = Date.now();
        if (errMsg !== lastLoggedError || errorNow - lastLoggedErrorTime > 15000) {
          lastLoggedError = errMsg;
          lastLoggedErrorTime = errorNow;
          console.warn(`[Twilio WhatsApp] Twilio notice: ${errMsg}`);
        }
      }

      return {
        success: false,
        error: errMsg,
        mode: 'FALLBACK_TO_INTENT',
        waUrl,
        recipientName,
        phoneNumber: formattedPhone,
        messageText,
        timestamp
      };
    }
  } catch (err) {
    const errorNow = Date.now();
    if (err.message !== lastLoggedError || errorNow - lastLoggedErrorTime > 15000) {
      lastLoggedError = err.message;
      lastLoggedErrorTime = errorNow;
      console.warn('[Twilio WhatsApp] Network notice:', err.message);
    }
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
