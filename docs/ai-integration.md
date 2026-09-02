# External AI Model API Integration Specification

## 1. Black-Box Interface Principle

The AI Model is treated as an external black-box service. The platform does NOT implement model inference, training pipelines, or GPU schedulers internally.

Communication occurs exclusively through the `AIClient` adapter interface configured via environment variables:

```env
AI_MODEL_API_URL=https://ai-model.internal.gov.in
AI_CLIENT_MODE=http # or 'mock' for offline development
```

When `AI_MODEL_API_URL` is omitted, the platform starts gracefully in `NOT_CONFIGURED` mode without crashing, keeping raw camera management and direct RTSP/HLS stream viewing fully functional.

---

## 2. API Contract

### Request: Initiate AI Stream Job
`POST /api/v1/jobs`
```json
{
  "cameraId": "d9b23b12-9c17-4884-bb60-84cf9158ba6d",
  "streamUrl": "rtsp://10.20.1.101:554/live",
  "configuration": {
    "profile": "standard_surveillance",
    "priority": "high"
  }
}
```

### Response: Stream Information & WHEP Endpoint
```json
{
  "externalJobId": "AI-JOB-9912",
  "status": "RUNNING",
  "webrtcEndpoint": "/api/ai/streams/d9b23b12-9c17-4884-bb60-84cf9158ba6d/whep",
  "hlsUrl": "https://stream.internal.gov.in/live/d9b23b12-9c17-4884-bb60-84cf9158ba6d.m3u8",
  "protocol": "WHEP"
}
```

### Ingestion: AI Intelligence Event (JSON over Kafka)
```json
{
  "cameraId": "d9b23b12-9c17-4884-bb60-84cf9158ba6d",
  "cityId": "231a48ff-604a-4a25-832f-48889ec1b701",
  "departmentId": "48b610c1-3f11-4770-9889-8d769c3a3b01",
  "detectionType": "PLATE",
  "confidence": 0.94,
  "trackId": "TRK-AMD-8821",
  "plateNumber": "GJ01AB1234",
  "vehicleType": "SUV",
  "vehicleColor": "WHITE",
  "detectedAt": "2026-08-23T12:30:00.000Z",
  "evidenceUrl": "https://storage.internal.gov.in/evidence/frame_8821.jpg"
}
```
