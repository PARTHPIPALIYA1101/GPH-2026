CREATE TYPE investigation_status AS ENUM ('OPEN', 'IN_PROGRESS', 'MATCH_FOUND', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED', 'EXPIRED');
CREATE TYPE evidence_type AS ENUM ('IMAGE_SNAPSHOT', 'METADATA_JSON', 'VIDEO_CLIP', 'REPORT_DOCUMENT');
CREATE TYPE evidence_source AS ENUM ('LIVE_SNAPSHOT', 'RECORDED_VMS');

CREATE TABLE IF NOT EXISTS investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  lead_investigator_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  status investigation_status NOT NULL DEFAULT 'OPEN',
  target_type TEXT NOT NULL DEFAULT 'PLATE',
  target_value TEXT NOT NULL,
  search_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_notes TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investigation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  interval_minutes INTEGER NOT NULL DEFAULT 360,
  cron_expression TEXT,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investigation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
  detection_id UUID NOT NULL REFERENCES detections(id) ON DELETE CASCADE,
  relevance_score REAL NOT NULL DEFAULT 1.0,
  notes TEXT,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(investigation_id, detection_id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES investigations(id) ON DELETE SET NULL,
  detection_id UUID REFERENCES detections(id) ON DELETE SET NULL,
  camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
  evidence_type evidence_type NOT NULL,
  source_type evidence_source NOT NULL,
  title TEXT NOT NULL,
  storage_reference TEXT,
  hash_sha256 TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  exported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investigations_dept_idx ON investigations(department_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS investigations_case_idx ON investigations(case_number);
CREATE INDEX IF NOT EXISTS evidence_case_idx ON evidence(case_id);
CREATE INDEX IF NOT EXISTS evidence_camera_idx ON evidence(camera_id);

INSERT INTO schema_migrations (version) VALUES ('008_investigations_and_evidence') ON CONFLICT DO NOTHING;
