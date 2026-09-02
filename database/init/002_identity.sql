CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE platform_role AS ENUM ('STATE_ADMIN', 'DEPARTMENT_HEAD', 'OFFICER', 'OPERATOR', 'INVESTIGATOR');

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  state_code TEXT NOT NULL DEFAULT 'GJ',
  boundary GEOMETRY(MULTIPOLYGON, 4326),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, district, state_code)
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES departments(id),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  administrative_scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role platform_role NOT NULL,
  PRIMARY KEY(user_id, role)
);

CREATE TABLE user_city_scopes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  PRIMARY KEY(user_id, city_id)
);

CREATE INDEX users_department_status_idx ON users(department_id, status);
CREATE INDEX user_city_scopes_city_idx ON user_city_scopes(city_id);

INSERT INTO departments (code, name, category) VALUES
  ('GSRTC', 'Gujarat State Road Transport Corporation', 'GSRTC'),
  ('POLICE', 'Gujarat Police', 'POLICE'),
  ('RTO', 'Regional Transport Office', 'RTO'),
  ('HOSPITAL', 'Government Hospital Services', 'HOSPITAL'),
  ('OTHER', 'Other Government Department', 'OTHER')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cities (name, district) VALUES
  ('Ahmedabad', 'Ahmedabad'), ('Rajkot', 'Rajkot'), ('Surat', 'Surat'), ('Vadodara', 'Vadodara'), ('Gandhinagar', 'Gandhinagar')
ON CONFLICT (name, district, state_code) DO NOTHING;

INSERT INTO users (department_id, email, display_name, password_hash, administrative_scope)
SELECT NULL, 'state.admin@example.gov.in', 'Development State Administrator', crypt('GovDevOnly!2026', gen_salt('bf')), '{"statewide": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'state.admin@example.gov.in');

INSERT INTO user_roles (user_id, role)
SELECT id, 'STATE_ADMIN' FROM users WHERE email = 'state.admin@example.gov.in'
ON CONFLICT DO NOTHING;

INSERT INTO users (department_id, email, display_name, password_hash)
SELECT d.id, 'police.head@example.gov.in', 'Development Police Department Head', crypt('GovDevOnly!2026', gen_salt('bf'))
FROM departments d WHERE d.code = 'POLICE' AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'police.head@example.gov.in');

INSERT INTO user_roles (user_id, role)
SELECT id, 'DEPARTMENT_HEAD' FROM users WHERE email = 'police.head@example.gov.in'
ON CONFLICT DO NOTHING;

INSERT INTO user_city_scopes (user_id, city_id)
SELECT u.id, c.id FROM users u CROSS JOIN cities c
WHERE u.email = 'police.head@example.gov.in' AND c.name IN ('Ahmedabad', 'Rajkot')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('002_identity') ON CONFLICT DO NOTHING;
