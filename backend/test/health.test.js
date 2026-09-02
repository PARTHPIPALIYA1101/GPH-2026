import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

test('liveness endpoint is available', async () => {
  const app = createApp();
  const server = app.listen();
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health/live`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, { success: true, data: { status: 'UP' } });
  await new Promise((resolve) => server.close(resolve));
});
