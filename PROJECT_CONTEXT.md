# Gujarat Government Video Intelligence Platform — Persistent Context

## Purpose

Build a production-oriented, centralized Government of Gujarat camera management and video-intelligence platform. It starts at roughly 60 cameras and is architected to scale toward 80,000 cameras through measured, incremental benchmarking. This is an operational government control-room portal, not a commercial SaaS product.

## Non-negotiable principles

- Serious, desktop-first public-sector administrative UX: light neutral background, compact tables, strong hierarchy, accessible controls, restrained colours and motion. No marketing/fintech/cyberpunk visual language.
- Camera data is government data. Backend authorization is mandatory; React visibility is never authorization.
- Authorization evaluates authenticated user identity, one-or-more roles, department scope, city scope, resource access, sharing status, expiry and revocation.
- State Admin has global authority. Department Heads are restricted to their department and assigned administrative scope. Lower roles cannot escalate privileges.
- Do not hard-delete users with historical actions; audit records remain valid.
- Cameras are government assets with a managing department, not permanently department-owned assets.
- Never send unauthorized camera metadata or detections to the frontend.
- Never auto-open streams simply because cameras exist. The configurable initial concurrent-live-view limit is 16; closing a view tears down WebRTC resources.
- Raw camera viewing and AI-annotated viewing are separate. AI failure must not prevent raw viewing when a raw stream is available.
- Historical video must not be invented from a live source. Evidence must distinguish live streams from recording/VMS/NVR-backed history.
- The AI model is an external black-box service. Do not implement inference, models, tracking, GPU scheduling or training.
- AI API URLs, credentials, broker/database addresses and other environment-specific values are never hardcoded.
- Do not add billing, subscriptions, payments, Stripe, or a tenant-pricing model.
- Begin as a modular Node.js application, not a premature microservice fleet.

## Target architecture

| Layer | Intended technology / responsibility |
| --- | --- |
| Frontend | React, routed modular UI, GIS map with clustering, explicit WebRTC/WHEP live viewing |
| API | Node.js REST API with controller/service/repository layers, validation, central auth, structured logs |
| Reverse proxy | NGINX |
| Primary data | PostgreSQL + PostGIS |
| Fast state/cache | Redis; optional for basic camera viewing |
| Event backbone | Kafka; configurable topics, consumer groups, retry/DLQ strategy |
| Search | OpenSearch with authorization filters |
| AI | Adapter selected by configuration: mock for development, HTTP client for external service |

Required environment configuration includes `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `OPENSEARCH_URL`, `AI_MODEL_API_URL`, `JWT_SECRET`, `APP_ENV`, and `PORT`. The application must start when `AI_MODEL_API_URL` is empty and present AI as `NOT_CONFIGURED`.

## Roles and scopes

Roles are multi-valued: `STATE_ADMIN`, `DEPARTMENT_HEAD`, `OFFICER`, `OPERATOR`, `INVESTIGATOR`.

Every user has a department, zero or more assigned cities, account status (`ACTIVE`, `SUSPENDED`, `DISABLED`), and administrative scope.

| Role | Core authority |
| --- | --- |
| State Admin | Global users, departments, policies, cameras, overrides and audit visibility |
| Department Head | Department users/cameras/access decisions, department policies/watchlists/rules/investigations |
| Officer | Authorized camera/search/alerts/watchlists, investigations and evidence |
| Operator | Authorized monitoring, live streams, camera health/AI status/recent detections and permitted alert acknowledgement |
| Investigator | Authorized historical search, investigations, relevant alerts, watchlists and evidence |

Initial department categories are GSRTC, POLICE, RTO, HOSPITAL and OTHER; the model must allow future categories.

## Essential data domains

- Departments, cities/districts, users, role assignments, user-city scopes
- Cameras, flexible catalogue metadata, location/geometry, stream configuration, health and AI state
- Camera sharing/access requests and grants, with scope, status, reason, approver, timestamps, expiry and revocation
- AI jobs and intelligence/detection events
- Watchlists and configurable alert rules; alerts
- Investigations, schedules, decisions and notes
- Evidence references/exports, reports and asynchronous report jobs
- Immutable audit records, policies/configuration and notifications abstraction

Camera statuses include `CONNECTING`, `ACTIVE`, `OFFLINE`, `DEGRADED`; operational summaries also support `ONLINE`, `OFFLINE`, `DEGRADED`, `UNKNOWN`. AI state is tracked separately.

Access request status: `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `REVOKED`. Grants are `TEMPORARY` or `PERMANENT`, and may address individual, multiple, or city-level cameras. State Admin overrides must be audited.

## Integration contracts

All AI communication goes through an `AIClient` adapter. It creates/stops jobs, reads job status/output metadata and retrieves WebRTC/WHEP information. AI events flow through Kafka, not direct calls to every downstream module.

AI input conceptually includes `cameraId`, `streamUrl`, and configuration; output is JSON intelligence events plus annotated live WebRTC/WHEP video. Kafka consumers include detection processing, search indexing, watchlist matching, alerting, analytics and investigations.

Search must authorize every query and support plate, vehicle, person/object, camera, department, city, date/time, track ID, alerts and investigations. Map APIs must return only authorized cameras, use server-side filtering/pagination and clustering—never all cameras by default.

## Reliability and security baseline

- REST responses use `{ success, data, message }` or `{ success: false, error: { code, message } }`; never expose stacks.
- Validate every API input and derive department/city/role authorization from server-side identity, never request fields.
- Use request/correlation IDs and structured logging.
- Provide `/api/health`, `/api/health/ready`, `/api/health/live`; liveness must not depend on optional services.
- Gracefully degrade: AI, Redis and OpenSearch outages must not kill basic camera management/viewing; Kafka buffering must be bounded; PostgreSQL failure may yield degraded/read-only behavior where practical.
- AI metadata retention is configuration-driven (initial env example `AI_METADATA_RETENTION_DAYS=30`), and cleanup jobs must be safe.

## Delivery expectations

Deliver source, migrations, seeds using clearly fake dev credentials, `.env.example`, API/architecture/RBAC/ERD/Kafka/OpenSearch/AI documentation, Docker/local setup, production configuration template, and tests. Seed the five initial department categories, diverse users/cities/cameras, access requests, alerts and investigations.

Testing must explicitly cover role combinations, wrong-city denial, no-resource-access denial, valid/expired/revoked sharing, State Admin access, department isolation, validation, audit logging, and AI/Kafka/database failure scenarios.

## Phased delivery order

1. Project setup, PostgreSQL/PostGIS, Redis, backend, frontend, NGINX
2. Authentication, users, roles, departments, cities
3. Scope-aware RBAC and authorization middleware
4. Camera catalogue/CRUD/health/status
5. Access requests, decisions, revocation and expiry
6. Gujarat map, filters and clustering
7. Explicit raw live viewing and WebRTC abstraction
8. External AI adapter and job lifecycle
9. Kafka ingestion and processing
10. OpenSearch authorized detection search
11. Watchlists
12. Configurable alert engine
13. Investigation engine
14. Evidence abstraction
15. Asynchronous reports
16. Audit
17. Failure handling, health and observability
18. Security hardening
19. Performance testing
20. Production deployment preparation

## Decision log

- 2026-08-23: Repository initialized from the authoritative product specification. No implementation phase has started yet; the workspace was empty.
- 2026-08-23: Phase 1 foundation started: npm workspaces, Node REST API, React government-style portal shell, PostGIS/Redis Docker services, NGINX proxy, health endpoints and environment template were added. Kafka/OpenSearch remain deferred until their application contracts are implemented.
- 2026-08-23: Phase 2 implementation started: PostGIS-backed departments, cities, users, multi-role and city-scope schema, fake development seed identities, and database-backed JWT authentication were added.
- 2026-08-23: Phase 3 authorization primitives added: centralized multi-role, city, department and explicit-share evaluation, with tests for wrong city, absent resource grant, valid sharing and State Admin access.
- 2026-08-23: Phase 4 camera catalogue started: PostGIS camera schema, health/AI status fields, seed camera, restricted paginated listing and scoped registration API were added.
- 2026-08-23: Phase 5 access sharing started: durable request/grant statuses, camera-scoped access requests, department/state decisions, revocation, expiry-ready state and audit event records were added.
- 2026-08-23: Phase 6 map feed started: Leaflet dependencies and an authorization-filtered, server-side grid-cluster camera endpoint were added. It limits marker payloads and does not expose the full catalogue by default.
- 2026-08-23: Phase 7-8: Live video matrix (1x1 to 4x4) and AI adapter (`AIClient`) implemented with WebRTC/WHEP stream session authorization, enforcing the 16 concurrent live view limit and graceful fallback when `AI_MODEL_API_URL` is omitted.
- 2026-08-23: Phase 9-10: Resilient event bus and OpenSearch/database detection search implemented with server-side authorized city and department constraints.
- 2026-08-23: Phase 11-12: Multi-entity watchlists and data-driven alert rule engine with triage workflows (`NEW`, `ACKNOWLEDGED`, `RESOLVED`) implemented.
- 2026-08-23: Phase 13-16: Investigation casebooks, SHA256 evidence locker, asynchronous report generator, and immutable audit logs added.
- 2026-08-23: Phase 17-20: Government-style control room portal UI completed across 14 views, full database migrations 001-010 with 60+ realistic Gujarat cameras across 5 cities, unit & integration test suite, and comprehensive architecture documentation completed.
- 2026-09-02: AI Model Integration: Built FastAPI microservice wrapper (`model/server.py`) around `SentinelPipeline` (`yolo11n.pt` + `license-plate-finetune-v1n.pt`). Connected Node.js backend (`HttpAIClient`) on `AI_MODEL_API_URL=http://localhost:8000`, added internal detection ingestion (`/api/ai/detections/ingest`), and enabled live annotated MJPEG stream viewing in React control room portal.

