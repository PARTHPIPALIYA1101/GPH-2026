# Gujarat Government Video Intelligence & Camera Management Platform

A production-oriented, centralized administrative video intelligence and surveillance portal built for the Government of Gujarat.

Designed for approximately 60 cameras initially and architected to scale toward 80,000 cameras.

---

## Key Highlights

- **Serious Administrative UX**: Purpose-built for police control rooms and public-sector operations. High data density, crisp tables, restrained palette (Gujarat Navy & Gold), and accessible controls.
- **Multi-Dimensional Authorization**: Multi-role (`STATE_ADMIN`, `DEPARTMENT_HEAD`, `OFFICER`, `OPERATOR`, `INVESTIGATOR`), departmental isolation, and city scopes enforced strictly on the backend.
- **Inter-Department Camera Sharing**: Request, approve, reject, revoke, and override workflows for sharing camera streams across government departments.
- **Gujarat GIS Surveillance Map**: Interactive Leaflet map with server-side grid clustering and city jump selectors (Ahmedabad, Surat, Rajkot, Vadodara, Gandhinagar).
- **Multi-Camera Live Matrix**: Configurable 1x1, 2x2, 3x3, 4x4 matrix view supporting WebRTC/WHEP AI-annotated output and raw RTSP/HLS feeds, enforcing a maximum concurrent view limit (default 16) with clean resource teardown.
- **Black-Box AI Integration**: External AI Model API connected via `AIClient` adapter. AI failure does not prevent raw viewing; application starts gracefully without crashing if unconfigured (`NOT_CONFIGURED`).
- **Intelligence Event Backbone**: Resilient event bus and Kafka ingestion architecture feeding downstream search indexing, watchlist matching, and alert rules.
- **Advanced ANPR & Detection Search**: Fast search across historical plate captures, vehicle classifications, and colors with strict authorization filtering.
- **Watchlist & Alert Engine**: Multi-entity watchlists (Plates, Vehicles, Persons) with configurable data-driven alert rules and operational triage workflows (Acknowledge, Resolve with notes).
- **Investigation Casebook**: Case management with scheduled repeat searches, auto-match linking, evidence attachment, and Department Head decision authority.
- **Evidence Locker**: Cryptographic SHA256 integrity verification, distinguishing live captures from historical VMS recordings.
- **Asynchronous Reports**: Background generation of CSV and JSON reports for camera health, ANPR detections, alerts, and investigations.
- **Immutable Audit Trail**: Append-only security and operational audit logging.

---

## Technology Stack

- **Frontend**: React 19, React Router v7, Leaflet & React-Leaflet, Vite 7.
- **Backend API**: Node.js v20+, Express 5, `pg` (PostgreSQL client), `pino` & `pino-http` (structured logging), `zod` (validation).
- **Database**: PostgreSQL 16 with PostGIS 3.4 & pgcrypto.
- **State & Caching**: Redis 7.
- **Reverse Proxy**: NGINX 1.27.
- **Event Backbone**: Kafka.
- **Search**: OpenSearch / PostgreSQL indexed search fallback.

---

## Documentation Quick Links

- [Architecture Design](docs/architecture.md)
- [RBAC & City Scope Authorization Model](docs/rbac.md)
- [REST API Specification](docs/api.md)
- [Database Schema & ERD](docs/database-schema.md)
- [Kafka Topic Architecture](docs/kafka-topics.md)
- [OpenSearch Index Specification](docs/opensearch-indices.md)
- [External AI Model Integration Contract](docs/ai-integration.md)
- [Local Development & Credentials](docs/local-development.md)

---

## Quick Start

```bash
# 1. Start database and cache
docker compose up -d postgres redis

# 2. Install dependencies & run tests
npm install
npm test

# 3. Start development servers
npm run dev
```

Visit the administrative portal at `http://localhost:5173`.
