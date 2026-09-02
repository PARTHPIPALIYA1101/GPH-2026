import crypto from 'node:crypto';
import { env } from '../config/env.js';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const signature = (data) => crypto.createHmac('sha256', env.JWT_SECRET).update(data).digest('base64url');

export function createAccessToken(user) {
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ sub: user.id, roles: user.roles, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${header}.${payload}.${signature(`${header}.${payload}`)}`;
}

export function verifyAccessToken(token) {
  const [header, payload, supplied] = token.split('.');
  if (!header || !payload || !supplied || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(signature(`${header}.${payload}`)))) throw new Error('Invalid token');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (claims.exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired token');
  return claims;
}
