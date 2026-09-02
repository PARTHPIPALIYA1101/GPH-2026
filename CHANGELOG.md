# Changelog — GPH-2026 Sentinel Platform

All notable changes to this project are documented here.

---

## [Unreleased] — 2026-09-02

### 🐛 Bug Fixes

#### 1. Investigation Case Creation — PostgreSQL Type Conflict (500 Error)
**File:** `backend/src/repositories/investigation.repository.js`

**Problem:** `POST /api/investigations` returned HTTP 500 with PostgreSQL error `42P08 — inconsistent types deduced for parameter $2 (text versus integer)`.

The `INSERT INTO investigation_schedules` query reused `$2` in two conflicting roles:
```sql
-- BROKEN: $2 bound as integer for interval_minutes, but also used as text via || concatenation
VALUES ($1, $2, now() + ($2 || ' minutes')::interval)
```
PostgreSQL's prepared statement engine cannot infer a single consistent type for `$2`.

**Fix:** Use PostgreSQL's `make_interval()` function with a dedicated `$3` parameter, so `$2` remains unambiguously integer:
```sql
-- FIXED: $3 is a separate integer-typed parameter exclusively for the interval
VALUES ($1, $2, now() + make_interval(mins => $3))
```

---

#### 2. AI Model Server — Missing MJPEG Streaming Endpoints (404 Error)
**File:** `model/server.py`

**Problem:** The frontend `LiveMatrix.jsx` requested two MJPEG endpoints:
- `GET /api/v1/streams/{camera_id}/mjpeg`
- `GET /api/v1/streams/{camera_id}/raw_mjpeg`

These were referenced in job response payloads (`webrtcEndpoint`) but were **never implemented** in `server.py`. Only a metadata route (`GET /api/v1/streams/{camera_id}`) existed, returning `404` for the actual stream.

**Fix:** Added two `StreamingResponse` FastAPI endpoints that yield multipart JPEG frames at ~20 fps from in-memory frame buffers. A styled loading placeholder is served while the RTSP connection is establishing.

---

#### 3. Department ID Null Constraint — State Admin Investigation Creation
**File:** `backend/src/repositories/investigation.repository.js`

**Problem:** The `investigations` table has `department_id NOT NULL`, but `STATE_ADMIN` users have `null` `departmentId`. This caused a PostgreSQL NOT NULL violation.

**Fix:** Added a fallback in `createInvestigation()` — if `departmentId` is null, query for the first available department (preferring `code = 'POLICE'`).

---

### ✨ Improvements

#### 4. Live Matrix Grid — Persist Camera Layout Across Refreshes
**File:** `frontend/src/live/LiveMatrix.jsx`

**Problem:** Camera slot assignments and grid layout were stored only in React component state — cleared on every page refresh.

**Fix:** Persist both grid size and slot camera assignments to `localStorage`:

| Key | What is saved |
|---|---|
| `gov_live_grid` | Selected grid layout (1/4/9/16 slots) |
| `gov_live_slots` | Per-slot camera object + streamType (not session tokens) |

On mount, saved slots are restored and stream sessions are re-initiated automatically. Sessions (ephemeral tokens) are never persisted — always re-created from the backend on restore.

---

#### 5. Investigation Controller — Better Zod Validation Error Messages
**File:** `backend/src/controllers/investigation.controller.js`

Improved Zod schema validation to surface detailed, human-readable error messages per field instead of generic 400 responses.

---

#### 6. AI Client — URL Validation and Reconnect Backoff
**File:** `backend/src/ai/ai-client.js` · `model/server.py`

- Added `isValidRoutableUrl()` to skip DNS resolution for dummy/placeholder stream URLs (e.g., `rtsp://test/...`).
- Implemented exponential backoff (2s → 30s cap) for RTSP reconnection attempts in the AI worker thread.

---

## Technical Reference

### Investigation Case API
```
POST /api/investigations
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Case title (min 5 chars)",
  "description": "Investigation notes (min 10 chars)",
  "targetValue": "GJ01AB1234",
  "targetType": "PLATE",
  "intervalMinutes": 360,
  "expiresAt": "2026-12-31T00:00:00.000Z"
}
```

### MJPEG Stream Endpoints (Model Server Port 8000)
```
GET /api/v1/streams/{cameraId}/mjpeg       → AI-annotated live MJPEG
GET /api/v1/streams/{cameraId}/raw_mjpeg   → Raw RTSP MJPEG pass-through
```

### Live Grid localStorage Keys
```
gov_live_grid   → "4" | "1" | "9" | "16"
gov_live_slots  → JSON array[16] of { camera, streamType, startedAt } | null
```
