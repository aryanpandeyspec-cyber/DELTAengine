/**
 * DELTA ENGINE — Dedicated Admin Authentication & 3-Hour Session Persistence Test Suite
 * 
 * Verifies all security & session requirements:
 * 1. Admin Access Tests (Logged-out rejection, API rejection, role enforcement, tamper resistance)
 * 2. Session Tests (3-hour persistence, token refresh, revocation on logout, password exclusion)
 * 3. Regression Tests (Public routes, coordinator workflows, existing integrations)
 */

const http = require('http');
const { generateJwt, verifyJwt, SESSION_DURATION_SECONDS } = require('../backend/components/security');

const BASE_HOST = 'localhost';
const BASE_PORT = 3000;
const BASE_URL = `http://${BASE_HOST}:${BASE_PORT}`;

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  \x1b[32m✓\x1b[0m ${message}`);
    return true;
  } else {
    console.error(`  \x1b[31m✗ FAILED:\x1b[0m ${message}`);
    return false;
  }
}

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: BASE_HOST,
      port: BASE_PORT,
      ...options,
      headers: { ...(options.headers || {}) }
    };

    if (postData) {
      if (!reqOptions.headers['Content-Type']) {
        reqOptions.headers['Content-Type'] = 'application/json';
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAllAuthTests() {
  console.log('\n\x1b[1m\x1b[36m============================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m   DELTA ENGINE — ADMIN AUTH & 3-HOUR SESSION VERIFICATION   \x1b[0m');
  console.log('\x1b[1m\x1b[36m============================================================\x1b[0m\n');

  // =========================================================================
  // 1. ADMIN ACCESS TESTS
  // =========================================================================
  console.log('\x1b[1m[GROUP 1] Admin Access & Server-Side Route Guard Tests\x1b[0m');

  // Test 1.1: Logged-out user opens admin URL directly -> redirected to login
  const resAdminLoggedOut = await request({ path: '/admin', method: 'GET' });
  assert(
    resAdminLoggedOut.statusCode === 302 &&
    resAdminLoggedOut.headers['location'] &&
    resAdminLoggedOut.headers['location'].includes('login.html'),
    'Logged-out user directly requesting /admin is redirected to login (HTTP 302)'
  );

  const resAdminHtmlLoggedOut = await request({ path: '/admin.html', method: 'GET' });
  assert(
    resAdminHtmlLoggedOut.statusCode === 302 &&
    resAdminHtmlLoggedOut.headers['location'] &&
    resAdminHtmlLoggedOut.headers['location'].includes('login.html'),
    'Logged-out user directly requesting /admin.html is redirected to login (HTTP 302)'
  );

  // Test 1.2: Logged-out user attempts to call admin APIs directly -> rejected with 401
  const resActionLoggedOut = await request(
    { path: '/api/admin/action', method: 'POST' },
    JSON.stringify({ action: 'freeze_swarm' })
  );
  assert(resActionLoggedOut.statusCode === 401, 'Logged-out POST /api/admin/action rejected with HTTP 401 Unauthorized');

  const resLimiterLoggedOut = await request(
    { path: '/api/admin/toggle-limiter', method: 'POST' },
    JSON.stringify({ type: 'llmLimiter', enabled: true })
  );
  assert(resLimiterLoggedOut.statusCode === 401, 'Logged-out POST /api/admin/toggle-limiter rejected with HTTP 401 Unauthorized');

  const resAutopilotLoggedOut = await request(
    { path: '/api/admin/toggle-autopilot', method: 'POST' },
    JSON.stringify({ enabled: true })
  );
  assert(resAutopilotLoggedOut.statusCode === 401, 'Logged-out POST /api/admin/toggle-autopilot rejected with HTTP 401 Unauthorized');

  const resStressLoggedOut = await request(
    { path: '/api/admin/stress-test-500', method: 'POST' },
    JSON.stringify({})
  );
  assert(resStressLoggedOut.statusCode === 401, 'Logged-out POST /api/admin/stress-test-500 rejected with HTTP 401 Unauthorized');

  const resForensicLoggedOut = await request({ path: '/api/audit/forensic-logs', method: 'GET' });
  assert(resForensicLoggedOut.statusCode === 401, 'Logged-out GET /api/audit/forensic-logs rejected with HTTP 401 Unauthorized');

  // Test 1.3: Authenticated normal user (COORDINATOR) logs in
  const coordLogin = await request(
    { path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ username: 'Suryansh', password: process.env.OPERATOR_PASSWORD || 'delta2026' })
  );
  assert(coordLogin.statusCode === 200 && coordLogin.json?.user?.role === 'COORDINATOR', 'Coordinator Suryansh logged in with role COORDINATOR');
  const coordToken = coordLogin.json?.token;

  // Test 1.4: Authenticated normal user opens admin URL -> access denied (403)
  const coordAdminAccess = await request({
    path: '/admin',
    method: 'GET',
    headers: { 'Cookie': `delta_session_token=${coordToken}` }
  });
  assert(coordAdminAccess.statusCode === 403, 'Authenticated coordinator accessing /admin receives HTTP 403 Forbidden');

  // Test 1.5: Authenticated normal user attempts admin API request -> rejected with 403
  const coordAdminApi = await request(
    { 
      path: '/api/admin/action', 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${coordToken}` } 
    },
    JSON.stringify({ action: 'freeze_swarm' })
  );
  assert(coordAdminApi.statusCode === 403, 'Coordinator calling POST /api/admin/action rejected with HTTP 403 Forbidden');

  const coordLimiterApi = await request(
    { 
      path: '/api/admin/toggle-limiter', 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${coordToken}` } 
    },
    JSON.stringify({ type: 'llmLimiter', enabled: true })
  );
  assert(coordLimiterApi.statusCode === 403, 'Coordinator calling POST /api/admin/toggle-limiter rejected with HTTP 403 Forbidden');

  // Test 1.6: Valid administrator logs in
  const adminLogin = await request(
    { path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ username: 'admin_marcus', password: process.env.ADMIN_PASSWORD || 'deltaAdmin2026!' })
  );
  assert(adminLogin.statusCode === 200 && adminLogin.json?.user?.role === 'ADMIN', 'Super Admin Marcus Aurelius logged in with role ADMIN');
  const adminToken = adminLogin.json?.token;

  // Test 1.7: Valid administrator opens admin dashboard -> access granted (HTTP 200)
  const adminDashboardAccess = await request({
    path: '/admin',
    method: 'GET',
    headers: { 'Cookie': `delta_session_token=${adminToken}` }
  });
  assert(adminDashboardAccess.statusCode === 200 && adminDashboardAccess.body.includes('Super Admin Command Center'), 'Administrator accessing /admin receives HTTP 200 and admin dashboard HTML');

  // Test 1.8: Administrator page refresh retains valid access
  const adminRefresh = await request({
    path: '/admin.html',
    method: 'GET',
    headers: { 'Cookie': `delta_session_token=${adminToken}` }
  });
  assert(adminRefresh.statusCode === 200 && adminRefresh.body.length > 1000, 'Page refresh with active admin cookie retains valid dashboard access');

  // Test 1.9: Valid administrator can execute protected admin operations
  const adminActionRes = await request(
    { 
      path: '/api/admin/action', 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${adminToken}` } 
    },
    JSON.stringify({ action: 'clear_locks' })
  );
  assert(adminActionRes.statusCode === 200 && adminActionRes.json?.success === true, 'Administrator successfully executes POST /api/admin/action');

  // Test 1.10: Client-side role manipulation does NOT grant admin access
  // Attacker crafts token with forged/unverified payload or passes fake role
  const forgedToken = coordToken.substring(0, coordToken.lastIndexOf('.') + 1) + 'fake_signature';
  const forgedCall = await request(
    { 
      path: '/api/admin/action', 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${forgedToken}` } 
    },
    JSON.stringify({ action: 'freeze_swarm' })
  );
  assert(forgedCall.statusCode === 401, 'Tampered token signature is rejected by cryptographic verification');

  // Attacker tries to pass role: 'admin' during coordinator login to elevate privilege
  const privilegeEscalationAttempt = await request(
    { path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ username: 'Suryansh', password: process.env.OPERATOR_PASSWORD || 'delta2026', role: 'admin' })
  );
  assert(
    privilegeEscalationAttempt.statusCode === 200 && privilegeEscalationAttempt.json?.user?.role !== 'ADMIN',
    'Client payload role: "admin" does not elevate non-admin account to ADMIN'
  );

  // Test 1.11: Expired administrator session denies access
  const expiredAdminToken = generateJwt({
    id: 'usr_admin',
    name: 'Marcus Aurelius',
    role: 'ADMIN',
    title: 'Super Admin & Systems Commander'
  }, -10); // Expired 10 seconds ago

  const expiredCall = await request(
    { 
      path: '/api/admin/action', 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${expiredAdminToken}` } 
    },
    JSON.stringify({ action: 'freeze_swarm' })
  );
  assert(expiredCall.statusCode === 401, 'Expired administrator token is rejected with HTTP 401');

  const expiredPageCall = await request({
    path: '/admin',
    method: 'GET',
    headers: { 'Cookie': `delta_session_token=${expiredAdminToken}` }
  });
  assert(expiredPageCall.statusCode === 302 && expiredPageCall.headers['location'].includes('login.html'), 'Expired admin session cookie redirects to login flow');

  // =========================================================================
  // 2. 3-HOUR USER SESSION TESTS
  // =========================================================================
  console.log('\n\x1b[1m[GROUP 2] 3-Hour Persistent User Session Tests\x1b[0m');

  // Test 2.1: Login creates valid session with 3-hour duration (10800 seconds)
  const sessionVerified = verifyJwt(adminToken);
  assert(sessionVerified !== null, 'Cryptographic JWT signature successfully verified');
  const nowSec = Math.floor(Date.now() / 1000);
  const remainingLifetimeSec = sessionVerified.exp - nowSec;
  assert(
    remainingLifetimeSec >= 10700 && remainingLifetimeSec <= 10800,
    `Session token issued with at least 3 hours lifetime (${remainingLifetimeSec}s remaining / target 10800s)`
  );

  // Test 2.2: Session cookie configuration includes 3-hour Max-Age
  const setCookieHeader = adminLogin.headers['set-cookie']?.[0] || '';
  assert(
    setCookieHeader.includes('Max-Age=10800') && setCookieHeader.includes('HttpOnly') && setCookieHeader.includes('Path=/'),
    'Set-Cookie header enforces 3-hour Max-Age=10800, HttpOnly, and Path=/'
  );

  // Test 2.3: Session token refresh renews session for another 3 hours
  const refreshRes = await request(
    { 
      path: '/api/auth/refresh', 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${adminToken}` } 
    },
    JSON.stringify({})
  );
  assert(refreshRes.statusCode === 200 && refreshRes.json?.success === true, 'POST /api/auth/refresh returns success');
  const refreshedToken = refreshRes.json?.token;
  const refreshedPayload = verifyJwt(refreshedToken);
  assert(refreshedPayload && (refreshedPayload.exp - Math.floor(Date.now() / 1000) >= 10700), 'Refreshed token extends validity for another 3-hour period');

  // Test 2.4: Refresh endpoint rejects invalid/expired tokens
  const badRefresh = await request(
    { 
      path: '/api/auth/refresh', 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${expiredAdminToken}` } 
    },
    JSON.stringify({})
  );
  assert(badRefresh.statusCode === 401, 'POST /api/auth/refresh with expired token requires re-authentication');

  // Test 2.5: User credentials & passwords are NEVER stored in session tokens
  assert(sessionVerified.password === undefined, 'User password is not present in token payload');
  assert(refreshedPayload.password === undefined, 'User password is not present in refreshed token payload');
  assert(!JSON.stringify(adminLogin.json).includes('deltaAdmin2026!'), 'User password is not exposed in login response payload');

  // Test 2.6: Logout revokes session cookie and prevents continued authenticated access
  const logoutRes = await request(
    { 
      path: '/api/auth/logout', 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${adminToken}` } 
    },
    JSON.stringify({ username: 'admin_marcus', role: 'ADMIN' })
  );
  assert(logoutRes.statusCode === 200, 'POST /api/auth/logout terminates session cleanly');
  const clearedCookie = logoutRes.headers['set-cookie']?.[0] || '';
  assert(clearedCookie.includes('Max-Age=0'), 'Logout clears session cookie (Max-Age=0)');

  // Test 2.7: Invalid password rejects authentication
  const failedAuth = await request(
    { path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ username: 'admin_marcus', password: 'wrongPassword!' })
  );
  assert(failedAuth.statusCode === 401 && failedAuth.json?.success === false, 'Invalid credentials safely rejected (HTTP 401)');

  // Test 2.8: Empty password rejects authentication
  const emptyAuth = await request(
    { path: '/api/auth/login', method: 'POST' },
    JSON.stringify({ username: 'admin_marcus', password: '' })
  );
  assert(emptyAuth.statusCode === 401, 'Empty password strictly rejected');

  // =========================================================================
  // 3. REGRESSION & EXISTING PIPELINE TESTS
  // =========================================================================
  console.log('\n\x1b[1m[GROUP 3] Regression & Existing Pipeline Integrity Tests\x1b[0m');

  // Test 3.1: Public / coordinator endpoints remain accessible
  const stateRes = await request({ path: '/api/state', method: 'GET' });
  assert(stateRes.statusCode === 200 && stateRes.json?.activeScenario === 'CONFERENCE', 'GET /api/state baseline pipeline operational');

  const scenariosRes = await request({ path: '/api/scenarios', method: 'GET' });
  assert(scenariosRes.statusCode === 200 && scenariosRes.json?.scenarios?.length === 5, 'GET /api/scenarios domain registry intact (5 domains)');

  const roomsRes = await request({ path: '/api/rooms', method: 'GET' });
  assert(roomsRes.statusCode === 200, 'GET /api/rooms venue status operational');

  const volunteersRes = await request({ path: '/api/volunteers', method: 'GET' });
  assert(volunteersRes.statusCode === 200 && Array.isArray(volunteersRes.json?.volunteers), 'GET /api/volunteers on-ground staff intact');

  // Test 3.2: Static pages remain accessible
  const indexHtml = await request({ path: '/', method: 'GET' });
  assert(indexHtml.statusCode === 200 && indexHtml.body.includes('DELTA ENGINE'), 'Root dashboard (/) accessible');

  const loginHtml = await request({ path: '/login.html', method: 'GET' });
  assert(loginHtml.statusCode === 200 && loginHtml.body.includes('Sign In'), 'Login portal (/login.html) accessible');

  const volunteerHtml = await request({ path: '/volunteer.html', method: 'GET' });
  assert(volunteerHtml.statusCode === 200 && volunteerHtml.body.includes('FIELD MARSHAL'), 'Volunteer clicker (/volunteer.html) accessible');

  const appCss = await request({ path: '/app.css', method: 'GET' });
  assert(appCss.statusCode === 200 && appCss.body.length > 50000, 'Global Neubrutalist CSS (/app.css) intact');

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n\x1b[1m\x1b[36m============================================================\x1b[0m');
  if (passedCount === totalCount) {
    console.log(`\x1b[1m\x1b[32m  ALL SECURITY & SESSION TESTS PASSED: ${passedCount}/${totalCount} (100%)\x1b[0m`);
  } else {
    console.log(`\x1b[1m\x1b[31m  TESTS FAILED: ${passedCount}/${totalCount} passed\x1b[0m`);
  }
  console.log('\x1b[1m\x1b[36m============================================================\x1b[0m\n');

  process.exit(passedCount === totalCount ? 0 : 1);
}

runAllAuthTests().catch(err => {
  console.error('Fatal error during auth test runner:', err);
  process.exit(1);
});
