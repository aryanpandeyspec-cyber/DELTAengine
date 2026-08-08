// --- SECURITY, SANITIZATION & RATE LIMITING MIDDLEWARE ---

/**
 * Escapes HTML characters to prevent Cross-Site Scripting (XSS) attacks.
 * @param {string} str Input string
 * @returns {string} Sanitized string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Simple in-memory Rate Limiter per IP address.
 * Prevents DoS/DDoS spam attacks from crashing the server.
 */
const rateLimitMap = new Map();
const MAX_REQUESTS_PER_MINUTE = 100;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();

  let clientData = rateLimitMap.get(ip);
  if (!clientData || (now - clientData.startTime > 60000)) {
    clientData = { count: 1, startTime: now };
    rateLimitMap.set(ip, clientData);
    return next();
  }

  clientData.count++;
  if (clientData.count > MAX_REQUESTS_PER_MINUTE) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please wait a minute before sending more actions.'
    });
  }

  next();
}

/**
 * Validates file upload extension and size for slide pipeline security.
 */
function validateSlideFile(file) {
  if (!file) return { valid: false, error: 'No file provided' };
  
  const allowedExtensions = ['.pdf', '.pptx', '.ppt', '.txt'];
  const ext = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return { valid: false, error: `Invalid file format "${ext}". Only PDF and PPTX presentation slides are allowed.` };
  }

  const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB max
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: 'File size exceeds 20MB limit.' };
  }

  return { valid: true };
}

module.exports = {
  escapeHtml,
  rateLimiter,
  validateSlideFile
};
