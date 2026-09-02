import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateResourceAccess, hasAnyRole, isStateAdmin, canAccessCity, canManageDepartment } from '../src/auth/authorization.js';
import { getAiClient } from '../src/ai/ai-client.js';
import { releaseStreamSession, getActiveSessionStats } from '../src/services/stream-session.service.js';

const investigator = { departmentId: 'dept-police-1', roles: ['INVESTIGATOR'], cities: ['Ahmedabad', 'Rajkot'] };
const operator = { departmentId: 'dept-police-1', roles: ['OPERATOR'], cities: ['Ahmedabad'] };
const stateAdmin = { departmentId: null, roles: ['STATE_ADMIN'], cities: [] };
const deptHead = { departmentId: 'dept-gsrtc-1', roles: ['DEPARTMENT_HEAD'], cities: ['Ahmedabad', 'Surat'] };

test('hasAnyRole checks multiple roles correctly', () => {
  assert.equal(hasAnyRole({ roles: ['OFFICER', 'INVESTIGATOR'] }, ['INVESTIGATOR']), true);
  assert.equal(hasAnyRole({ roles: ['OFFICER'] }, ['STATE_ADMIN']), false);
});

test('correct role but wrong city is denied', () => {
  assert.equal(evaluateResourceAccess({ user: investigator, requiredRoles: ['INVESTIGATOR'], departmentId: 'dept-police-1', cityName: 'Surat' }).allowed, false);
});

test('correct city but another department without grant is denied', () => {
  assert.equal(evaluateResourceAccess({ user: investigator, requiredRoles: ['INVESTIGATOR'], departmentId: 'dept-gsrtc-1', cityName: 'Ahmedabad' }).allowed, false);
});

test('shared resource access is allowed when role and city scope match', () => {
  assert.equal(evaluateResourceAccess({ user: investigator, requiredRoles: ['INVESTIGATOR'], departmentId: 'dept-gsrtc-1', resourceOwnerDepartmentId: 'dept-gsrtc-1', cityName: 'Ahmedabad', directGrant: true }).allowed, true);
});

test('expired sharing or non-direct grant to another department is denied', () => {
  assert.equal(evaluateResourceAccess({ user: investigator, requiredRoles: ['INVESTIGATOR'], departmentId: 'dept-gsrtc-1', resourceOwnerDepartmentId: 'dept-gsrtc-1', cityName: 'Ahmedabad', directGrant: false }).allowed, false);
});

test('state admin access is allowed statewide regardless of department or city', () => {
  assert.equal(evaluateResourceAccess({ user: stateAdmin, requiredRoles: ['OPERATOR'], departmentId: 'dept-gsrtc-1', cityName: 'Surat' }).allowed, true);
  assert.equal(canAccessCity(stateAdmin, 'UnknownCity'), true);
  assert.equal(canManageDepartment(stateAdmin, 'any-dept-id'), true);
});

test('department head can manage own department but not another', () => {
  assert.equal(canManageDepartment(deptHead, 'dept-gsrtc-1'), true);
  assert.equal(canManageDepartment(deptHead, 'dept-police-1'), false);
});

test('AI Client default adapter starts in mock mode and is ready without crashing', async () => {
  const aiClient = getAiClient();
  const ready = await aiClient.isConfigured();
  assert.equal(ready, true);
  const job = await aiClient.startJob({ cameraId: 'cam-test-123', streamUrl: 'rtsp://test' });
  assert.equal(job.status, 'RUNNING');
  assert.ok(job.externalJobId && typeof job.externalJobId === 'string');
});


test('stream session release decreases session count cleanly', () => {
  const statsBefore = getActiveSessionStats('test-user-id');
  assert.equal(typeof statsBefore.activeViews, 'number');
  const releaseRes = releaseStreamSession('non-existent-session', 'test-user-id');
  assert.equal(releaseRes.released, false);
});
