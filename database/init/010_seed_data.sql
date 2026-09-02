-- Extended Cities
INSERT INTO cities (name, district) VALUES
  ('Bhavnagar', 'Bhavnagar'),
  ('Jamnagar', 'Jamnagar'),
  ('Junagadh', 'Junagadh')
ON CONFLICT (name, district, state_code) DO NOTHING;

-- Seed Users across departments and roles
DO $$
DECLARE
  pwd_hash TEXT := crypt('GovDevOnly!2026', gen_salt('bf'));
  police_dept UUID;
  gsrtc_dept UUID;
  rto_dept UUID;
  hospital_dept UUID;
  other_dept UUID;
  user_rec RECORD;
BEGIN
  SELECT id INTO police_dept FROM departments WHERE code = 'POLICE';
  SELECT id INTO gsrtc_dept FROM departments WHERE code = 'GSRTC';
  SELECT id INTO rto_dept FROM departments WHERE code = 'RTO';
  SELECT id INTO hospital_dept FROM departments WHERE code = 'HOSPITAL';
  SELECT id INTO other_dept FROM departments WHERE code = 'OTHER';

  -- 1. State Admin 2
  INSERT INTO users (department_id, email, display_name, password_hash, administrative_scope)
  VALUES (NULL, 'state.admin2@example.gov.in', 'Senior State Administrator', pwd_hash, '{"statewide": true}'::jsonb)
  ON CONFLICT (email) DO NOTHING;

  -- 2. Police Officer (Multi-role: OFFICER + INVESTIGATOR)
  INSERT INTO users (department_id, email, display_name, password_hash)
  VALUES (police_dept, 'police.officer@example.gov.in', 'Inspector Vikram Jadeja', pwd_hash)
  ON CONFLICT (email) DO NOTHING;

  -- 3. Police Operator
  INSERT INTO users (department_id, email, display_name, password_hash)
  VALUES (police_dept, 'police.operator@example.gov.in', 'Operator Rajesh Patel', pwd_hash)
  ON CONFLICT (email) DO NOTHING;

  -- 4. Police Investigator
  INSERT INTO users (department_id, email, display_name, password_hash)
  VALUES (police_dept, 'police.investigator@example.gov.in', 'Investigator Priya Sharma', pwd_hash)
  ON CONFLICT (email) DO NOTHING;

  -- 5. GSRTC Dept Head
  INSERT INTO users (department_id, email, display_name, password_hash)
  VALUES (gsrtc_dept, 'gsrtc.head@example.gov.in', 'Chief General Manager GSRTC', pwd_hash)
  ON CONFLICT (email) DO NOTHING;

  -- 6. GSRTC Operator
  INSERT INTO users (department_id, email, display_name, password_hash)
  VALUES (gsrtc_dept, 'gsrtc.operator@example.gov.in', 'GSRTC Control Operator Anil', pwd_hash)
  ON CONFLICT (email) DO NOTHING;

  -- 7. RTO Dept Head
  INSERT INTO users (department_id, email, display_name, password_hash)
  VALUES (rto_dept, 'rto.head@example.gov.in', 'Regional Transport Officer Incharge', pwd_hash)
  ON CONFLICT (email) DO NOTHING;

  -- 8. Hospital Dept Head
  INSERT INTO users (department_id, email, display_name, password_hash)
  VALUES (hospital_dept, 'hospital.head@example.gov.in', 'Director Health Services', pwd_hash)
  ON CONFLICT (email) DO NOTHING;

  -- 9. Other Dept Head
  INSERT INTO users (department_id, email, display_name, password_hash)
  VALUES (other_dept, 'other.head@example.gov.in', 'Special Projects Incharge', pwd_hash)
  ON CONFLICT (email) DO NOTHING;
END $$;

-- Assign Roles
INSERT INTO user_roles (user_id, role)
SELECT id, 'STATE_ADMIN' FROM users WHERE email = 'state.admin2@example.gov.in' ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'OFFICER' FROM users WHERE email = 'police.officer@example.gov.in' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role)
SELECT id, 'INVESTIGATOR' FROM users WHERE email = 'police.officer@example.gov.in' ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'OPERATOR' FROM users WHERE email = 'police.operator@example.gov.in' ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'INVESTIGATOR' FROM users WHERE email = 'police.investigator@example.gov.in' ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'DEPARTMENT_HEAD' FROM users WHERE email = 'gsrtc.head@example.gov.in' ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'OPERATOR' FROM users WHERE email = 'gsrtc.operator@example.gov.in' ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'DEPARTMENT_HEAD' FROM users WHERE email = 'rto.head@example.gov.in' ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'DEPARTMENT_HEAD' FROM users WHERE email = 'hospital.head@example.gov.in' ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'DEPARTMENT_HEAD' FROM users WHERE email = 'other.head@example.gov.in' ON CONFLICT DO NOTHING;

-- Assign City Scopes
INSERT INTO user_city_scopes (user_id, city_id)
SELECT u.id, c.id FROM users u CROSS JOIN cities c
WHERE u.email = 'police.officer@example.gov.in' AND c.name IN ('Ahmedabad', 'Rajkot')
ON CONFLICT DO NOTHING;

INSERT INTO user_city_scopes (user_id, city_id)
SELECT u.id, c.id FROM users u CROSS JOIN cities c
WHERE u.email = 'police.operator@example.gov.in' AND c.name IN ('Ahmedabad', 'Rajkot')
ON CONFLICT DO NOTHING;

INSERT INTO user_city_scopes (user_id, city_id)
SELECT u.id, c.id FROM users u CROSS JOIN cities c
WHERE u.email = 'police.investigator@example.gov.in' AND c.name IN ('Ahmedabad', 'Rajkot', 'Surat')
ON CONFLICT DO NOTHING;

INSERT INTO user_city_scopes (user_id, city_id)
SELECT u.id, c.id FROM users u CROSS JOIN cities c
WHERE u.email = 'gsrtc.head@example.gov.in' AND c.name IN ('Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar')
ON CONFLICT DO NOTHING;

INSERT INTO user_city_scopes (user_id, city_id)
SELECT u.id, c.id FROM users u CROSS JOIN cities c
WHERE u.email = 'gsrtc.operator@example.gov.in' AND c.name IN ('Ahmedabad', 'Gandhinagar')
ON CONFLICT DO NOTHING;

INSERT INTO user_city_scopes (user_id, city_id)
SELECT u.id, c.id FROM users u CROSS JOIN cities c
WHERE u.email = 'rto.head@example.gov.in' AND c.name IN ('Ahmedabad', 'Surat', 'Rajkot', 'Vadodara')
ON CONFLICT DO NOTHING;

INSERT INTO user_city_scopes (user_id, city_id)
SELECT u.id, c.id FROM users u CROSS JOIN cities c
WHERE u.email = 'hospital.head@example.gov.in' AND c.name IN ('Ahmedabad', 'Surat')
ON CONFLICT DO NOTHING;

INSERT INTO user_city_scopes (user_id, city_id)
SELECT u.id, c.id FROM users u CROSS JOIN cities c
WHERE u.email = 'other.head@example.gov.in' AND c.name IN ('Gandhinagar')
ON CONFLICT DO NOTHING;

-- Seed 60+ Realistic Cameras across Gujarat
DO $$
DECLARE
  d_police UUID;
  d_gsrtc UUID;
  d_rto UUID;
  d_hosp UUID;
  d_other UUID;
  c_amd UUID;
  c_sur UUID;
  c_raj UUID;
  c_vad UUID;
  c_gan UUID;
BEGIN
  SELECT id INTO d_police FROM departments WHERE code = 'POLICE';
  SELECT id INTO d_gsrtc FROM departments WHERE code = 'GSRTC';
  SELECT id INTO d_rto FROM departments WHERE code = 'RTO';
  SELECT id INTO d_hosp FROM departments WHERE code = 'HOSPITAL';
  SELECT id INTO d_other FROM departments WHERE code = 'OTHER';

  SELECT id INTO c_amd FROM cities WHERE name = 'Ahmedabad';
  SELECT id INTO c_sur FROM cities WHERE name = 'Surat';
  SELECT id INTO c_raj FROM cities WHERE name = 'Rajkot';
  SELECT id INTO c_vad FROM cities WHERE name = 'Vadodara';
  SELECT id INTO c_gan FROM cities WHERE name = 'Gandhinagar';

  -- AHMEDABAD (16 cameras)
  INSERT INTO cameras (external_id, camera_number, name, managing_department_id, city_id, location_description, stream_protocol, stream_reference, coordinates, status, ai_state, metadata) VALUES
  ('GJ-AMD-POL-001', '101', 'Kalupur Junction PTZ 1', d_police, c_amd, 'Kalupur Railway Station Crossroad, Ahmedabad', 'RTSP', 'rtsp://10.20.1.101:554/live', ST_SetSRID(ST_MakePoint(72.5950, 23.0300), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-AMD-POL-002', '102', 'Ashram Road Vadaj Circle', d_police, c_amd, 'Vadaj Circle, Ashram Road, Ahmedabad', 'RTSP', 'rtsp://10.20.1.102:554/live', ST_SetSRID(ST_MakePoint(72.5700, 23.0550), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-AMD-POL-003', '103', 'SG Highway Iscon Crossroad', d_police, c_amd, 'Iscon Junction, S.G. Highway, Ahmedabad', 'HTTPS-HLS', 'https://stream.internal.gov.in/amd/iscon.m3u8', ST_SetSRID(ST_MakePoint(72.5080, 23.0280), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"4K","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-AMD-POL-004', '104', 'C.G. Road Swastik Crossroad', d_police, c_amd, 'Swastik Char Rasta, Navrangpura, Ahmedabad', 'RTSP', 'rtsp://10.20.1.104:554/live', ST_SetSRID(ST_MakePoint(72.5600, 23.0360), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-AMD-POL-005', '105', 'Narol Circle Traffic East', d_police, c_amd, 'Narol Highway Circle, Ahmedabad', 'RTSP', 'rtsp://10.20.1.105:554/live', ST_SetSRID(ST_MakePoint(72.6050, 22.9750), 4326), 'DEGRADED', 'ERROR', '{"resolution":"720p","fps":15}'::jsonb),
  ('GJ-AMD-POL-006', '106', 'Sabarmati Riverfront West Entry', d_police, c_amd, 'Riverfront West Promenade Gate 3, Ahmedabad', 'RTSP', 'rtsp://10.20.1.106:554/live', ST_SetSRID(ST_MakePoint(72.5720, 23.0420), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-AMD-POL-007', '107', 'Airport Circle VIP Entry', d_police, c_amd, 'Sardar Vallabhbhai Patel Airport Circle, Ahmedabad', 'HTTPS-HLS', 'https://stream.internal.gov.in/amd/airport.m3u8', ST_SetSRID(ST_MakePoint(72.6250, 23.0750), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"4K","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-AMD-GSRTC-001', '108', 'GSRTC Geeta Mandir Bus Port Platform A', d_gsrtc, c_amd, 'Central Bus Station, Geeta Mandir, Ahmedabad', 'RTSP', 'rtsp://10.20.2.101:554/live', ST_SetSRID(ST_MakePoint(72.5890, 23.0150), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-AMD-GSRTC-002', '109', 'GSRTC Geeta Mandir Bus Port Platform B', d_gsrtc, c_amd, 'Central Bus Station, Geeta Mandir, Ahmedabad', 'RTSP', 'rtsp://10.20.2.102:554/live', ST_SetSRID(ST_MakePoint(72.5900, 23.0155), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-AMD-GSRTC-003', '110', 'GSRTC Ranip Bus Terminal Ingate', d_gsrtc, c_amd, 'Ranip Bus Terminal Entry, Ahmedabad', 'RTSP', 'rtsp://10.20.2.103:554/live', ST_SetSRID(ST_MakePoint(72.5780, 23.0780), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-AMD-GSRTC-004', '111', 'GSRTC Krishnanagar Depot', d_gsrtc, c_amd, 'Krishnanagar GSRTC Depot, Naroda, Ahmedabad', 'RTSP', 'rtsp://10.20.2.104:554/live', ST_SetSRID(ST_MakePoint(72.6500, 23.0650), 4326), 'OFFLINE', 'NOT_CONFIGURED', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-AMD-RTO-001', '112', 'Subhash Bridge RTO Automated Track 1', d_rto, c_amd, 'Ahmedabad RTO Driving Test Track, Subhash Bridge', 'RTSP', 'rtsp://10.20.3.101:554/live', ST_SetSRID(ST_MakePoint(72.5790, 23.0620), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-AMD-RTO-002', '113', 'Subhash Bridge RTO Entry Gate ANPR', d_rto, c_amd, 'Main Gate Vehicle Entry, RTO Ahmedabad', 'RTSP', 'rtsp://10.20.3.102:554/live', ST_SetSRID(ST_MakePoint(72.5800, 23.0625), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-AMD-RTO-003', '114', 'Vastral RTO Test Track Ingate', d_rto, c_amd, 'East Ahmedabad RTO Office, Vastral', 'RTSP', 'rtsp://10.20.3.103:554/live', ST_SetSRID(ST_MakePoint(72.6650, 23.0020), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-AMD-HOSP-001', '115', 'Civil Hospital Trauma Emergency Gate', d_hosp, c_amd, 'Civil Hospital Asarwa Emergency Entry, Ahmedabad', 'HTTPS-HLS', 'https://stream.internal.gov.in/amd/civil_trauma.m3u8', ST_SetSRID(ST_MakePoint(72.6020, 23.0510), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-AMD-HOSP-002', '116', 'SVP Hospital Ambulance Bay', d_hosp, c_amd, 'SVP Hospital Ambulance Dropoff, Ellisbridge, Ahmedabad', 'RTSP', 'rtsp://10.20.4.102:554/live', ST_SetSRID(ST_MakePoint(72.5710, 23.0210), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb)
  ON CONFLICT (external_id) DO NOTHING;

  -- SURAT (14 cameras)
  INSERT INTO cameras (external_id, camera_number, name, managing_department_id, city_id, location_description, stream_protocol, stream_reference, coordinates, status, ai_state, metadata) VALUES
  ('GJ-SUR-POL-001', '201', 'Surat Ring Road Majura Gate', d_police, c_sur, 'Majura Gate Crossroad, Ring Road, Surat', 'RTSP', 'rtsp://10.30.1.201:554/live', ST_SetSRID(ST_MakePoint(72.8210, 21.1820), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-SUR-POL-002', '202', 'Athwa Gate Circle Surveillance', d_police, c_sur, 'Athwa Gate Circle, Surat', 'RTSP', 'rtsp://10.30.1.202:554/live', ST_SetSRID(ST_MakePoint(72.8050, 21.1780), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-SUR-POL-003', '203', 'Varachha Main Flyover Junction', d_police, c_sur, 'Varachha Main Road Diamond Market, Surat', 'RTSP', 'rtsp://10.30.1.203:554/live', ST_SetSRID(ST_MakePoint(72.8550, 21.2150), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"4K","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-SUR-POL-004', '204', 'Katargam GIDC Entry Checkpost', d_police, c_sur, 'Katargam GIDC Main Gate, Surat', 'RTSP', 'rtsp://10.30.1.204:554/live', ST_SetSRID(ST_MakePoint(72.8310, 21.2320), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-SUR-POL-005', '205', 'Dumas Road VR Mall Junction', d_police, c_sur, 'Dumas Road Commercial Corridor, Surat', 'HTTPS-HLS', 'https://stream.internal.gov.in/sur/vrmall.m3u8', ST_SetSRID(ST_MakePoint(72.7650, 21.1450), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-SUR-POL-006', '206', 'Udhna Darwaja Flyover South', d_police, c_sur, 'Udhna Main Road, Surat', 'RTSP', 'rtsp://10.30.1.206:554/live', ST_SetSRID(ST_MakePoint(72.8360, 21.1680), 4326), 'DEGRADED', 'ERROR', '{"resolution":"720p","fps":15}'::jsonb),
  ('GJ-SUR-GSRTC-001', '207', 'Surat Central Bus Station Terminal 1', d_gsrtc, c_sur, 'GSRTC Central Depot, Railway Station Road, Surat', 'RTSP', 'rtsp://10.30.2.201:554/live', ST_SetSRID(ST_MakePoint(72.8420, 21.2050), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-SUR-GSRTC-002', '208', 'Surat Central Bus Station Ingate ANPR', d_gsrtc, c_sur, 'GSRTC Bus Ingate, Surat', 'RTSP', 'rtsp://10.30.2.202:554/live', ST_SetSRID(ST_MakePoint(72.8430, 21.2060), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-SUR-GSRTC-003', '209', 'Adajan GSRTC Sub-Depot', d_gsrtc, c_sur, 'Adajan Patiya Bus Stand, Surat', 'RTSP', 'rtsp://10.30.2.203:554/live', ST_SetSRID(ST_MakePoint(72.7920, 21.1980), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-SUR-RTO-001', '210', 'Surat RTO Pal Automated Track', d_rto, c_sur, 'Pal RTO Complex, Gaurav Path, Surat', 'RTSP', 'rtsp://10.30.3.201:554/live', ST_SetSRID(ST_MakePoint(72.7750, 21.1890), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-SUR-RTO-002', '211', 'Surat RTO Heavy Vehicle Gate', d_rto, c_sur, 'Pal RTO Commercial Vehicle Yard, Surat', 'RTSP', 'rtsp://10.30.3.202:554/live', ST_SetSRID(ST_MakePoint(72.7760, 21.1900), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-SUR-HOSP-001', '212', 'New Civil Hospital Emergency Entry Gate', d_hosp, c_sur, 'New Civil Hospital Majura Gate, Surat', 'HTTPS-HLS', 'https://stream.internal.gov.in/sur/civil.m3u8', ST_SetSRID(ST_MakePoint(72.8190, 21.1750), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-SUR-HOSP-002', '213', 'SMIMER Hospital Main Gate Traffic', d_hosp, c_sur, 'SMIMER Medical College & Hospital, Umarwada, Surat', 'RTSP', 'rtsp://10.30.4.202:554/live', ST_SetSRID(ST_MakePoint(72.8510, 21.1920), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-SUR-OTH-001', '214', 'Surat Municipal Corporation Head Office', d_other, c_sur, 'SMC Headquarters Muglisara, Surat', 'RTSP', 'rtsp://10.30.5.201:554/live', ST_SetSRID(ST_MakePoint(72.8250, 21.1950), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb)
  ON CONFLICT (external_id) DO NOTHING;

  -- RAJKOT (12 cameras)
  INSERT INTO cameras (external_id, camera_number, name, managing_department_id, city_id, location_description, stream_protocol, stream_reference, coordinates, status, ai_state, metadata) VALUES
  ('GJ-RAJ-POL-001', '301', 'Trikon Baug Junction PTZ', d_police, c_raj, 'Trikon Baug Central Circle, Rajkot', 'RTSP', 'rtsp://10.40.1.301:554/live', ST_SetSRID(ST_MakePoint(70.7980, 22.3010), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-RAJ-POL-002', '302', 'Kotecha Chowk ANPR North', d_police, c_raj, 'Kotecha Chowk, Kalawad Road, Rajkot', 'RTSP', 'rtsp://10.40.1.302:554/live', ST_SetSRID(ST_MakePoint(70.7810, 22.2890), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-RAJ-POL-003', '303', '150 Feet Ring Road Indira Circle', d_police, c_raj, 'Indira Circle, 150ft Ring Road, Rajkot', 'HTTPS-HLS', 'https://stream.internal.gov.in/raj/indira.m3u8', ST_SetSRID(ST_MakePoint(70.7680, 22.2960), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"4K","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-RAJ-POL-004', '304', 'Madhapar Chowk Highway Checkpost', d_police, c_raj, 'Madhapar Chowkadi, Jamnagar Highway, Rajkot', 'RTSP', 'rtsp://10.40.1.304:554/live', ST_SetSRID(ST_MakePoint(70.7720, 22.3250), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-RAJ-POL-005', '305', 'Gondal Chowkdi South Entry', d_police, c_raj, 'Gondal Highway Crossroad, Rajkot', 'RTSP', 'rtsp://10.40.1.305:554/live', ST_SetSRID(ST_MakePoint(70.8050, 22.2450), 4326), 'OFFLINE', 'NOT_CONFIGURED', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-RAJ-GSRTC-001', '306', 'Rajkot Central Bus Station Gate 1', d_gsrtc, c_raj, 'GSRTC Central Bus Station, Dhebar Road, Rajkot', 'RTSP', 'rtsp://10.40.2.301:554/live', ST_SetSRID(ST_MakePoint(70.8020, 22.2940), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-RAJ-GSRTC-002', '307', 'Rajkot Central Bus Station Outgate ANPR', d_gsrtc, c_raj, 'GSRTC Bus Exit Gate, Dhebar Road, Rajkot', 'RTSP', 'rtsp://10.40.2.302:554/live', ST_SetSRID(ST_MakePoint(70.8030, 22.2945), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-RAJ-GSRTC-003', '308', 'Shastri Maidan GSRTC Pick-up Terminal', d_gsrtc, c_raj, 'Shastri Maidan Bus Stop, Rajkot', 'RTSP', 'rtsp://10.40.2.303:554/live', ST_SetSRID(ST_MakePoint(70.7960, 22.2980), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-RAJ-RTO-001', '309', 'Rajkot RTO Test Track', d_rto, c_raj, 'RTO Complex, Bhavnagar Road, Rajkot', 'RTSP', 'rtsp://10.40.3.301:554/live', ST_SetSRID(ST_MakePoint(70.8350, 22.2910), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-RAJ-RTO-002', '310', 'Rajkot RTO Ingate ANPR', d_rto, c_raj, 'Main Entry Gate, Rajkot RTO Office', 'RTSP', 'rtsp://10.40.3.302:554/live', ST_SetSRID(ST_MakePoint(70.8360, 22.2915), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-RAJ-HOSP-001', '311', 'PDU Civil Hospital Emergency Gate', d_hosp, c_raj, 'PDU Medical College & Hospital Hospital Chowk, Rajkot', 'RTSP', 'rtsp://10.40.4.301:554/live', ST_SetSRID(ST_MakePoint(70.7990, 22.3070), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-RAJ-OTH-001', '312', 'Rajkot Municipal Corporation HQ', d_other, c_raj, 'RMC Central Office, Dhebar Road, Rajkot', 'RTSP', 'rtsp://10.40.5.301:554/live', ST_SetSRID(ST_MakePoint(70.8010, 22.2970), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb)
  ON CONFLICT (external_id) DO NOTHING;

  -- VADODARA (10 cameras)
  INSERT INTO cameras (external_id, camera_number, name, managing_department_id, city_id, location_description, stream_protocol, stream_reference, coordinates, status, ai_state, metadata) VALUES
  ('GJ-VAD-POL-001', '401', 'Sayajigunj Circle Traffic Camera', d_police, c_vad, 'Sayajigunj Central Crossroad, Vadodara', 'RTSP', 'rtsp://10.50.1.401:554/live', ST_SetSRID(ST_MakePoint(73.1810, 22.3110), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-VAD-POL-002', '402', 'Alkapuri RC Dutt Road Junction', d_police, c_vad, 'RC Dutt Road, Alkapuri, Vadodara', 'RTSP', 'rtsp://10.50.1.402:554/live', ST_SetSRID(ST_MakePoint(73.1690, 22.3140), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-VAD-POL-003', '403', 'Akota Dandia Bazar Bridge East', d_police, c_vad, 'Akota Bridge Entry, Vadodara', 'RTSP', 'rtsp://10.50.1.403:554/live', ST_SetSRID(ST_MakePoint(73.1850, 22.2980), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-VAD-POL-004', '404', 'Makarpura GIDC Highway Junction', d_police, c_vad, 'Makarpura Industrial Crossroad, Vadodara', 'HTTPS-HLS', 'https://stream.internal.gov.in/vad/makarpura.m3u8', ST_SetSRID(ST_MakePoint(73.1950, 22.2520), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-VAD-GSRTC-001', '405', 'Vadodara Central Bus Station Concourse', d_gsrtc, c_vad, 'GSRTC Central Bus Terminal, Sayajigunj, Vadodara', 'RTSP', 'rtsp://10.50.2.401:554/live', ST_SetSRID(ST_MakePoint(73.1830, 22.3120), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-VAD-GSRTC-002', '406', 'Vadodara Central Bus Station Entry ANPR', d_gsrtc, c_vad, 'GSRTC Bus Ingate, Vadodara Central', 'RTSP', 'rtsp://10.50.2.402:554/live', ST_SetSRID(ST_MakePoint(73.1835, 22.3125), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-VAD-RTO-001', '407', 'Vadodara RTO Warasia Ring Road', d_rto, c_vad, 'RTO Complex, Warasia Ring Road, Vadodara', 'RTSP', 'rtsp://10.50.3.401:554/live', ST_SetSRID(ST_MakePoint(73.2200, 22.3250), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-VAD-RTO-002', '408', 'Vadodara RTO Driving Test Arena', d_rto, c_vad, 'Automated Test Arena, Vadodara RTO', 'RTSP', 'rtsp://10.50.3.402:554/live', ST_SetSRID(ST_MakePoint(73.2210, 22.3255), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-VAD-HOSP-001', '409', 'SSG Hospital Trauma Emergency Wing', d_hosp, c_vad, 'Sir Sayajirao General Hospital, Jail Road, Vadodara', 'RTSP', 'rtsp://10.50.4.401:554/live', ST_SetSRID(ST_MakePoint(73.1930, 22.3040), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-VAD-OTH-001', '410', 'Vadodara Mahanagar Seva Sadan Khanderao Market', d_other, c_vad, 'VMSS HQ Khanderao Market, Vadodara', 'RTSP', 'rtsp://10.50.5.401:554/live', ST_SetSRID(ST_MakePoint(73.2020, 22.2980), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb)
  ON CONFLICT (external_id) DO NOTHING;

  -- GANDHINAGAR (10 cameras)
  INSERT INTO cameras (external_id, camera_number, name, managing_department_id, city_id, location_description, stream_protocol, stream_reference, coordinates, status, ai_state, metadata) VALUES
  ('GJ-GAN-POL-001', '501', 'Sector 11 Secretariat Main Gate 1', d_police, c_gan, 'New Sachivalaya Main Entry Gate 1, Sector 10/11, Gandhinagar', 'HTTPS-HLS', 'https://stream.internal.gov.in/gan/sachivalaya_g1.m3u8', ST_SetSRID(ST_MakePoint(72.6560, 23.2230), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"4K","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-GAN-POL-002', '502', 'Mahatma Mandir Convention Road', d_police, c_gan, 'Mahatma Mandir Crossroad, Sector 13, Gandhinagar', 'RTSP', 'rtsp://10.60.1.502:554/live', ST_SetSRID(ST_MakePoint(72.6390, 23.2350), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-GAN-POL-003', '503', 'GIFT City Main Highway Junction', d_police, c_gan, 'GIFT City Bridge Intersection, Gandhinagar', 'HTTPS-HLS', 'https://stream.internal.gov.in/gan/gift_junction.m3u8', ST_SetSRID(ST_MakePoint(72.6850, 23.1620), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"4K","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-GAN-POL-004', '504', 'CH-0 Circle North Traffic Post', d_police, c_gan, 'CH-0 Circle, Koba-Gandhinagar Highway', 'RTSP', 'rtsp://10.60.1.504:554/live', ST_SetSRID(ST_MakePoint(72.6450, 23.1850), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25,"anprEnabled":true}'::jsonb),
  ('GJ-GAN-GSRTC-001', '505', 'Gandhinagar Central Bus Station Sector 11', d_gsrtc, c_gan, 'GSRTC Depot, Sector 11, Gandhinagar', 'RTSP', 'rtsp://10.60.2.501:554/live', ST_SetSRID(ST_MakePoint(72.6510, 23.2200), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-GAN-GSRTC-002', '506', 'Sector 7 GSRTC Terminal Platform', d_gsrtc, c_gan, 'Sector 7 Bus Stand, Gandhinagar', 'RTSP', 'rtsp://10.60.2.502:554/live', ST_SetSRID(ST_MakePoint(72.6350, 23.2180), 4326), 'ACTIVE', 'IDLE', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-GAN-RTO-001', '507', 'Gandhinagar RTO Sector 28 GIDC Track', d_rto, c_gan, 'RTO Automated Track Sector 28, Gandhinagar', 'RTSP', 'rtsp://10.60.3.501:554/live', ST_SetSRID(ST_MakePoint(72.6710, 23.2550), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":30,"anprEnabled":true}'::jsonb),
  ('GJ-GAN-HOSP-001', '508', 'GMERS Civil Hospital Sector 12 Trauma Gate', d_hosp, c_gan, 'Civil Hospital Emergency Gate, Sector 12, Gandhinagar', 'RTSP', 'rtsp://10.60.4.501:554/live', ST_SetSRID(ST_MakePoint(72.6480, 23.2280), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"1080p","fps":25}'::jsonb),
  ('GJ-GAN-OTH-001', '509', 'Gujarat Vidhan Sabha Security Perimeter Gate A', d_other, c_gan, 'Gujarat Legislative Assembly Perimeter, Sector 10, Gandhinagar', 'HTTPS-HLS', 'https://stream.internal.gov.in/gan/vidhansabha.m3u8', ST_SetSRID(ST_MakePoint(72.6540, 23.2240), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"4K","fps":30}'::jsonb),
  ('GJ-GAN-OTH-002', '510', 'Swarnim Sankul 1 VVIP Access Gate', d_other, c_gan, 'Swarnim Sankul 1 Chief Minister Office Access, Gandhinagar', 'HTTPS-HLS', 'https://stream.internal.gov.in/gan/swarnim.m3u8', ST_SetSRID(ST_MakePoint(72.6570, 23.2235), 4326), 'ACTIVE', 'PROCESSING', '{"resolution":"4K","fps":30}'::jsonb)
  ON CONFLICT (external_id) DO NOTHING;

END $$;

-- Seed Sample Watchlists
DO $$
DECLARE
  police_dept UUID;
  admin_user UUID;
  wl_stolen UUID;
  wl_suspect UUID;
BEGIN
  SELECT id INTO police_dept FROM departments WHERE code = 'POLICE';
  SELECT id INTO admin_user FROM users WHERE email = 'state.admin@example.gov.in';

  INSERT INTO watchlists (name, entity_type, scope, department_id, description, created_by)
  VALUES ('Stolen Motor Vehicles Statewide', 'PLATE', 'GLOBAL', NULL, 'Statewide high-priority stolen vehicle lookup watchlist', admin_user)
  RETURNING id INTO wl_stolen;

  INSERT INTO watchlist_items (watchlist_id, value, description, severity) VALUES
  (wl_stolen, 'GJ01AB1234', 'White Hyundai Creta reported stolen at Navrangpura PS', 'CRITICAL'),
  (wl_stolen, 'GJ05CD5678', 'Black Toyota Fortuner stolen near Surat Textile Market', 'CRITICAL'),
  (wl_stolen, 'GJ03EF9012', 'Silver Maruti Swift wanted in robbery case Rajkot', 'HIGH'),
  (wl_stolen, 'GJ06GH3456', 'Red Honda City absconding vehicle Vadodara', 'HIGH');

  INSERT INTO watchlists (name, entity_type, scope, department_id, description, created_by)
  VALUES ('Traffic Law Habitual Repeat Violators', 'PLATE', 'DEPARTMENT', police_dept, 'Vehicles with multiple pending unpaid challans & rash driving', admin_user)
  RETURNING id INTO wl_suspect;

  INSERT INTO watchlist_items (watchlist_id, value, description, severity) VALUES
  (wl_suspect, 'GJ01KK8899', 'Multiple overspeeding infractions SG Highway', 'MEDIUM'),
  (wl_suspect, 'GJ05ZZ4433', 'Reckless driving Surat Dumas corridor', 'MEDIUM');
END $$;

-- Seed Sample Alert Rules
DO $$
DECLARE
  police_dept UUID;
  admin_user UUID;
  c_raj UUID;
  r_raj_stolen UUID;
BEGIN
  SELECT id INTO police_dept FROM departments WHERE code = 'POLICE';
  SELECT id INTO admin_user FROM users WHERE email = 'state.admin@example.gov.in';
  SELECT id INTO c_raj FROM cities WHERE name = 'Rajkot';

  INSERT INTO alert_rules (name, department_id, scope, conditions, severity, created_by)
  VALUES (
    'Critical Watchlist Stolen Vehicle Match Statewide',
    NULL,
    'GLOBAL',
    '{"eventType":"ANPR_MATCH","watchlistType":"PLATE","minConfidence":0.85}'::jsonb,
    'CRITICAL',
    admin_user
  );

  INSERT INTO alert_rules (name, department_id, scope, conditions, severity, created_by)
  VALUES (
    'Rajkot City Heavy Traffic & Speed Trigger',
    police_dept,
    'DEPARTMENT',
    json_build_object('cityId', c_raj, 'minConfidence', 0.80, 'vehicleTypes', json_build_array('TRUCK', 'BUS'))::jsonb,
    'HIGH',
    admin_user
  );
END $$;

-- Seed Sample Detections & Alerts
DO $$
DECLARE
  c_amd_cam UUID;
  c_sur_cam UUID;
  c_raj_cam UUID;
  d_police UUID;
  c_amd UUID;
  c_sur UUID;
  c_raj UUID;
  det1 UUID;
  det2 UUID;
  det3 UUID;
  rule_crit UUID;
  user_officer UUID;
BEGIN
  SELECT id INTO c_amd_cam FROM cameras WHERE external_id = 'GJ-AMD-POL-003';
  SELECT id INTO c_sur_cam FROM cameras WHERE external_id = 'GJ-SUR-POL-001';
  SELECT id INTO c_raj_cam FROM cameras WHERE external_id = 'GJ-RAJ-POL-002';
  SELECT id INTO d_police FROM departments WHERE code = 'POLICE';
  SELECT id INTO c_amd FROM cities WHERE name = 'Ahmedabad';
  SELECT id INTO c_sur FROM cities WHERE name = 'Surat';
  SELECT id INTO c_raj FROM cities WHERE name = 'Rajkot';
  SELECT id INTO rule_crit FROM alert_rules WHERE scope = 'GLOBAL' LIMIT 1;
  SELECT id INTO user_officer FROM users WHERE email = 'police.officer@example.gov.in';

  IF c_amd_cam IS NOT NULL AND c_sur_cam IS NOT NULL AND c_raj_cam IS NOT NULL THEN
    INSERT INTO detections (camera_id, city_id, department_id, detection_type, confidence, track_id, plate_number, vehicle_type, vehicle_color, detected_at)
    VALUES (c_amd_cam, c_amd, d_police, 'PLATE', 0.94, 'TRK-AMD-8821', 'GJ01AB1234', 'SUV', 'WHITE', now() - INTERVAL '45 minutes')
    RETURNING id INTO det1;

    INSERT INTO detections (camera_id, city_id, department_id, detection_type, confidence, track_id, plate_number, vehicle_type, vehicle_color, detected_at)
    VALUES (c_sur_cam, c_sur, d_police, 'PLATE', 0.91, 'TRK-SUR-1102', 'GJ05CD5678', 'SUV', 'BLACK', now() - INTERVAL '2 hours')
    RETURNING id INTO det2;

    INSERT INTO detections (camera_id, city_id, department_id, detection_type, confidence, track_id, plate_number, vehicle_type, vehicle_color, detected_at)
    VALUES (c_raj_cam, c_raj, d_police, 'PLATE', 0.88, 'TRK-RAJ-4491', 'GJ03EF9012', 'SEDAN', 'SILVER', now() - INTERVAL '5 hours')
    RETURNING id INTO det3;

    -- Seed Active Alerts
    INSERT INTO alerts (rule_id, detection_id, camera_id, city_id, department_id, severity, title, description, status, metadata)
    VALUES (rule_crit, det1, c_amd_cam, c_amd, d_police, 'CRITICAL', 'Critical Stolen Vehicle Detected: GJ01AB1234', 'Plate GJ01AB1234 matched statewide stolen watchlist at SG Highway Iscon Crossroad', 'NEW', '{"confidence":0.94,"vehicle":"White Hyundai Creta"}'::jsonb);

    INSERT INTO alerts (rule_id, detection_id, camera_id, city_id, department_id, severity, title, description, status, acknowledged_by, acknowledged_at, metadata)
    VALUES (rule_crit, det2, c_sur_cam, c_sur, d_police, 'HIGH', 'Stolen Vehicle Match: GJ05CD5678', 'Plate GJ05CD5678 detected at Surat Ring Road Majura Gate', 'ACKNOWLEDGED', user_officer, now() - INTERVAL '1 hour', '{"confidence":0.91,"vehicle":"Black Toyota Fortuner"}'::jsonb);
  END IF;
END $$;

-- Seed Sample Investigation Cases
DO $$
DECLARE
  d_police UUID;
  user_head UUID;
  user_inv UUID;
  inv1 UUID;
  inv2 UUID;
  det1 UUID;
BEGIN
  SELECT id INTO d_police FROM departments WHERE code = 'POLICE';
  SELECT id INTO user_head FROM users WHERE email = 'police.head@example.gov.in';
  SELECT id INTO user_inv FROM users WHERE email = 'police.investigator@example.gov.in';
  SELECT id INTO det1 FROM detections WHERE plate_number = 'GJ01AB1234' LIMIT 1;

  IF user_head IS NOT NULL AND user_inv IS NOT NULL THEN
    INSERT INTO investigations (case_number, title, description, department_id, created_by, lead_investigator_id, status, target_type, target_value, search_criteria, expires_at)
    VALUES ('INV-2026-GJ-001', 'Investigation into Ahmedabad S.G. Highway Vehicle Theft Ring', 'Coordinated surveillance tracking stolen luxury SUVs along SG Highway & Ring Road', d_police, user_head, user_inv, 'MATCH_FOUND', 'PLATE', 'GJ01AB1234', '{"city":"Ahmedabad","make":"Hyundai Creta"}'::jsonb, now() + INTERVAL '30 days')
    RETURNING id INTO inv1;

    INSERT INTO investigation_schedules (investigation_id, interval_minutes, last_run_at, next_run_at, active)
    VALUES (inv1, 180, now() - INTERVAL '10 minutes', now() + INTERVAL '170 minutes', true);

    IF det1 IS NOT NULL THEN
      INSERT INTO investigation_results (investigation_id, detection_id, relevance_score, notes)
      VALUES (inv1, det1, 0.98, 'Confirmed optical match at Iscon crossroad northbound lane')
      ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO investigations (case_number, title, description, department_id, created_by, lead_investigator_id, status, target_type, target_value, search_criteria, expires_at)
    VALUES ('INV-2026-GJ-002', 'Surat Diamond Market Textile Corridor Transit Tracking', 'Investigation into repeated unregistered vehicle transit', d_police, user_head, user_inv, 'IN_PROGRESS', 'PLATE', 'GJ05CD5678', '{"city":"Surat"}'::jsonb, now() + INTERVAL '15 days')
    RETURNING id INTO inv2;
  END IF;
END $$;

-- Seed Sample Access Sharing Request (Police requests GSRTC camera)
DO $$
DECLARE
  d_police UUID;
  user_officer UUID;
  user_gsrtc_head UUID;
  c_gsrtc_cam UUID;
  req_id UUID;
BEGIN
  SELECT id INTO d_police FROM departments WHERE code = 'POLICE';
  SELECT id INTO user_officer FROM users WHERE email = 'police.officer@example.gov.in';
  SELECT id INTO user_gsrtc_head FROM users WHERE email = 'gsrtc.head@example.gov.in';
  SELECT id INTO c_gsrtc_cam FROM cameras WHERE external_id = 'GJ-AMD-GSRTC-001';

  IF d_police IS NOT NULL AND user_officer IS NOT NULL AND c_gsrtc_cam IS NOT NULL THEN
    INSERT INTO camera_access_requests (requesting_department_id, requested_by, duration, reason, status, decided_by, decided_at, decision_reason, expires_at)
    VALUES (d_police, user_officer, 'TEMPORARY', 'Police VIP convoy route and transit monitoring at Geeta Mandir Central Bus Terminal', 'APPROVED', user_gsrtc_head, now() - INTERVAL '1 day', 'Approved for standard VIP security monitoring duration', now() + INTERVAL '6 days')
    RETURNING id INTO req_id;

    INSERT INTO camera_access_request_cameras (request_id, camera_id)
    VALUES (req_id, c_gsrtc_cam)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed Initial Audit Events
DO $$
DECLARE
  admin_user UUID;
  head_user UUID;
BEGIN
  SELECT id INTO admin_user FROM users WHERE email = 'state.admin@example.gov.in';
  SELECT id INTO head_user FROM users WHERE email = 'police.head@example.gov.in';

  IF admin_user IS NOT NULL THEN
    INSERT INTO audit_events (actor_user_id, action, entity_type, detail)
    VALUES (admin_user, 'SYSTEM_INITIALIZATION', 'SYSTEM', '{"message":"Gujarat Video Intelligence platform initialized with baseline schema and seed entities"}'::jsonb);

    INSERT INTO audit_events (actor_user_id, action, entity_type, detail)
    VALUES (admin_user, 'WATCHLIST_CREATE', 'WATCHLIST', '{"name":"Stolen Motor Vehicles Statewide","scope":"GLOBAL"}'::jsonb);
  END IF;

  IF head_user IS NOT NULL THEN
    INSERT INTO audit_events (actor_user_id, action, entity_type, detail)
    VALUES (head_user, 'INVESTIGATION_CREATE', 'INVESTIGATION', '{"caseNumber":"INV-2026-GJ-001","title":"Investigation into Ahmedabad S.G. Highway Vehicle Theft Ring"}'::jsonb);
  END IF;
END $$;

INSERT INTO schema_migrations (version) VALUES ('010_seed_data') ON CONFLICT DO NOTHING;
