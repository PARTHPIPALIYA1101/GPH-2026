import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;
let pool;

function databasePool() {
  if (!env.DATABASE_URL) return undefined;
  pool ??= new Pool({ connectionString: env.DATABASE_URL, max: 2, connectionTimeoutMillis: 2000 });
  return pool;
}

async function checkDatabase() {
  const client = databasePool();
  if (!client) return { status: 'NOT_CONFIGURED', required: false, postgis: false };
  try {
    const res = await client.query('SELECT PostGIS_Version() AS postgis_version');
    return { status: 'UP', required: true, postgis: Boolean(res.rows[0]?.postgis_version) };
  } catch (err) {
    return { status: 'DOWN', required: true, error: err.message };
  }
}

export async function readiness() {
  const dbHealth = await checkDatabase();
  const isHealthy = dbHealth.status === 'UP' || dbHealth.status === 'NOT_CONFIGURED';

  return {
    status: isHealthy ? 'UP' : 'DEGRADED',
    dependencies: {
      database: dbHealth,
      redis: { status: env.REDIS_URL ? 'CONFIGURED' : 'NOT_CONFIGURED', required: false },
      kafka: { status: env.KAFKA_BROKERS ? 'CONFIGURED' : 'NOT_CONFIGURED', required: false },
      opensearch: { status: env.OPENSEARCH_URL ? 'CONFIGURED' : 'NOT_CONFIGURED', required: false },
      ai: {
        status: env.AI_MODEL_API_URL ? 'CONFIGURED' : 'NOT_CONFIGURED',
        mode: env.AI_CLIENT_MODE,
        required: false
      }
    }
  };
}
