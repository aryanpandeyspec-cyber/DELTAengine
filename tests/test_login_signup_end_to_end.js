const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runVerification() {
  console.log('============================================================');
  console.log('   DELTA ENGINE: REAL SIGN-UP & LOGIN VERIFICATION SUITE    ');
  console.log('============================================================\n');

  // 1. Verify frontend/login.html does NOT contain any mock/trial credential buttons
  const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'login.html'), 'utf8');
  assert(!loginHtml.includes('1-Click Quick Operator Credentials'), 'No 1-Click quick operator credentials box');
  assert(!loginHtml.includes('fill-admin-btn'), 'No fill-admin-btn mock button');
  assert(!loginHtml.includes('fill-coord-btn'), 'No fill-coord-btn mock button');
  assert(!loginHtml.includes('fill-safety-btn'), 'No fill-safety-btn mock button');
  assert(!loginHtml.includes('demo_pass'), 'No demo_pass in login.html');
  assert(!loginHtml.includes('Marcus Aurelius'), 'No Marcus Aurelius placeholder in login.html');
  console.log('✓ UI verified: Zero mock credentials or trial ID boxes in login.html');

  // 2. Verify UI has Sign In and Create Account tabs
  assert(loginHtml.includes('id="tab-login-coordinator"'), 'Sign In tab is present');
  assert(loginHtml.includes('id="tab-login-admin"'), 'Create Account tab is present');
  assert(loginHtml.includes('id="btn-google-login"'), 'Google OAuth button is present');
  assert(loginHtml.includes('id="btn-submit-login"'), 'Submit button is present');
  assert(loginHtml.includes('id="btn-toggle-password"'), 'Password toggle button is present');
  console.log('✓ UI verified: All functional buttons and navigation tabs are present');

  // 3. Test Login with previously registered admin account (aryan.pandey777hyd@gmail.com)
  const aryanLogin = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'aryan.pandey777hyd@gmail.com',
    password: process.env.ADMIN_PASSWORD || 'DeltaAdmin2026!'
  });

  assert.strictEqual(aryanLogin.statusCode, 200, 'Aryan Pandey login returned HTTP 200');
  assert(aryanLogin.json?.success === true, 'Login success is true');
  assert.strictEqual(aryanLogin.json?.user?.role, 'ADMIN', 'Role is verified as ADMIN');
  assert(aryanLogin.json?.token, 'JWT token was issued');
  console.log('✓ Previously registered admin aryan.pandey777hyd@gmail.com authenticated as ADMIN');

  // 4. Test Login with previously registered admin@delta-engine.in
  const adminLogin = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'admin@delta-engine.in',
    password: process.env.ADMIN_PASSWORD || 'DeltaAdmin2026!'
  });

  assert.strictEqual(adminLogin.statusCode, 200, 'admin@delta-engine.in login returned HTTP 200');
  assert(adminLogin.json?.success === true, 'Login success is true');
  assert.strictEqual(adminLogin.json?.user?.role, 'ADMIN', 'Role is verified as ADMIN');
  console.log('✓ Previously registered admin@delta-engine.in authenticated as ADMIN');

  // 5. Test Register a brand-new unique operator account
  const uniqueId = Date.now();
  const newEmail = `operator_${uniqueId}@delta-engine.io`;
  const newPassword = 'SecureDeltaPassword2026!';
  const newName = `Operator ${uniqueId}`;

  const regRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: newEmail,
    password: newPassword,
    name: newName,
    role: 'COORDINATOR'
  });

  assert.strictEqual(regRes.statusCode, 200, 'New user registration returned HTTP 200');
  assert(regRes.json?.success === true, 'New user registration success is true');
  assert.strictEqual(regRes.json?.user?.email, newEmail, 'Registered user email matches');
  console.log(`✓ Real user registration succeeded for ${newEmail}`);

  // 6. Test Login immediately with newly registered account
  const newLogin = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: newEmail,
    password: newPassword
  });

  assert.strictEqual(newLogin.statusCode, 200, 'Newly registered user login returned HTTP 200');
  assert(newLogin.json?.success === true, 'Newly registered user login success is true');
  assert.strictEqual(newLogin.json?.user?.name, newName, 'User name matches registration');
  assert.strictEqual(newLogin.json?.user?.role, 'COORDINATOR', 'Role matches registration');
  assert(newLogin.json?.token, 'JWT token issued for newly registered user');
  console.log(`✓ Real user login succeeded for newly registered ${newEmail}`);

  // 7. Test invalid password rejection
  const badLogin = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: newEmail,
    password: 'IncorrectPassword!'
  });

  assert.strictEqual(badLogin.statusCode, 401, 'Invalid password rejected with HTTP 401');
  assert(badLogin.json?.success === false, 'Invalid password success is false');
  console.log('✓ Invalid password properly rejected with HTTP 401');

  // 8. Test typo tolerance (@gmai -> @gmail.com)
  const typoLogin = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'aryan.pandey777hyd@gmai',
    password: process.env.ADMIN_PASSWORD || 'DeltaAdmin2026!'
  });

  assert.strictEqual(typoLogin.statusCode, 200, 'Typo @gmai successfully auto-corrected to @gmail.com');
  assert(typoLogin.json?.success === true, 'Login succeeded despite typo');
  console.log('✓ Common email domain typo (@gmai) auto-corrected and logged in successfully');

  console.log('\n============================================================');
  console.log('   ALL 8 END-TO-END VERIFICATION CHECKS PASSED (100%)       ');
  console.log('============================================================\n');
}

runVerification().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
