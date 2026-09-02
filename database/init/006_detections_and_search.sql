CREATE TYPE detection_type AS ENUM ('PLATE', 'VEHICLE', 'PERSON', 'OBJECT');

CREATE TABLE IF NOT EXISTS detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  city_id UUID NOT NULL REFERENCES cities(id),
  department_id UUID NOT NULL REFERENCES departments(id),
  detection_type detection_type NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  track_id TEXT,
  plate_number TEXT,
  vehicle_type TEXT,
  vehicle_color TEXT,
  person_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  object_label TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS detections_city_time_idx ON detections(city_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS detections_dept_time_idx ON detections(department_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS detections_camera_time_idx ON detections(camera_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS detections_plate_idx ON detections(plate_number) WHERE plate_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS detections_type_idx ON detections(detection_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS detections_track_idx ON detections(track_id) WHERE track_id IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('006_detections_and_search') ON CONFLICT DO NOTHING;
