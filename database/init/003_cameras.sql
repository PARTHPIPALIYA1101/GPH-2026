CREATE TYPE camera_status AS ENUM ('CONNECTING', 'ACTIVE', 'OFFLINE', 'DEGRADED');
CREATE TYPE ai_status AS ENUM ('NOT_CONFIGURED', 'IDLE', 'PROCESSING', 'DELAYED', 'ERROR');

CREATE TABLE cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL UNIQUE,
  camera_number TEXT,
  name TEXT NOT NULL,
  managing_department_id UUID NOT NULL REFERENCES departments(id),
  city_id UUID NOT NULL REFERENCES cities(id),
  location_description TEXT NOT NULL,
  coordinates GEOMETRY(POINT, 4326),
  stream_protocol TEXT,
  stream_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status camera_status NOT NULL DEFAULT 'OFFLINE',
  ai_state ai_status NOT NULL DEFAULT 'NOT_CONFIGURED',
  last_seen_at TIMESTAMPTZ,
  last_successful_connection_at TIMESTAMPTZ,
  reconnect_attempts INTEGER NOT NULL DEFAULT 0 CHECK (reconnect_attempts >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cameras_city_status_idx ON cameras(city_id, status) WHERE active;
CREATE INDEX cameras_department_idx ON cameras(managing_department_id) WHERE active;
CREATE INDEX cameras_coordinates_idx ON cameras USING GIST(coordinates);

INSERT INTO cameras (external_id, camera_number, name, managing_department_id, city_id, location_description, status, metadata)
SELECT 'DEV-GSRTC-001', '1', 'Development GSRTC Ahmedabad Camera', d.id, c.id, 'Development seed location, Ahmedabad', 'ACTIVE', '{"cameraType":"traffic"}'::jsonb
FROM departments d CROSS JOIN cities c WHERE d.code = 'GSRTC' AND c.name = 'Ahmedabad'
ON CONFLICT (external_id) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('003_cameras') ON CONFLICT DO NOTHING;
