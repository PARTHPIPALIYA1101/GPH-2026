CREATE TYPE ai_job_status AS ENUM ('STARTING', 'RUNNING', 'DEGRADED', 'STOPPING', 'STOPPED', 'ERROR');

CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  external_job_id TEXT,
  status ai_job_status NOT NULL DEFAULT 'STARTING',
  profile TEXT NOT NULL DEFAULT 'standard_surveillance',
  priority TEXT NOT NULL DEFAULT 'normal',
  last_latency_ms INTEGER,
  last_error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_jobs_camera_idx ON ai_jobs(camera_id, status);

INSERT INTO schema_migrations (version) VALUES ('005_ai_jobs') ON CONFLICT DO NOTHING;
