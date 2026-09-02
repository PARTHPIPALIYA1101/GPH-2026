# Database Schema & Entity-Relationship Documentation

The platform uses PostgreSQL 16 with the PostGIS 3.4 spatial extension.

## Core Normalized Tables

1. `departments`: id (UUID), code (UNIQUE TEXT), name, category, active, timestamps.
2. `cities`: id (UUID), name, district, state_code ('GJ'), boundary (GEOMETRY MultiPolygon), active, timestamps.
3. `users`: id (UUID), department_id (FK departments), email (UNIQUE), display_name, password_hash (pgcrypto), status (`ACTIVE`, `SUSPENDED`, `DISABLED`), administrative_scope (JSONB), last_login_at, timestamps.
4. `user_roles`: user_id (FK users), role (`STATE_ADMIN`, `DEPARTMENT_HEAD`, `OFFICER`, `OPERATOR`, `INVESTIGATOR`). Composite PK `(user_id, role)`.
5. `user_city_scopes`: user_id (FK users), city_id (FK cities). Composite PK `(user_id, city_id)`.
6. `cameras`: id (UUID), external_id (UNIQUE), camera_number, name, managing_department_id (FK departments), city_id (FK cities), location_description, coordinates (GEOMETRY Point 4326), stream_protocol, stream_reference, status (`CONNECTING`, `ACTIVE`, `OFFLINE`, `DEGRADED`), ai_state (`NOT_CONFIGURED`, `IDLE`, `PROCESSING`, `DELAYED`, `ERROR`), last_seen_at, reconnect_attempts, active, timestamps.
7. `camera_access_requests`: id (UUID), requesting_department_id (FK departments), requested_by (FK users), status (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `REVOKED`), duration (`TEMPORARY`, `PERMANENT`), reason, requested_at, decided_by (FK users), decided_at, decision_reason, expires_at, revoked_by (FK users), revoked_at, override_by (FK users), override_at.
8. `camera_access_request_cameras`: request_id (FK camera_access_requests), camera_id (FK cameras). Composite PK.
9. `ai_jobs`: id (UUID), camera_id (FK cameras), external_job_id, status (`STARTING`, `RUNNING`, `DEGRADED`, `STOPPING`, `STOPPED`, `ERROR`), profile, priority, last_latency_ms, last_error, started_at, stopped_at, timestamps.
10. `detections`: id (UUID), camera_id (FK cameras), city_id (FK cities), department_id (FK departments), detection_type (`PLATE`, `VEHICLE`, `PERSON`, `OBJECT`), confidence (REAL), track_id, plate_number, vehicle_type, vehicle_color, person_attributes (JSONB), attributes (JSONB), detected_at, evidence_url, created_at.
11. `watchlists`: id (UUID), name, entity_type (`PLATE`, `VEHICLE`, `PERSON`, `OBJECT`, `CAMERA`), scope (`DEPARTMENT`, `GLOBAL`), department_id (FK departments nullable), description, created_by (FK users), active, timestamps.
12. `watchlist_items`: id (UUID), watchlist_id (FK watchlists), value, description, severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), active, timestamps.
13. `alert_rules`: id (UUID), name, department_id (FK departments nullable), scope (`DEPARTMENT`, `GLOBAL`), conditions (JSONB), severity, active, created_by (FK users), timestamps.
14. `alerts`: id (UUID), rule_id (FK alert_rules nullable), detection_id (FK detections nullable), camera_id (FK cameras), city_id (FK cities), department_id (FK departments), severity, title, description, status (`NEW`, `ACKNOWLEDGED`, `RESOLVED`), acknowledged_by (FK users), acknowledged_at, resolved_by (FK users), resolved_at, resolution_notes, metadata (JSONB), created_at.
15. `investigations`: id (UUID), case_number (UNIQUE), title, description, department_id (FK departments), created_by (FK users), lead_investigator_id (FK users), status (`OPEN`, `IN_PROGRESS`, `MATCH_FOUND`, `UNDER_REVIEW`, `RESOLVED`, `CLOSED`, `EXPIRED`), target_type, target_value, search_criteria (JSONB), decision_notes, decided_by (FK users), decided_at, expires_at, timestamps.
16. `investigation_schedules`: id (UUID), investigation_id (FK investigations), interval_minutes, last_run_at, next_run_at, active, created_at.
17. `investigation_results`: id (UUID), investigation_id (FK investigations), detection_id (FK detections), relevance_score, notes, attached_at.
18. `evidence`: id (UUID), case_id (FK investigations nullable), detection_id (FK detections nullable), camera_id (FK cameras nullable), evidence_type (`IMAGE_SNAPSHOT`, `METADATA_JSON`, `VIDEO_CLIP`, `REPORT_DOCUMENT`), source_type (`LIVE_SNAPSHOT`, `RECORDED_VMS`), title, storage_reference, hash_sha256, metadata (JSONB), exported_by (FK users), created_at.
19. `reports`: id (UUID), title, report_type (`CAMERA_HEALTH`, `DOWNTIME`, `DETECTION_ANPR`, `ALERTS_SUMMARY`, `INVESTIGATIONS_SUMMARY`, `DEPARTMENT_ACTIVITY`, `AUDIT_TRAIL`), parameters (JSONB), format (`CSV`, `JSON`, `PDF`), status (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`), download_url, content, created_by (FK users), department_id (FK departments nullable), created_at, completed_at, error_message.
20. `audit_events`: id (UUID), actor_user_id (FK users), action, entity_type, entity_id, request_id, detail (JSONB), created_at. Append-only.
