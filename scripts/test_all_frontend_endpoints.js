import { createApp } from '../backend/src/app.js';
import { env } from '../backend/src/config/env.js';

console.log('===============================================================');
console.log('  Testing Every Frontend API Endpoint Against Live Backend DB  ');
console.log('===============================================================');

let server;
let baseUrl;
let stateAdminToken = '';
let deptHeadToken = '';
let testResults = [];

function recordResult(group, endpoint, method, status, success, details = '') {
  testResults.push({ group, endpoint, method, status, success, details });
  const icon = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [${group}] ${method} ${endpoint} (Status: ${status}) ${details}`);
}

async function request(endpoint, { method = 'GET', body = null, token = null, headers = {} } = {}) {
  const customHeaders = {
    'Accept': 'application/json',
    ...headers
  };
  if (token) {
    customHeaders['Authorization'] = `Bearer ${token}`;
  }
  const options = {
    method,
    headers: customHeaders
  };
  if (body) {
    customHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${endpoint}`, options);
  let data = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, ok: res.ok, data };
}

async function runAllTests() {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      console.log(`Backend server started for testing at: ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // ------------------------------------------------------------------------
    // Group 1: Health Endpoints
    // ------------------------------------------------------------------------
    console.log('\n--- Group 1: System Health Endpoints ---');
    {
      const res = await request('/health');
      recordResult('Health', '/health', 'GET', res.status, res.status === 200 && res.data.success);
    }
    {
      const res = await request('/health/live');
      recordResult('Health', '/health/live', 'GET', res.status, res.status === 200 && res.data.data?.status === 'UP');
    }
    {
      const res = await request('/health/ready');
      recordResult('Health', '/health/ready', 'GET', res.status, res.status === 200 && res.data.success);
    }

    // ------------------------------------------------------------------------
    // Group 2: Auth Endpoints
    // ------------------------------------------------------------------------
    console.log('\n--- Group 2: Authentication & Identity ---');
    {
      // Invalid credentials
      const res = await request('/auth/login', {
        method: 'POST',
        body: { email: 'wrong@example.com', password: 'bad_password' }
      });
      recordResult('Auth', '/auth/login (invalid)', 'POST', res.status, res.status === 401 && !res.data.success);
    }
    {
      // Valid State Admin Login
      const res = await request('/auth/login', {
        method: 'POST',
        body: { email: 'state.admin@example.gov.in', password: 'GovDevOnly!2026' }
      });
      const ok = res.status === 200 && res.data.success && Boolean(res.data.data?.token);
      if (ok) stateAdminToken = res.data.data.token;
      recordResult('Auth', '/auth/login (State Admin)', 'POST', res.status, ok, `User: ${res.data.data?.user?.displayName}`);
    }
    {
      // Valid Department Head Login
      const res = await request('/auth/login', {
        method: 'POST',
        body: { email: 'police.head@example.gov.in', password: 'GovDevOnly!2026' }
      });
      const ok = res.status === 200 && res.data.success && Boolean(res.data.data?.token);
      if (ok) deptHeadToken = res.data.data.token;
      recordResult('Auth', '/auth/login (Police Dept Head)', 'POST', res.status, ok, `User: ${res.data.data?.user?.displayName}`);
    }
    {
      // GET /auth/me unauthenticated
      const res = await request('/auth/me');
      recordResult('Auth', '/auth/me (unauthenticated)', 'GET', res.status, res.status === 401);
    }
    {
      // GET /auth/me with State Admin token
      const res = await request('/auth/me', { token: stateAdminToken });
      recordResult('Auth', '/auth/me (State Admin)', 'GET', res.status, res.status === 200 && res.data.data?.roles?.includes('STATE_ADMIN'));
    }
    {
      // POST /auth/logout
      const res = await request('/auth/logout', { method: 'POST', token: stateAdminToken });
      recordResult('Auth', '/auth/logout', 'POST', res.status, res.status === 200 && res.data.success);
    }

    // ------------------------------------------------------------------------
    // Group 3: Administration (Departments, Cities, Users)
    // ------------------------------------------------------------------------
    console.log('\n--- Group 3: Administration ---');
    let departments = [];
    let cities = [];
    {
      const res = await request('/departments', { token: stateAdminToken });
      departments = res.data.data || [];
      recordResult('Admin', '/departments', 'GET', res.status, res.status === 200 && departments.length > 0, `Count: ${departments.length}`);
    }
    {
      const res = await request('/cities', { token: stateAdminToken });
      cities = res.data.data || [];
      recordResult('Admin', '/cities', 'GET', res.status, res.status === 200 && cities.length > 0, `Count: ${cities.length}`);
    }
    {
      const res = await request('/users?limit=50', { token: stateAdminToken });
      recordResult('Admin', '/users?limit=50', 'GET', res.status, res.status === 200 && res.data.data?.items?.length > 0, `Count: ${res.data.data?.items?.length}`);
    }

    let createdUserId = null;
    {
      // Create user
      const testEmail = `test.operator.${Date.now()}@example.gov.in`;
      const res = await request('/users', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          email: testEmail,
          displayName: 'Automated Test Operator',
          password: 'GovDevOnly!2026',
          departmentId: departments[0]?.id,
          roles: ['OPERATOR'],
          cityIds: [cities[0]?.id]
        }
      });
      const ok = res.status === 201 && res.data.success;
      if (ok) createdUserId = res.data.data?.id;
      recordResult('Admin', '/users', 'POST', res.status, ok, `Created ID: ${createdUserId}`);
    }

    if (createdUserId) {
      // PATCH /users/:id/status
      const res1 = await request(`/users/${createdUserId}/status`, {
        method: 'PATCH',
        token: stateAdminToken,
        body: { status: 'SUSPENDED' }
      });
      recordResult('Admin', `/users/:id/status (SUSPENDED)`, 'PATCH', res1.status, res1.status === 200 && res1.data.data?.status === 'SUSPENDED');

      const res2 = await request(`/users/${createdUserId}/status`, {
        method: 'PATCH',
        token: stateAdminToken,
        body: { status: 'ACTIVE' }
      });
      recordResult('Admin', `/users/:id/status (ACTIVE)`, 'PATCH', res2.status, res2.status === 200 && res2.data.data?.status === 'ACTIVE');
    }

    // ------------------------------------------------------------------------
    // Group 4: Cameras & Map
    // ------------------------------------------------------------------------
    console.log('\n--- Group 4: Cameras & Map ---');
    {
      const res = await request('/cameras/summary', { token: stateAdminToken });
      recordResult('Cameras', '/cameras/summary', 'GET', res.status, res.status === 200 && res.data.success, `Total: ${res.data.data?.totalCameras}`);
    }
    let cameraList = [];
    {
      const res = await request('/cameras?limit=100', { token: stateAdminToken });
      cameraList = res.data.data?.items || [];
      recordResult('Cameras', '/cameras?limit=100', 'GET', res.status, res.status === 200 && cameraList.length > 0, `Loaded: ${cameraList.length}`);
    }
    {
      // Filter by city
      const res = await request(`/cameras?city=Ahmedabad&limit=10`, { token: stateAdminToken });
      recordResult('Cameras', '/cameras?city=Ahmedabad', 'GET', res.status, res.status === 200 && res.data.data?.items !== undefined, `Found: ${res.data.data?.items?.length}`);
    }
    {
      // Camera map clustering endpoint
      const res = await request(`/cameras/map?zoom=12&cityId=${cities[0]?.id || ''}`, { token: stateAdminToken });
      recordResult('Cameras', '/cameras/map', 'GET', res.status, res.status === 200 && res.data.success, `Clusters/Points: ${res.data.data?.features?.length ?? (Array.isArray(res.data.data) ? res.data.data.length : 'ok')}`);
    }

    let createdCameraId = null;
    {
      // Register Camera
      const extId = `CAM-TEST-${Date.now()}`;
      const res = await request('/cameras', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          externalId: extId,
          cameraNumber: `GJ-TST-${Math.floor(Math.random() * 900 + 100)}`,
          name: `Automated Test Junction Cam`,
          departmentId: departments[0]?.id,
          cityId: cities[0]?.id,
          location: 'Test Crossroads, Sector 10',
          streamProtocol: 'RTSP',
          streamReference: 'rtsp://10.0.0.10/stream1',
          latitude: 23.0225,
          longitude: 72.5714,
          metadata: { test: true }
        }
      });
      const ok = res.status === 201 && res.data.success;
      if (ok) createdCameraId = res.data.data?.id;
      recordResult('Cameras', '/cameras', 'POST', res.status, ok, `New Camera ID: ${createdCameraId}`);
    }

    if (createdCameraId) {
      const res = await request(`/cameras/${createdCameraId}`, { token: stateAdminToken });
      recordResult('Cameras', `/cameras/:id`, 'GET', res.status, res.status === 200 && res.data.data?.id === createdCameraId);

      const delRes = await request(`/cameras/${createdCameraId}`, { method: 'DELETE', token: stateAdminToken });
      recordResult('Cameras', `/cameras/:id`, 'DELETE', delRes.status, delRes.status === 200 && delRes.data.success);
    }

    const testCam = cameraList[0];

    // ------------------------------------------------------------------------
    // Group 5: Streaming Sessions
    // ------------------------------------------------------------------------
    console.log('\n--- Group 5: Streaming Sessions ---');
    {
      const res = await request('/streams/stats', { token: stateAdminToken });
      recordResult('Streams', '/streams/stats', 'GET', res.status, res.status === 200 && typeof res.data.data?.activeViews === 'number');
    }
    let streamSessionId = null;
    if (testCam) {
      const res = await request('/streams/session', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          cameraId: testCam.id,
          streamType: 'AI_ANNOTATED'
        }
      });
      const ok = res.status === 200 && res.data.success && Boolean(res.data.data?.sessionId);
      if (ok) streamSessionId = res.data.data.sessionId;
      recordResult('Streams', '/streams/session', 'POST', res.status, ok, `Session ID: ${streamSessionId}`);
    }

    if (streamSessionId) {
      const res = await request('/streams/session/release', {
        method: 'POST',
        token: stateAdminToken,
        body: { sessionId: streamSessionId }
      });
      recordResult('Streams', '/streams/session/release', 'POST', res.status, res.status === 200 && res.data.success);
    }

    // ------------------------------------------------------------------------
    // Group 6: AI Status & Jobs
    // ------------------------------------------------------------------------
    console.log('\n--- Group 6: AI Status & Jobs ---');
    {
      const res = await request('/ai/status', { token: stateAdminToken });
      recordResult('AI', '/ai/status', 'GET', res.status, res.status === 200 && res.data.success, `Status: ${res.data.data?.status}`);
    }
    {
      const res = await request('/ai/jobs', { token: stateAdminToken });
      recordResult('AI', '/ai/jobs', 'GET', res.status, res.status === 200 && res.data.success);
    }
    let aiJobId = null;
    if (testCam) {
      const res = await request('/ai/jobs', {
        method: 'POST',
        token: stateAdminToken,
        body: { cameraId: testCam.id }
      });
      const ok = (res.status === 201 || res.status === 200) && res.data.success;
      if (ok) aiJobId = res.data.data?.job?.id || res.data.data?.job?.externalJobId;
      recordResult('AI', '/ai/jobs', 'POST', res.status, ok, `Job ID: ${aiJobId}`);
    }
    if (aiJobId) {
      const res = await request(`/ai/jobs/${aiJobId}/stop`, {
        method: 'POST',
        token: stateAdminToken
      });
      recordResult('AI', `/ai/jobs/:id/stop`, 'POST', res.status, res.status === 200 && res.data.success);
    }
    if (testCam) {
      // Simulate detection
      const res = await request('/ai/simulate-detection', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          cameraId: testCam.id,
          plateNumber: 'GJ01AB9999',
          vehicleType: 'SEDAN',
          vehicleColor: 'SILVER',
          confidence: 0.96
        }
      });
      recordResult('AI', '/ai/simulate-detection', 'POST', res.status, res.status === 200 && res.data.success);

      // Ingest detection (internal service endpoint)
      const ingestRes = await request('/ai/detections/ingest', {
        method: 'POST',
        body: {
          cameraId: testCam.id,
          plateNumber: 'GJ01AB8888',
          vehicleType: 'SUV',
          vehicleColor: 'BLACK',
          confidence: 0.98
        }
      });
      recordResult('AI', '/ai/detections/ingest', 'POST', ingestRes.status, ingestRes.status === 200 && ingestRes.data.success);
    }

    // ------------------------------------------------------------------------
    // Group 7: Search
    // ------------------------------------------------------------------------
    console.log('\n--- Group 7: Search ---');
    let firstDetection = null;
    {
      const res = await request('/search?limit=8', { token: stateAdminToken });
      const items = res.data.data?.items || [];
      if (items.length > 0) firstDetection = items[0];
      recordResult('Search', '/search?limit=8', 'GET', res.status, res.status === 200 && res.data.success, `Items: ${items.length}`);
    }
    {
      // Plate search standard
      const res = await request('/search?plateNumber=GJ&limit=10', { token: stateAdminToken });
      recordResult('Search', '/search?plateNumber=GJ', 'GET', res.status, res.status === 200 && res.data.success, `Items: ${res.data.data?.items?.length}`);
    }
    {
      // Plate search alias (used in MapPage)
      const res = await request('/search?plate=GJ&limit=10', { token: stateAdminToken });
      recordResult('Search', '/search?plate=GJ (alias)', 'GET', res.status, res.status === 200 && res.data.success, `Items: ${res.data.data?.items?.length}`);
    }
    {
      // Vehicle type search
      const res = await request('/search?vehicleType=CAR&limit=10', { token: stateAdminToken });
      recordResult('Search', '/search?vehicleType=CAR', 'GET', res.status, res.status === 200 && res.data.success);
    }

    // ------------------------------------------------------------------------
    // Group 8: Watchlists
    // ------------------------------------------------------------------------
    console.log('\n--- Group 8: Watchlists ---');
    let watchlists = [];
    {
      const res = await request('/watchlists', { token: stateAdminToken });
      watchlists = res.data.data || [];
      recordResult('Watchlists', '/watchlists', 'GET', res.status, res.status === 200 && Array.isArray(watchlists), `Count: ${watchlists.length}`);
    }
    let createdWatchlistId = null;
    {
      const res = await request('/watchlists', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          name: `Test High Priority Watchlist ${Date.now()}`,
          entityType: 'PLATE',
          scope: 'GLOBAL',
          description: 'Automated test target vehicle list'
        }
      });
      const ok = res.status === 201 && res.data.success;
      if (ok) createdWatchlistId = res.data.data?.id;
      recordResult('Watchlists', '/watchlists', 'POST', res.status, ok, `ID: ${createdWatchlistId}`);
    }

    let createdItemId = null;
    if (createdWatchlistId) {
      const res = await request(`/watchlists/${createdWatchlistId}`, { token: stateAdminToken });
      recordResult('Watchlists', `/watchlists/:id`, 'GET', res.status, res.status === 200 && res.data.data?.id === createdWatchlistId);

      const addRes = await request(`/watchlists/${createdWatchlistId}/items`, {
        method: 'POST',
        token: stateAdminToken,
        body: {
          value: 'GJ01ZZ9999',
          description: 'Suspicious vehicle test plate',
          severity: 'HIGH'
        }
      });
      const itemOk = addRes.status === 201 && addRes.data.success;
      if (itemOk) createdItemId = addRes.data.data?.id;
      recordResult('Watchlists', `/watchlists/:id/items`, 'POST', addRes.status, itemOk, `Item ID: ${createdItemId}`);
    }

    if (createdWatchlistId && createdItemId) {
      const delRes = await request(`/watchlists/${createdWatchlistId}/items/${createdItemId}`, {
        method: 'DELETE',
        token: stateAdminToken
      });
      recordResult('Watchlists', `/watchlists/:id/items/:itemId`, 'DELETE', delRes.status, delRes.status === 200 && delRes.data.success);
    }

    // ------------------------------------------------------------------------
    // Group 9: Alerts & Rules
    // ------------------------------------------------------------------------
    console.log('\n--- Group 9: Alerts & Rules ---');
    let alerts = [];
    {
      const res = await request('/alerts?limit=10', { token: stateAdminToken });
      alerts = res.data.data?.items || [];
      recordResult('Alerts', '/alerts?limit=10', 'GET', res.status, res.status === 200 && res.data.success, `Count: ${alerts.length}`);
    }
    {
      const res = await request('/alerts/rules', { token: stateAdminToken });
      recordResult('Alerts', '/alerts/rules', 'GET', res.status, res.status === 200 && res.data.success);
    }
    {
      const res = await request('/alerts/rules', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          name: `Speeding / Anomaly Rule ${Date.now()}`,
          scope: 'GLOBAL',
          severity: 'HIGH',
          conditions: { eventType: 'ANPR_MATCH', targetCategory: 'SUSPICIOUS' }
        }
      });
      recordResult('Alerts', '/alerts/rules', 'POST', res.status, res.status === 201 && res.data.success);
    }
    if (alerts.length > 0) {
      const testAlert = alerts[0];
      const res = await request(`/alerts/${testAlert.id}`, { token: stateAdminToken });
      recordResult('Alerts', `/alerts/:id`, 'GET', res.status, res.status === 200 && res.data.data?.id === testAlert.id);

      // Ack alert
      const ackRes = await request(`/alerts/${testAlert.id}/acknowledge`, {
        method: 'POST',
        token: stateAdminToken
      });
      // status 200 or 409 if already acknowledged
      const ackOk = ackRes.status === 200 || ackRes.status === 409;
      recordResult('Alerts', `/alerts/:id/acknowledge`, 'POST', ackRes.status, ackOk, ackRes.data.message);

      // Resolve alert
      const resRes = await request(`/alerts/${testAlert.id}/resolve`, {
        method: 'POST',
        token: stateAdminToken,
        body: { resolutionNotes: 'Verified and resolved during automated endpoint test.' }
      });
      const resOk = resRes.status === 200 || resRes.status === 409;
      recordResult('Alerts', `/alerts/:id/resolve`, 'POST', resRes.status, resOk, resRes.data.message);
    }

    // ------------------------------------------------------------------------
    // Group 10: Investigations
    // ------------------------------------------------------------------------
    console.log('\n--- Group 10: Investigations ---');
    let investigations = [];
    {
      const res = await request('/investigations?limit=20', { token: stateAdminToken });
      investigations = res.data.data?.items || [];
      recordResult('Investigations', '/investigations?limit=20', 'GET', res.status, res.status === 200 && res.data.success, `Count: ${investigations.length}`);
    }
    let createdCaseId = null;
    {
      const res = await request('/investigations', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          title: `Inter-city Transit Case #${Math.floor(Math.random() * 9000 + 1000)}`,
          description: 'Comprehensive investigation into multiple tollway detections and ANPR sightings.',
          targetType: 'PLATE',
          targetValue: 'GJ01TEST99',
          intervalMinutes: 60,
          expiresAt: null
        }
      });
      const ok = res.status === 201 && res.data.success;
      if (ok) createdCaseId = res.data.data?.id;
      recordResult('Investigations', '/investigations', 'POST', res.status, ok, `Case Number: ${res.data.data?.caseNumber}`);
    }

    if (createdCaseId) {
      const res = await request(`/investigations/${createdCaseId}`, { token: stateAdminToken });
      recordResult('Investigations', `/investigations/:id`, 'GET', res.status, res.status === 200 && res.data.data?.id === createdCaseId);

      // Submit decision
      const decRes = await request(`/investigations/${createdCaseId}/decision`, {
        method: 'POST',
        token: stateAdminToken,
        body: {
          status: 'RESOLVED',
          decisionNotes: 'Investigation successfully completed with verified findings.'
        }
      });
      recordResult('Investigations', `/investigations/:id/decision`, 'POST', decRes.status, decRes.status === 200 && decRes.data.success);

      if (firstDetection) {
        const attachRes = await request(`/investigations/${createdCaseId}/attach-detection`, {
          method: 'POST',
          token: stateAdminToken,
          body: {
            detectionId: firstDetection.id,
            notes: 'Linked as primary sighting evidence.',
            relevanceScore: 0.95
          }
        });
        recordResult('Investigations', `/investigations/:id/attach-detection`, 'POST', attachRes.status, attachRes.status === 200 && attachRes.data.success);
      }
    }

    // ------------------------------------------------------------------------
    // Group 11: Evidence Locker
    // ------------------------------------------------------------------------
    console.log('\n--- Group 11: Evidence Locker ---');
    {
      const res = await request('/evidence', { token: stateAdminToken });
      recordResult('Evidence', '/evidence', 'GET', res.status, res.status === 200 && res.data.success, `Items: ${res.data.data?.items?.length}`);
    }
    {
      const res = await request('/evidence', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          title: `ANPR Evidence Snapshot Capture ${Date.now()}`,
          evidenceType: 'IMAGE_SNAPSHOT',
          sourceType: 'LIVE_SNAPSHOT',
          storageReference: `https://storage.internal.gov.in/evidence/snap_${Date.now()}.jpg`,
          metadata: { plate: 'GJ01AB1234', confidence: 0.98 }
        }
      });
      const ok = res.status === 201 && res.data.success && Boolean(res.data.data?.hashSha256);
      recordResult('Evidence', '/evidence', 'POST', res.status, ok, `SHA256: ${res.data.data?.hashSha256?.slice(0, 16)}...`);
    }

    // ------------------------------------------------------------------------
    // Group 12: Reports
    // ------------------------------------------------------------------------
    console.log('\n--- Group 12: Reports ---');
    {
      const res = await request('/reports', { token: stateAdminToken });
      recordResult('Reports', '/reports', 'GET', res.status, res.status === 200 && res.data.success, `Count: ${res.data.data?.items?.length}`);
    }
    let queuedReportId = null;
    {
      const res = await request('/reports', {
        method: 'POST',
        token: stateAdminToken,
        body: {
          title: `Camera Health Operational Audit ${Date.now()}`,
          reportType: 'CAMERA_HEALTH',
          format: 'CSV',
          parameters: {}
        }
      });
      const ok = res.status === 202 && res.data.success;
      if (ok) queuedReportId = res.data.data?.id;
      recordResult('Reports', '/reports', 'POST', res.status, ok, `Report ID: ${queuedReportId}`);
    }
    if (queuedReportId) {
      // Wait 1.5s for async report generation to complete
      await new Promise((r) => setTimeout(r, 1500));
      const dlRes = await request(`/reports/${queuedReportId}/download`, { token: stateAdminToken });
      recordResult('Reports', `/reports/:id/download`, 'GET', dlRes.status, dlRes.status === 200, `Downloaded ${dlRes.data?.length || 0} bytes`);
    }

    // ------------------------------------------------------------------------
    // Group 13: Access Requests
    // ------------------------------------------------------------------------
    console.log('\n--- Group 13: Camera Access Requests ---');
    {
      const res = await request('/access-requests?direction=all', { token: stateAdminToken });
      recordResult('AccessRequests', '/access-requests?direction=all', 'GET', res.status, res.status === 200 && res.data.success);
    }
    {
      const res = await request('/access-requests?direction=incoming', { token: stateAdminToken });
      recordResult('AccessRequests', '/access-requests?direction=incoming', 'GET', res.status, res.status === 200 && res.data.success);
    }
    {
      const res = await request('/access-requests?direction=outgoing', { token: stateAdminToken });
      recordResult('AccessRequests', '/access-requests?direction=outgoing', 'GET', res.status, res.status === 200 && res.data.success);
    }

    // Test creating access request from Police Department Head to GSRTC cameras
    let createdReqId = null;
    const gsrtcDept = departments.find(d => d.code === 'GSRTC');
    const gsrtcCam = cameraList.find(c => c.departmentId === gsrtcDept?.id);

    if (gsrtcCam && deptHeadToken) {
      const expDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const res = await request('/access-requests', {
        method: 'POST',
        token: deptHeadToken,
        body: {
          cameraIds: [gsrtcCam.id],
          duration: 'TEMPORARY',
          reason: 'Investigation into inter-city highway incident requiring bus station camera feed.',
          expiresAt: expDate
        }
      });
      const ok = res.status === 201 && res.data.success;
      if (ok) createdReqId = res.data.data?.id;
      recordResult('AccessRequests', '/access-requests', 'POST', res.status, ok, `Request ID: ${createdReqId}`);
    }

    if (createdReqId) {
      const res = await request(`/access-requests/${createdReqId}`, { token: stateAdminToken });
      recordResult('AccessRequests', `/access-requests/:id`, 'GET', res.status, res.status === 200 && res.data.data?.id === createdReqId);

      // State Admin approves with override
      const decRes = await request(`/access-requests/${createdReqId}/decision`, {
        method: 'POST',
        token: stateAdminToken,
        body: {
          status: 'APPROVED',
          reason: 'Approved per inter-departmental security directive.'
        }
      });
      recordResult('AccessRequests', `/access-requests/:id/decision`, 'POST', decRes.status, decRes.status === 200 && decRes.data.success);

      // State Admin revokes
      const revRes = await request(`/access-requests/${createdReqId}/revoke`, {
        method: 'POST',
        token: stateAdminToken
      });
      recordResult('AccessRequests', `/access-requests/:id/revoke`, 'POST', revRes.status, revRes.status === 200 && revRes.data.success);
    }

    // ------------------------------------------------------------------------
    // Group 14: Audit Trail
    // ------------------------------------------------------------------------
    console.log('\n--- Group 14: Audit Logs ---');
    {
      const res = await request('/audit?limit=25', { token: stateAdminToken });
      recordResult('Audit', '/audit?limit=25', 'GET', res.status, res.status === 200 && res.data.data?.items?.length > 0, `Audit entries: ${res.data.data?.items?.length}`);
    }

  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  // ------------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('                   FINAL TEST EXECUTION SUMMARY                ');
  console.log('===============================================================');
  const total = testResults.length;
  const passed = testResults.filter(t => t.success).length;
  const failed = total - passed;
  console.log(`Total Endpoints Tested: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error(`\nFailed tests:`);
    testResults.filter(t => !t.success).forEach(t => {
      console.error(`  - [${t.group}] ${t.method} ${t.endpoint}: Status ${t.status} ${t.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL FRONTEND API ENDPOINTS PASSED WITH 100% SUCCESS!');
  }
}

runAllTests().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
