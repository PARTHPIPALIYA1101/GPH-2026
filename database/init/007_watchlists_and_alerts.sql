CREATE TYPE watchlist_entity_type AS ENUM ('PLATE', 'VEHICLE', 'PERSON', 'OBJECT', 'CAMERA');
CREATE TYPE watchlist_scope AS ENUM ('DEPARTMENT', 'GLOBAL');
CREATE TYPE severity_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE alert_status AS ENUM ('NEW', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  entity_type watchlist_entity_type NOT NULL,
  scope watchlist_scope NOT NULL DEFAULT 'DEPARTMENT',
  department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  description TEXT,
  severity severity_level NOT NULL DEFAULT 'MEDIUM',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
  scope watchlist_scope NOT NULL DEFAULT 'DEPARTMENT',
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity severity_level NOT NULL DEFAULT 'MEDIUM',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
  detection_id UUID REFERENCES detections(id) ON DELETE SET NULL,
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE RESTRICT,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  severity severity_level NOT NULL DEFAULT 'MEDIUM',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status alert_status NOT NULL DEFAULT 'NEW',
  acknowledged_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS watchlists_dept_idx ON watchlists(department_id, active);
CREATE INDEX IF NOT EXISTS watchlist_items_val_idx ON watchlist_items(value) WHERE active;
CREATE INDEX IF NOT EXISTS alert_rules_dept_idx ON alert_rules(department_id, active);
CREATE INDEX IF NOT EXISTS alerts_dept_status_idx ON alerts(department_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_city_status_idx ON alerts(city_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_camera_idx ON alerts(camera_id, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('007_watchlists_and_alerts') ON CONFLICT DO NOTHING;
