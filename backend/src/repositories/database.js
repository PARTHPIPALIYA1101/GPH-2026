import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;
let pool;

export function database() {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  pool ??= new Pool({ connectionString: env.DATABASE_URL, max: 10 });
  return pool;
}
