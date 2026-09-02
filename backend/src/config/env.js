import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default('postgresql://gov_platform:change_this_development_password@localhost:5433/gujarat_video'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  OPENSEARCH_URL: z.string().optional(),
  AI_MODEL_API_URL: z.string().optional().or(z.literal('')),
  AI_CLIENT_MODE: z.enum(['mock', 'http']).default('mock'),
  JWT_SECRET: z.string().min(16).default('replace_with_a_long_development_secret'),
  MAX_LIVE_VIEWS: z.coerce.number().int().min(1).max(64).default(16),
  AI_METADATA_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30)
});

export const env = envSchema.parse(process.env);
