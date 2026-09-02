# Gujarat Government Video Intelligence Platform — Architectural Design

## 1. Executive Summary

The Gujarat Government Video Intelligence & Camera Management Platform is a centralized administrative control-room system designed for approximately 60 cameras initially and architected to scale toward 80,000 cameras.

It provides centralized camera registry, GIS mapping, multi-camera live video viewing (WebRTC/WHEP and raw RTSP/HLS), AI detection ingestion, cross-department camera access sharing, watchlists, data-driven alert rules, case-based investigation management, evidence integrity lockers, asynchronous reporting, and immutable audit trails.

---

## 2. High-Level Architecture

```
                                  +---------------------------------------+
                                  |   External AI Model API (Black Box)   |
                                  |  (Configured via AI_MODEL_API_URL)    |
                                  +-------------------+-------------------+
                                                      |
                                                      | WebRTC / WHEP / Events
                                                      v
+------------------+         +---------------+   +----+------------------+
|   React Client   | <=====> |  NGINX Proxy  |   |  AI Client Adapter    |
| (Gov Admin Portal)| (HTTP)  |  (Port 8080)  |   | (Mock / Real HTTP)    |
+--------+---------+         +-------+-------+   +----+------------------+
         |                           |                |
         | Direct WebRTC/HLS         v                v
         +=================> |    Node.js REST API Backend  |
                             |  - Central Authorization     |
                             |  - Scoped RBAC Engine        |
                             |  - Repositories & Services   |
                             +---+-------+-------+--------+-+
                                 |       |       |        |
             +-------------------+       |       |        +-------------------+
             v                           v       v                            v
    +-----------------+           +---------+ +-------------+         +---------------+
    | PostgreSQL 16   |           |  Redis  | | Kafka / Bus |         |  OpenSearch / |
    | + PostGIS 3.4   |           | (Cache) | | (Events)    |         | Search Engine |
    +-----------------+           +---------+ +-------------+         +---------------+
```

---

## 3. Core Architectural Principles

1. **Government Administrative Aesthetic**: High data density, crisp tables, restrained navy/gold palette, no flashy animations or startup SaaS gimmicks.
2. **Strict Server-Side Authorization**: React UI visibility is never trusted for authorization. Every protected endpoint derives permissions from authenticated identity, roles, department scope, and city scopes.
3. **External Black-Box AI Model**: No internal AI inference models or training pipelines. AI communication happens strictly through the `AIClient` adapter. If `AI_MODEL_API_URL` is unconfigured, the system starts gracefully as `NOT_CONFIGURED` without crashing, preserving raw video viewing.
4. **Separation of Raw vs AI Video**: Raw RTSP/HLS streams and AI-annotated WebRTC/WHEP streams are distinct channels. AI failure never causes raw camera viewing failure.
5. **No Automatic Stream Open**: Cameras existing in the database does not mean opening 80,000 browser streams. Streams open explicitly upon operator request, capped at a maximum concurrent view limit (default 16) with clean resource release on close.
6. **Graceful Degradation**: Outages in Redis, OpenSearch, or AI do not prevent core camera management and live viewing.
7. **Immutable Audit Trail**: Append-only security and operational audit records survive user suspension or status changes.
