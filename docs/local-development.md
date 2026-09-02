# Local Development & Quickstart Guide

## Prerequisites
- Node.js v20+ (v22 / v24 recommended)
- Docker & Docker Compose
- npm v10+

---

## 1. Quick Setup with Docker Compose

Start the PostGIS 16 and Redis services:

```bash
docker compose up -d postgres redis
```

The database container automatically initializes all migrations and seeds 60+ cameras and test identities from `./database/init/`.

---

## 2. Running Locally

Install monorepo dependencies and start backend and frontend services:

```bash
npm install
npm run dev
```

- **Backend API**: `http://localhost:4000`
- **Frontend Portal**: `http://localhost:5173`
- **NGINX Proxy (if using full docker compose)**: `http://localhost:8080`

---

## 3. Pre-Seeded Development Identities

| Role | Email | Password | Scope |
|---|---|---|---|
| State Admin | `state.admin@example.gov.in` | `GovDevOnly!2026` | Statewide (All Cameras & Depts) |
| Police Dept Head | `police.head@example.gov.in` | `GovDevOnly!2026` | Police (Ahmedabad, Rajkot) |
| Police Officer / Investigator | `police.officer@example.gov.in` | `GovDevOnly!2026` | Police (Ahmedabad, Rajkot) |
| Police Operator | `police.operator@example.gov.in` | `GovDevOnly!2026` | Police (Ahmedabad, Rajkot) |
| GSRTC Dept Head | `gsrtc.head@example.gov.in` | `GovDevOnly!2026` | GSRTC (All Major Hubs) |

---

## 4. Running the Test Suite

```bash
npm test
```
