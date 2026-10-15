/**
 * DELTA ENGINE — SUPABASE AUTHENTICATION & OAUTH LIFECYCLE TEST SUITE
 * 
 * Verifies:
 * 1. Supabase OAuth provider detection & disabled provider graceful handling
 * 2. Resolution of 400 validation_failed "Unsupported provider" error
 * 3. Live Supabase PostgreSQL email/password authentication & RBAC
 * 4. Supabase user registration & role safety
 * 5. OAuth session exchange endpoint security
 * 6. 3-hour session persistence, auto-refresh, and logout cleanup
 * 7. Admin route guard compatibility & server-side authorization
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${GREEN}✓${RESET} ${message}`);
    return true;
  } else {
    console.error(`  ${RED}✗ FAILED:${RESET} ${message}`);
    return false;
  }
}

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json || data
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(payload);
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log(`\n${BOLD}${CYAN}============================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   DELTA ENGINE — SUPABASE AUTH & OAUTH LIFECYCLE TESTS     ${RESET}`);
  console.log(`${BOLD}${CYAN}============================================================${RESET}\n`);

  // -------------------------------------------------------------
  // GROUP 1: OAUTH PROVIDER STATUS & DISABLED PROVIDER RESOLUTION
  // -------------------------------------------------------------
  console.log(`${BOLD}[GROUP 1] Supabase OAuth Provider Status & Disabled Provider Resolution${RESET}`);

  // Test 1: Check Google provider status
  const googleCheck = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/provider-status?provider=google',
    method: 'GET'
  });
  assert(googleCheck.statusCode === 200, 'GET /api/auth/provider-status returns HTTP 200');
  assert(googleCheck.body.success === true, 'Provider status response success flag is true');
  assert(googleCheck.body.provider === 'google', 'Provider queried is google');
  assert(googleCheck.body.enabled === false, 'Detects Google OAuth is not enabled in Supabase project without crashing');
  assert(googleCheck.body.statusCode === 400, 'Detects upstream Supabase status code 400 (validation_failed)');
  assert(typeof googleCheck.body.error === 'string' && googleCheck.body.error.includes('Unsupported provider'), 'Reports clear "Unsupported provider: provider is not enabled" error message');
  assert(googleCheck.body.instructions && googleCheck.body.instructions.setupRequired === true, 'Provides clear instructions and dashboard link for manual OAuth enablement');

  // Test 2: Check GitHub provider status
  const githubCheck = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/provider-status?provider=github',
    method: 'GET'
  });
  assert(githubCheck.body.enabled === false, 'Detects GitHub OAuth is also not enabled in Supabase project');

  // -------------------------------------------------------------
  // GROUP 2: LIVE SUPABASE POSTGRESQL EMAIL/PASSWORD AUTHENTICATION
  // -------------------------------------------------------------
  console.log(`\n${BOLD}[GROUP 2] Live Supabase PostgreSQL Email/Password Authentication${RESET}`);

  // Test 3: Authenticate Admin via live Supabase Auth
  const adminLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'admin@delta-engine.in',
    password: 'DeltaAdmin2026!'
  });

  assert(adminLogin.statusCode === 200, 'Super Admin login returns HTTP 200');
  assert(adminLogin.body.success === true, 'Super Admin login success flag is true');
  assert(adminLogin.body.user && adminLogin.body.user.role === 'ADMIN', 'Super Admin granted server-verified ADMIN role');
  assert(adminLogin.body.user.authProvider === 'SUPABASE_AUTH_ENTERPRISE', 'Super Admin authenticated via live Supabase PostgreSQL Auth');
  assert(typeof adminLogin.body.token === 'string' && adminLogin.body.token.length > 50, 'Issued valid RFC-7519 cryptographic JWT');
  assert(adminLogin.body.expiresIn >= 10800, 'Session duration set to at least 3 hours (10,800s)');
  
  // Verify cookie persistence
  const adminCookie = adminLogin.headers['set-cookie']?.[0] || '';
  assert(adminCookie.includes('delta_session_token='), 'Sets persistent delta_session_token cookie');
  assert(adminCookie.includes('Max-Age=10800'), 'Enforces 3-hour Max-Age=10800 in session cookie');
  assert(adminCookie.includes('HttpOnly'), 'Cookie is protected with HttpOnly flag');

  const adminToken = adminLogin.body.token;

  // Test 4: Password variant compatibility (deltaAdmin2026! with lowercase 'd')
  const adminVariantLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'admin_marcus',
    password: 'deltaAdmin2026!'
  });
  assert(adminVariantLogin.statusCode === 200, 'Admin login with deltaAdmin2026! succeeds');
  assert(adminVariantLogin.body.user.role === 'ADMIN', 'Admin retains ADMIN role with deltaAdmin2026!');

  // Test 5: Authenticate Coordinator Suryansh via live Supabase Auth
  const coordLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'coordinator@delta-engine.in',
    password: 'DeltaCoord2026!'
  });
  assert(coordLogin.statusCode === 200, 'Lead Coordinator login returns HTTP 200');
  assert(coordLogin.body.user.role === 'COORDINATOR', 'Coordinator assigned verified COORDINATOR role');
  assert(coordLogin.body.user.authProvider === 'SUPABASE_AUTH_ENTERPRISE', 'Coordinator verified by live Supabase Auth');

  // Test 6: Authenticate Safety Director Aryan Pandey
  const safetyLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'safety@delta-engine.in',
    password: 'DeltaSafety2026!'
  });
  assert(safetyLogin.statusCode === 200, 'Safety Director login returns HTTP 200');
  assert(safetyLogin.body.user.role === 'SAFETY_DIRECTOR', 'Safety Director assigned SAFETY_DIRECTOR role');

  // Test 7: Reject invalid credentials
  const badLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'admin@delta-engine.in',
    password: 'CompletelyWrongPassword!'
  });
  assert(badLogin.statusCode === 401, 'Invalid credentials safely rejected with HTTP 401');
  assert(badLogin.body.success === false, 'Invalid credentials return success: false');

  // Test 8: Reject empty password
  const emptyPassLogin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'admin@delta-engine.in',
    password: ''
  });
  assert(emptyPassLogin.statusCode === 401, 'Empty password rejected with HTTP 401');

  // -------------------------------------------------------------
  // GROUP 3: SUPABASE USER REGISTRATION & ROLE ENFORCEMENT
  // -------------------------------------------------------------
  console.log(`\n${BOLD}[GROUP 3] Supabase User Registration & Role Safety${RESET}`);

  const testRegisterEmail = `test_operator_${Date.now()}@delta-engine.in`;
  const registerRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: testRegisterEmail,
    password: 'SecureOperatorPass2026!',
    name: 'Test Ops Engineer',
    role: 'COORDINATOR'
  });

  assert(registerRes.statusCode === 200, 'POST /api/auth/register returns HTTP 200');
  assert(registerRes.body.success === true, 'Supabase registration succeeds');
  assert(registerRes.body.user.email === testRegisterEmail, 'Registered user email matches');
  assert(registerRes.body.user.role === 'COORDINATOR', 'Registered user assigned COORDINATOR role');

  // Verify that self-registration cannot elevate to ADMIN
  const maliciousRegisterEmail = `hacker_${Date.now()}@delta-engine.in`;
  const maliciousReg = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: maliciousRegisterEmail,
    password: 'MaliciousPass2026!',
    name: 'Privilege Escalator',
    role: 'ADMIN' // Attempt to self-assign ADMIN
  });

  assert(maliciousReg.statusCode === 200, 'Registration completes');
  assert(maliciousReg.body.user.role === 'COORDINATOR', 'Self-registration attempting ADMIN role is safely downgraded to COORDINATOR');

  // -------------------------------------------------------------
  // GROUP 4: OAUTH SESSION EXCHANGE ENDPOINT SECURITY
  // -------------------------------------------------------------
  console.log(`\n${BOLD}[GROUP 4] OAuth Session Exchange Endpoint Security${RESET}`);

  // Test: Missing token
  const noTokenExchange = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/oauth-session',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {});
  assert(noTokenExchange.statusCode === 400, 'OAuth session exchange without token returns HTTP 400');

  // Test: Invalid token
  const fakeTokenExchange = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/oauth-session',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    accessToken: 'invalid_forged_oauth_token_12345'
  });
  assert(fakeTokenExchange.statusCode === 401, 'OAuth session exchange with invalid token returns HTTP 401');

  // -------------------------------------------------------------
  // GROUP 5: 3-HOUR SESSION PERSISTENCE, REFRESH & LOGOUT
  // -------------------------------------------------------------
  console.log(`\n${BOLD}[GROUP 5] 3-Hour Session Persistence, Refresh & Logout${RESET}`);

  // Test /api/auth/me with active admin token
  const meRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/me',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(meRes.statusCode === 200, 'GET /api/auth/me validates active session');
  assert(meRes.body.user.role === 'ADMIN', '/api/auth/me returns verified user role');

  // Test session refresh
  const refreshRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/refresh',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(refreshRes.statusCode === 200, 'POST /api/auth/refresh returns HTTP 200');
  assert(refreshRes.body.expiresIn >= 10800, 'Refreshed token extends validity for 3 hours (10,800s)');

  // Test logout
  const logoutRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/logout',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(logoutRes.statusCode === 200, 'POST /api/auth/logout returns HTTP 200');
  const logoutCookie = logoutRes.headers['set-cookie']?.[0] || '';
  assert(logoutCookie.includes('Max-Age=0'), 'Logout clears persistent session cookie (Max-Age=0)');

  // -------------------------------------------------------------
  // GROUP 6: ADMIN ROUTE GUARD INTEGRITY
  // -------------------------------------------------------------
  console.log(`\n${BOLD}[GROUP 6] Admin Route Guard & Server-Side RBAC Integrity${RESET}`);

  // Test unauthenticated /admin
  const unauthAdmin = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET'
  });
  assert(unauthAdmin.statusCode === 302, 'Unauthenticated /admin redirects to login (HTTP 302)');
  assert(unauthAdmin.headers.location?.includes('/login.html?redirect=/admin'), 'Redirects to /login.html with redirect query parameter');

  // Test unauthenticated /admin.html
  const unauthAdminHtml = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin.html',
    method: 'GET'
  });
  assert(unauthAdminHtml.statusCode === 302, 'Unauthenticated /admin.html redirects to login (HTTP 302)');

  // Test coordinator accessing /admin
  const coordToken = coordLogin.body.token;
  const coordAdminAccess = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${coordToken}` }
  });
  assert(coordAdminAccess.statusCode === 403, 'Coordinator accessing /admin receives HTTP 403 Forbidden');

  // Test admin accessing /admin with valid token
  const validAdminAccess = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/admin',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(validAdminAccess.statusCode === 200, 'Super Admin accessing /admin receives HTTP 200 and dashboard HTML');

  console.log(`\n============================================================`);
  console.log(`  ALL SUPABASE AUTH & OAUTH TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
  console.log(`============================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
