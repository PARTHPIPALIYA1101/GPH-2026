# Gujarat Government Video Intelligence Platform — REST API Specification

All protected endpoints require an `Authorization: Bearer <token>` header obtained from `/api/auth/login`.

## Standard Response Envelopes

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully."
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_DENIED",
    "message": "You are not authorized to access this resource."
  }
}
```

---

## 1. Authentication & Identity (`/api/auth`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticate with government email & password; returns bearer token and user profile. |
| `GET` | `/api/auth/me` | Authenticated | Retrieve authenticated identity, active roles, department, and assigned city scopes. |
| `POST` | `/api/auth/logout` | Authenticated | Terminate session and audit user logout. |

---

## 2. User & Scope Administration (`/api/users`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/users` | `STATE_ADMIN`, `DEPARTMENT_HEAD` | List users. State Admin views statewide; Dept Head views own department users. |
| `GET` | `/api/users/:id` | `STATE_ADMIN`, `DEPARTMENT_HEAD` | Get user details and assigned city scopes. |
| `POST` | `/api/users` | `STATE_ADMIN`, `DEPARTMENT_HEAD` | Create user with multi-roles and assigned city scopes. |
| `PATCH` | `/api/users/:id/status` | `STATE_ADMIN`, `DEPARTMENT_HEAD` | Update user status (`ACTIVE`, `SUSPENDED`, `DISABLED`). No hard deletes. |

---

## 3. Departments & Cities (`/api/departments`, `/api/cities`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/departments` | Authenticated | List government departments with active personnel and camera counts. |
| `POST` | `/api/departments` | `STATE_ADMIN` | Register a new government department. |
| `GET` | `/api/cities` | Authenticated | List Gujarat cities and surveillance districts. |
| `POST` | `/api/cities` | `STATE_ADMIN` | Register a new city/district boundary. |

---

## 4. Camera Registry & GIS Clusters (`/api/cameras`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/cameras` | Authenticated | List authorized cameras with server-side pagination, city, status, and department filters. |
| `GET` | `/api/cameras/summary` | Authenticated | Retrieve aggregated operational metrics (Online, Offline, Degraded, AI state counts). |
| `GET` | `/api/cameras/map` | Authenticated | Retrieve server-side grid-clustered camera feed for Gujarat GIS map. |
| `GET` | `/api/cameras/:id` | Authenticated | Retrieve individual camera asset specifications. |
| `POST` | `/api/cameras` | `STATE_ADMIN`, `DEPARTMENT_HEAD` | Register a new surveillance camera asset with PostGIS coordinates. |
| `PATCH` | `/api/cameras/:id` | `STATE_ADMIN`, `DEPARTMENT_HEAD` | Update camera asset configuration or stream references. |

---

## 5. Camera Access Sharing & Governance (`/api/access-requests`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/access-requests` | Authenticated | List incoming (to decide) or outgoing camera access requests. |
| `GET` | `/api/access-requests/:id` | Authenticated | Inspect specific access sharing request dossier. |
| `POST` | `/api/access-requests` | `OFFICER`, `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Submit an inter-departmental camera access request. |
| `POST` | `/api/access-requests/:id/decision` | `DEPARTMENT_HEAD`, `STATE_ADMIN` | Approve or reject request with mandatory operational justification. |
| `POST` | `/api/access-requests/:id/revoke` | `DEPARTMENT_HEAD`, `STATE_ADMIN` | Revoke an existing approved camera access grant. |

---

## 6. Live Stream Session Management (`/api/streams`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `POST` | `/api/streams/session` | Authenticated | Authorize live viewing stream (Raw RTSP vs AI-annotated WebRTC). Enforces max 16 concurrent view ceiling. |
| `POST` | `/api/streams/session/release` | Authenticated | Close stream session and release browser/server resources. |
| `GET` | `/api/streams/stats` | Authenticated | Query active concurrent streams for user. |

---

## 7. External AI Adapter & Proxy (`/api/ai`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/ai/status` | Authenticated | Query external AI Model API connectivity and client mode. |
| `GET` | `/api/ai/jobs` | Authenticated | List active AI processing jobs. |
| `POST` | `/api/ai/jobs` | `STATE_ADMIN`, `DEPARTMENT_HEAD` | Start an AI processing job for a camera. |
| `POST` | `/api/ai/jobs/:jobId/stop` | `STATE_ADMIN`, `DEPARTMENT_HEAD` | Terminate an AI processing job. |
| `POST` | `/api/ai/simulate-detection` | Authenticated | Simulate incoming AI detection event for development and pipeline verification. |

---

## 8. Intelligence Search (`/api/search`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/search` | `OFFICER`, `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Authorized search across historical ANPR plate captures and detection events. |

---

## 9. Surveillance Watchlists (`/api/watchlists`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/watchlists` | Authenticated | List active departmental and statewide global watchlists. |
| `GET` | `/api/watchlists/:id` | Authenticated | Get watchlist and active target items. |
| `POST` | `/api/watchlists` | `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Create a new surveillance watchlist. |
| `POST` | `/api/watchlists/:id/items` | `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Add target value (e.g. plate) to watchlist. |
| `DELETE` | `/api/watchlists/:id/items/:itemId` | `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Deactivate watchlist target item. |

---

## 10. Alert Operations & Rules (`/api/alerts`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/alerts` | Authenticated | List real-time alert triage queue with status and severity filters. |
| `GET` | `/api/alerts/rules` | Authenticated | List active data-driven alert trigger rules. |
| `POST` | `/api/alerts/rules` | `DEPARTMENT_HEAD`, `STATE_ADMIN` | Configure a new alert trigger rule. |
| `GET` | `/api/alerts/:id` | Authenticated | Get alert details, triggering detection, and camera context. |
| `POST` | `/api/alerts/:id/acknowledge` | `OPERATOR`, `OFFICER`, `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Take ownership / acknowledge alert. |
| `POST` | `/api/alerts/:id/resolve` | `OFFICER`, `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Resolve alert with mandatory resolution summary. |

---

## 11. Investigation Casebook (`/api/investigations`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/investigations` | `OFFICER`, `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | List active investigation case files. |
| `GET` | `/api/investigations/:id` | `OFFICER`, `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Retrieve complete case dossier with detection timeline and evidence. |
| `POST` | `/api/investigations` | `OFFICER`, `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Open a new investigation case with auto-search schedules. |
| `POST` | `/api/investigations/:id/decision` | `DEPARTMENT_HEAD`, `STATE_ADMIN` | Submit Department Head final decision to resolve/close case. |
| `POST` | `/api/investigations/:id/attach-detection` | `INVESTIGATOR`, `OFFICER`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Link an ANPR detection capture to the case file. |

---

## 12. Evidence Management Locker (`/api/evidence`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/evidence` | `OFFICER`, `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | List registered evidence items with SHA256 hashes. |
| `POST` | `/api/evidence` | `OFFICER`, `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Save evidence record with cryptographic SHA256 integrity hash. |

---

## 13. Asynchronous Reports (`/api/reports`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/reports` | Authenticated | List generated operational reports. |
| `POST` | `/api/reports` | `OFFICER`, `INVESTIGATOR`, `DEPARTMENT_HEAD`, `STATE_ADMIN` | Queue asynchronous generation of CSV or JSON reports. |
| `GET` | `/api/reports/:id/download` | Authenticated | Download completed report file. |

---

## 14. Audit Trail (`/api/audit`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/audit` | `DEPARTMENT_HEAD`, `STATE_ADMIN` | Inspect append-only immutable audit records. Scoped to department or statewide. |

---

## 15. System Health & Observability (`/api/health`)

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | General service status. |
| `GET` | `/api/health/live` | Public | Kubernetes / container liveness probe. |
| `GET` | `/api/health/ready` | Public | Dependency readiness probe (PostgreSQL, PostGIS, Redis, Kafka, AI adapter). |
