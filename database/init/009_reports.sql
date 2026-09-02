CREATE TYPE report_type AS ENUM ('CAMERA_HEALTH', 'DOWNTIME', 'DETECTION_ANPR', 'ALERTS_SUMMARY', 'INVESTIGATIONS_SUMMARY', 'DEPARTMENT_ACTIVITY', 'AUDIT_TRAIL');
CREATE TYPE report_format AS ENUM ('CSV', 'JSON', 'PDF');
CREATE TYPE report_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  report_type report_type NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  format report_format NOT NULL DEFAULT 'JSON',
  status report_status NOT NULL DEFAULT 'PENDING',
  download_url TEXT,
  content TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS reports_user_dept_idx ON reports(created_by, department_id, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('009_reports') ON CONFLICT DO NOTHING;
