# OpenSearch Index Architecture & Authorized Search

OpenSearch is used for high-volume detection queries, full-text plate searches, and attribute filtering.

## Indices

### 1. `detections-v1`
Stores detection records with geolocation, plate numbers, and vehicle attributes.

#### Mapping
```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "cameraId": { "type": "keyword" },
      "cityId": { "type": "keyword" },
      "cityName": { "type": "keyword" },
      "departmentId": { "type": "keyword" },
      "detectionType": { "type": "keyword" },
      "confidence": { "type": "float" },
      "trackId": { "type": "keyword" },
      "plateNumber": { "type": "keyword" },
      "vehicleType": { "type": "keyword" },
      "vehicleColor": { "type": "keyword" },
      "coordinates": { "type": "geo_point" },
      "detectedAt": { "type": "date" }
    }
  }
}
```

### Authorization Filter Injection
Every OpenSearch query automatically wraps search terms inside a `bool.must` filter containing the server-side authorized department and city constraints of the authenticated user.
