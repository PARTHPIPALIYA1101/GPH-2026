# Kafka Event Backbone & Topic Architecture

The platform uses Apache Kafka as the central asynchronous event backbone. AI intelligence events flow through Kafka topics to decouple inference from downstream storage, alerting, and search indexing.

## Configurable Topics

| Topic Name | Purpose | Partitioning Key |
|---|---|---|
| `ai.detections` | Ingestion of raw AI JSON detection and ANPR events | `cameraId` |
| `surveillance.alerts` | Published when an alert rule matches an incoming event | `departmentId` |
| `investigation.matches` | Published when an active investigation target matches a detection | `investigationId` |
| `audit.events` | Asynchronous export of audit log records | `actorUserId` |

## Consumer Groups

1. `detection-processor-group`: Ingests and stores detections in PostgreSQL / PostGIS.
2. `watchlist-matcher-group`: Evaluates detections against active watchlists and generates alert events.
3. `investigation-engine-group`: Matches detections against active investigation targets.
4. `search-indexer-group`: Indexes detection documents into OpenSearch for high-throughput search queries.
