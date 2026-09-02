# GPH-2026: Gujarat Government Sentinel Video Intelligence Platform

> **Official Gujarat State Police & Public Safety Video Intelligence & ANPR Surveillance Portal**

[![Platform Version](https://img.shields.io/badge/Sentinel-v1.0.0-blue.svg)](https://sentinel.gujarat.gov.in)
[![AI Engine](https://img.shields.io/badge/YOLOv11-ANPR%20ByteTrack-green.svg)](#sentinel-ai-microservice)
[![PostGIS](https://img.shields.io/badge/PostgreSQL%2FPostGIS-16-navy.svg)](#technology-stack)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](#technology-stack)

A production-grade, centralized administrative video intelligence and surveillance platform built for the **Government of Gujarat (Home Department & State Crime Records Bureau)**. Designed to connect state camera grids, run real-time YOLOv11 vehicle detection + license plate localization (ANPR), manage inter-departmental access sharing, and orchestrate control room operations.

---

## 🌟 Key Highlights & Capabilities

- **30-Camera Live Sentinel Sandbox Grid**: Pre-configured with official Gujarat Police RTSP live streams (`cam01` .. `cam30`) across major Gujarat districts (Ahmedabad, Surat, Rajkot, Vadodara, Gandhinagar).
- **YOLOv11 + ByteTrack + ANPR AI Pipeline**:
  - Vehicle detection (`yolo11n.pt`) and fine-tuned plate localization (`license-plate-finetune-v1n.pt`).
  - Automatic optical character recognition (EasyOCR) with instant telemetry ingestion to PostGIS backend.
- **Dual-Stream Control Room Matrix**:
  - Configurable **1x1 (Single), 2x2 (4-Up), 3x3 (9-Up), and 4x4 (16-Up)** layout grids.
  - One-click **"Switch to Raw" / "Switch to AI"** toggle between clean RTSP feeds and real-time AI bounding box annotated feeds.
  - High-tech stream loading & buffering state overlays with radar pulse indicators.
- **Camera Infrastructure & Asset Decommissioning**:
  - Flexible camera registration supporting short/custom external IDs and stream URIs.
  - Scope-aware asset decommissioning (`DELETE /api/cameras/:id`) restricted to State Admin or managing Department Head.
- **Interactive PostGIS Map**: Server-side grid clustering and city quick-focus selectors across Gujarat.
- **Multi-Role Security & RBAC**:
  - Enforces role hierarchy (`STATE_ADMIN`, `DEPARTMENT_HEAD`, `OFFICER`, `OPERATOR`, `INVESTIGATOR`).
  - Departmental isolation (Police, GSRTC, RTO, Hospital, Other) and city-level scopes.
- **Immutable Audit Trail**: Append-only security logging for camera updates, access requests, and deletions.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend Portal** | React 19, Vite 7, Leaflet & React-Leaflet, Modern Dark Glassmorphism CSS |
| **Backend REST API** | Node.js v20+, Express 5, `pg` (PostgreSQL client), `pino` logger, `zod` validation |
| **AI Inference Service** | Python 3.10, FastAPI, Uvicorn, Ultralytics YOLOv11, PyTorch, OpenCV, ByteTrack, EasyOCR |
| **Database & Spatial** | PostgreSQL 16 with PostGIS 3.4 & `pgcrypto` |
| **Cache & Session** | Redis 7 |

---

## 📡 Sentinel Camera Stream Integration Specs

The platform natively connects to the official **Sentinel Live Sandbox Stream Grid**:

- **RTSP Host**: `rtsp://103.250.160.189:8554/stream/cam01` through `cam30` (RTSP over TCP)
- **HLS Host**: `https://cctv.corp8.cloud/<cam_id>/index.m3u8`
- **WebRTC Host**: `http://103.250.160.189:8889/stream/<cam_id>/whep`

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js v20+ & npm
- Python 3.10+ with PyTorch & OpenCV
- Docker Desktop (for PostgreSQL/PostGIS & Redis)

### 2. Start Database & Infrastructure
```bash
# Launch PostGIS database & Redis containers
docker compose up -d postgres redis
```

### 3. Seed 30 Real Sentinel Cameras
```bash
# Seed 30 official Gujarat camera feeds into PostGIS
node scripts/seed_30_sentinel_cameras.js
```

### 4. Start Services

#### A. Python AI Inference Microservice (Port 8000)
```bash
cd model
python server.py
```

#### B. Node.js REST API Backend (Port 4000)
```bash
cd backend
npm install
npm run start
```

#### C. React Control Room Portal (Port 5173)
```bash
cd frontend
npm install
npm run dev
```

Visit the administrative control room portal at **`http://localhost:5173`**.

---

## 📖 Documentation Quick Links

- [Architecture Design](docs/architecture.md)
- [REST API Specification](docs/api.md)
- [RBAC & Scope Security Model](docs/rbac.md)
- [Database Schema & ERD](docs/database-schema.md)
- [AI Integration Contract](docs/ai-integration.md)

---

## 📄 License & Ownership

Developed for **Government of Gujarat - State Crime Records Bureau (SCRB)** under the **Sentinel Hackathon GPH-2026**.
