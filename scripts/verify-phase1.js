const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed || body });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('--- Verifying Phase 1 End-to-End ---');

  // 1. Unauthenticated GET /api/monitors
  const unauthRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/monitors',
    method: 'GET',
  });
  console.log(`1. Unauthenticated GET /api/monitors: HTTP ${unauthRes.statusCode} (expected 401)`);
  if (unauthRes.statusCode !== 401) throw new Error('Expected 401');

  // 2. Create monitor with Bearer token
  const token = 'dev:alice:alice@pulse.dev';
  const createRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: '/api/monitors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      name: 'Google DNS Check',
      type: 'http',
      url: 'https://dns.google',
      intervalSec: 120,
      timeoutMs: 5000,
      expectedStatus: 200,
    }
  );
  console.log(`2. Authenticated POST /api/monitors: HTTP ${createRes.statusCode} (expected 201)`);
  if (createRes.statusCode !== 201) throw new Error(`Expected 201, got ${createRes.statusCode}`);
  const monitorId = createRes.body.id;
  console.log(`   Created monitor ID: ${monitorId}`);

  // 3. List monitors
  const listRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/monitors',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`3. Authenticated GET /api/monitors: HTTP ${listRes.statusCode}, count = ${listRes.body.length}`);
  if (listRes.body.length !== 1 || listRes.body[0].id !== monitorId) throw new Error('Expected monitor in list');

  // 4. Pause monitor
  const pauseRes = await request(
    {
      hostname: 'localhost',
      port: 8080,
      path: `/api/monitors/${monitorId}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    { paused: true }
  );
  console.log(`4. Authenticated PATCH /api/monitors/${monitorId}: HTTP ${pauseRes.statusCode}, paused = ${pauseRes.body.paused}`);
  if (!pauseRes.body.paused) throw new Error('Expected paused to be true');

  // 5. Delete monitor
  const delRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/monitors/${monitorId}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`5. Authenticated DELETE /api/monitors/${monitorId}: HTTP ${delRes.statusCode}`);
  if (delRes.statusCode !== 200) throw new Error('Expected 200 for delete');

  // 6. Verify monitor is deleted
  const getRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/monitors/${monitorId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`6. GET deleted monitor: HTTP ${getRes.statusCode} (expected 404)`);
  if (getRes.statusCode !== 404) throw new Error('Expected 404 for deleted monitor');

  console.log('✅ Phase 1 End-to-End Verification PASSED!');
}

run().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
