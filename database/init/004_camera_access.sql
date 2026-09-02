CREATE TYPE access_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED');
CREATE TYPE access_grant_duration AS ENUM ('TEMPORARY', 'PERMANENT');

CREATE TABLE camera_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_department_id UUID NOT NULL REFERENCES departments(id),
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status access_request_status NOT NULL DEFAULT 'PENDING',
  duration access_grant_duration NOT NULL,
  reason TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  expires_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  override_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  override_at TIMESTAMPTZ
);

CREATE TABLE camera_access_request_cameras (
  request_id UUID NOT NULL REFERENCES camera_access_requests(id) ON DELETE CASCADE,
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE RESTRICT,
  PRIMARY KEY(request_id, camera_id)
);
CREATE INDEX camera_access_request_status_idx ON camera_access_requests(status, requesting_department_id);
CREATE INDEX camera_access_request_cameras_camera_idx ON camera_access_request_cameras(camera_id);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  request_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('004_camera_access') ON CONFLICT DO NOTHING;
