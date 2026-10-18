// --- SECURITY, SANITIZATION, JWT RBAC & FORENSIC AUDIT TRAIL (DELTA ENGINE v3.6) ---
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Fixed system secret for HMAC-SHA256 signature verification (or from environment)
// Dynamic cryptographically secure system secret for HMAC-SHA256 signature verification (or from environment)
const JWT_SECRET = process.env.JWT_SECRET || (global._DELTA_SECURE_JWT_SECRET ? global._DELTA_SECURE_JWT_SECRET : (global._DELTA_SECURE_JWT_SECRET = crypto.randomBytes(32).toString('hex')));

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
  // Allow high-frequency sensor, CCTV telemetry & local upload pipeline testing
  if (
    req.path.startsWith('/api/sensors/') || 
    req.path.startsWith('/api/cctv/') || 
    req.path.startsWith('/api/upload') ||
    req.path.startsWith('/api/spatial')
  ) {
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  // Allow local development loopback without throttling
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return next();
  }

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
 * Validates file upload extension and size for document & room blueprint pipeline security.
 * When isOptional is true (e.g. room calibration or parameter re-edit), missing file is accepted.
 */
function validateSlideFile(file, isOptional = false) {
  if (!file) {
    if (isOptional) return { valid: true };
    return { valid: false, error: 'No file provided. Please drop or select a file.' };
  }
  
  const allowedExtensions = ['.pdf', '.pptx', '.ppt', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.svg'];
  const originalName = file.originalname || '';
  const ext = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')).toLowerCase() : '';
  
  if (ext && !allowedExtensions.includes(ext)) {
    return { valid: false, error: `Invalid file format "${ext}". Supported formats: PDF, PPTX, TXT, PNG, JPG, WEBP, SVG.` };
  }

  const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB max
  if (file.size && file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: 'File size exceeds 20MB limit.' };
  }

  return { valid: true };
}

// =========================================================================
// 🔐 CRYPTOGRAPHIC RFC-7519 JSON WEB TOKEN (JWT) ENGINE (ZERO DEPENDENCY)
// =========================================================================

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

const SESSION_DURATION_SECONDS = 3 * 60 * 60; // 10,800 seconds = 3 Hours Session Lifetime

/**
 * Parses HTTP Cookie header into key-value map.
 * @param {object} req Express request
 * @returns {object} Parsed cookie key-value object
 */
function parseCookies(req) {
  const list = {};
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0] ? parts[0].trim() : '';
    if (!name) return;
    const value = parts.slice(1).join('=').trim();
    try {
      list[name] = decodeURIComponent(value);
    } catch (e) {
      list[name] = value;
    }
  });
  return list;
}

/**
 * Extracts authentication token from Authorization header, x-access-token, or session cookie.
 * @param {object} req Express request
 * @returns {string|null} Token string or null
 */
function extractToken(req) {
  const authHeader = req.headers?.['authorization'] || req.headers?.['x-access-token'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  } else if (authHeader) {
    return authHeader.trim();
  }
  const cookies = parseCookies(req);
  if (cookies['delta_session_token']) {
    return cookies['delta_session_token'];
  }
  return null;
}

/**
 * Generates an RFC-7519 standard HMAC-SHA256 signed JSON Web Token.
 * Default lifetime: at least 3 hours (10,800 seconds).
 */
function generateJwt(payload, expiresInSeconds = SESSION_DURATION_SECONDS) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

/**
 * Refreshes an active session token for another 3 hours without requiring password re-entry.
 * @param {string} token Current valid JWT token
 * @param {number} expiresInSeconds New lifetime in seconds (default 3 hours)
 * @returns {string|null} Refreshed JWT token or null if current token is invalid
 */
function refreshJwt(token, expiresInSeconds = SESSION_DURATION_SECONDS) {
  const verified = verifyJwt(token);
  if (!verified) return null;
  const cleanPayload = {
    id: verified.id,
    name: verified.name,
    role: verified.role,
    title: verified.title,
    email: verified.email,
    authProvider: verified.authProvider
  };
  return generateJwt(cleanPayload, expiresInSeconds);
}

/**
 * Verifies an RFC-7519 JWT signature and expiration.
 */
function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signature] = parts;
  const dataToSign = `${headerB64}.${payloadB64}`;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    return null; // Signature mismatch!
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired token!
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// Pre-seeded authorized operator accounts for live enterprise access
const OPERATOR_CREDENTIALS = {
  'admin_marcus': { id: 'usr_admin', name: 'Super Administrator', role: 'ADMIN', title: 'Super Admin & Systems Commander', password: process.env.ADMIN_PASSWORD || 'deltaAdmin2026!' },
  'admin': { id: 'usr_admin', name: 'Super Administrator', role: 'ADMIN', title: 'Super Admin & Systems Commander', password: process.env.ADMIN_PASSWORD || 'deltaAdmin2026!' },
  'aryan': { id: 'usr_aryan', name: 'Aryan Pandey', role: 'ADMIN', title: 'Super Admin & Systems Commander', password: process.env.ADMIN_PASSWORD || 'deltaAdmin2026!' },
  'aryan.pandey777hyd@gmail.com': { id: 'usr_aryan_email', name: 'Aryan Pandey', role: 'ADMIN', title: 'Super Admin & Systems Commander', password: process.env.ADMIN_PASSWORD || 'deltaAdmin2026!' },
  'aryan.pandey.spec@gmail.com': { id: 'usr_aryan_spec', name: 'Aryan Pandey', role: 'ADMIN', title: 'Super Admin & Systems Commander', password: process.env.ADMIN_PASSWORD || 'deltaAdmin2026!' },
  'Suryansh': { id: 'usr_coord', name: 'Operations Coordinator', role: 'COORDINATOR', title: 'Lead Operations Coordinator', password: process.env.OPERATOR_PASSWORD || 'delta2026' },
  'Aryan': { id: 'usr_safety', name: 'Aryan Pandey', role: 'ADMIN', title: 'Super Admin & Systems Commander', password: process.env.OPERATOR_PASSWORD || 'delta2026' },
  'Shahid': { id: 'usr_ops', name: 'Operations Lead', role: 'COORDINATOR', title: 'Stage & Operations Coordinator', password: process.env.OPERATOR_PASSWORD || 'delta2026' },
  'Volunteer': { id: 'usr_field', name: 'Field Marshal', role: 'VOLUNTEER', title: 'On-Ground Crowd Marshal', password: process.env.OPERATOR_PASSWORD || 'delta2026' }
};

/**
 * Express Middleware: Authenticates JWT from Authorization header or session cookie.
 * Requires genuine cryptographic signature and valid expiration timestamp.
 */
function authenticateToken(req, res, next) {
  const token = extractToken(req);

  if (token) {
    const verified = verifyJwt(token);
    if (verified) {
      req.user = verified;
      return next();
    } else {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or expired cryptographic authentication token.'
      });
    }
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Authentication token required. Please log in via /api/auth/login.'
  });
}

/**
 * Express Middleware: Enforces granular role-based permissions.
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // ADMIN has universal permission override
    if (req.user.role === 'ADMIN' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: `Role "${req.user.role}" does not have sufficient clearance. Required roles: ${allowedRoles.join(', ')}.`
    });
  };
}

// =========================================================================
// 📜 IMMUTABLE FORENSIC AUDIT TRAIL (CRYPTOGRAPHIC SHA-256 HASH CHAINING)
// =========================================================================

const forensicAuditTrail = [];
let lastBlockHash = '0000000000000000000000000000000000000000000000000000000000000000';

function appendForensicAuditLog(actionType, actorName, role, targetEntity, details = {}) {
  const timestamp = new Date().toISOString();
  const entryIndex = forensicAuditTrail.length;
  
  const payloadString = JSON.stringify({
    index: entryIndex,
    timestamp,
    actionType,
    actorName,
    role,
    targetEntity,
    details,
    previousHash: lastBlockHash
  });

  const blockHash = crypto.createHash('sha256').update(payloadString).digest('hex');
  lastBlockHash = blockHash;

  const logEntry = {
    index: entryIndex,
    timestamp,
    actionType,
    actorName,
    role,
    targetEntity,
    details,
    previousHash: entryIndex === 0 ? 'GENESIS_BLOCK' : forensicAuditTrail[entryIndex - 1].hash,
    hash: blockHash
  };

  forensicAuditTrail.push(logEntry);
  if (forensicAuditTrail.length > 500) {
    forensicAuditTrail.shift(); // Keep last 500 in memory
  }

  return logEntry;
}

function getForensicAuditLogs(limit = 100) {
  return forensicAuditTrail.slice(-limit).reverse();
}

module.exports = {
  escapeHtml,
  rateLimiter,
  validateSlideFile,
  SESSION_DURATION_SECONDS,
  parseCookies,
  extractToken,
  generateJwt,
  verifyJwt,
  refreshJwt,
  OPERATOR_CREDENTIALS,
  authenticateToken,
  requireRole,
  appendForensicAuditLog,
  getForensicAuditLogs
};
