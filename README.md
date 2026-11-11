<div align="center">

# Beroya On + | Shuttle Platform

**An integrated school and university transportation platform** — combining a bilingual operations dashboard with a multi-institution API for coordinating trips, fleets, and live operations.

![Backend](https://img.shields.io/badge/Backend-NestJS_11-E0234E?logo=nestjs&logoColor=white)
![Frontend](https://img.shields.io/badge/Frontend-Next.js_16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?logo=typescript&logoColor=white)
![Database](https://img.shields.io/badge/Database-PostgreSQL_16-4169E1?logo=postgresql&logoColor=white)
![Realtime](https://img.shields.io/badge/Realtime-Socket.IO-010101?logo=socket.io&logoColor=white)

</div>

---

## Overview

This repository contains two applications that work together:

| Application | Directory | Purpose |
| --- | --- | --- |
| **Backend API** | [`beroya-shuttle/`](beroya-shuttle/) | NestJS API, database integration, background worker, and realtime gateway. |
| **Web Dashboard** | [`shuttle_dashboard/`](shuttle_dashboard/) | Arabic and English operations console for Beroya and institution administrators. |

The dashboard sends REST requests to the backend under `/api/v1/shuttle` and connects to Socket.IO at `/realtime` for live updates.

## Platform capabilities

- Multi-institution operations with tenant data isolation.
- Role-specific workflows for Beroya administrators, institution administrators, drivers, attendants, parents, and university students.
- Route and daily trip planning, fleet and student management, and crew coordination.
- Maps and live trip tracking, incident and notification management, and audit history.
- Arabic and English interface with right-to-left support, plus light and dark themes.

## Technology

| Component | Main technologies |
| --- | --- |
| Backend | NestJS 11, TypeScript, Prisma 7 |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Data | PostgreSQL 16 |
| Jobs and realtime | Redis, BullMQ, Socket.IO |
| File storage | MinIO locally or S3-compatible storage |
| Maps and localization | Leaflet, next-intl |

## Requirements

- Node.js 22 is recommended for consistent backend support; the frontend requires Node.js 20.9 or newer.
- npm.
- Docker Desktop or Docker Engine with Docker Compose.
- Local services: PostgreSQL 16, Redis 7, and MinIO. Start them with the Compose configuration in the backend directory.

## Local development

### 1. Start the backend

Open a terminal in `beroya-shuttle`:

```bash
cp .env.example .env
npm ci
docker compose up -d postgres redis minio minio-init
```

On Windows PowerShell, create the environment file with:

```powershell
Copy-Item .env.example .env
```

Configure `.env` before starting the application. Required settings include the PostgreSQL connection (`DATABASE_URL`), Redis host (`REDIS_HOST`), JWT secrets, and either MinIO or R2 settings. For a typical local setup, use port `3001` and the Compose database credentials (`beroya` / `beroya`, database `beroya_shuttle`). See the [backend documentation](beroya-shuttle/README.md) and `src/config/env.schema.ts` for details.

After configuring the environment:

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
npm run dev
```

To process background jobs, start the worker in a second terminal:

```bash
npm run start:worker:dev
```

### 2. Start the frontend

Open another terminal in `shuttle_dashboard`:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

On PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Open [http://localhost:3005](http://localhost:3005). By default, the frontend forwards REST requests to `http://localhost:3001` through a Next.js rewrite and uses the same origin for Socket.IO.

### Local URLs

| Service | URL |
| --- | --- |
| Dashboard | [http://localhost:3005](http://localhost:3005) |
| API | `http://localhost:3001/api/v1/shuttle` |
| Swagger | `http://localhost:3001/api/v1/shuttle/docs` |
| Health check | `http://localhost:3001/health` |
| Metrics | `http://localhost:3001/metrics` |
| MinIO Console | `http://localhost:9001` |

## Authentication

Accounts must already exist in the database; self-service registration is not supported. The OTP module and routes are currently parked in the backend configuration, so check the active authentication contract in Swagger before attempting to sign in. See the seed files in `beroya-shuttle/prisma/` for locally available accounts, and use development credentials only in local environments.

## Configuration and integration

- In the frontend, `BACKEND_URL` sets the backend origin used by Next.js to rewrite `/api/v1/shuttle/*` requests.
- `NEXT_PUBLIC_SOCKET_URL` sets the Socket.IO origin available to the browser, typically the backend origin.
- Keep `NEXT_PUBLIC_API_BASE` set to `/api/v1/shuttle` to use the rewrite for REST requests.
- `NEXT_PUBLIC_*` settings are exposed to browser code; do not put secrets in them.
- Required backend settings and validation rules are defined in `beroya-shuttle/src/config/env.schema.ts`.

## Essential commands

| Directory | Command | Purpose |
| --- | --- | --- |
| `beroya-shuttle` | `npm run dev` | Start the API in development mode. |
| `beroya-shuttle` | `npm run start:worker:dev` | Start the background worker in development mode. |
| `beroya-shuttle` | `npm run build` | Build the backend. |
| `beroya-shuttle` | `npm run typecheck` | Type-check the backend. |
| `shuttle_dashboard` | `npm run dev` | Start the dashboard on port 3005. |
| `shuttle_dashboard` | `npm run build` | Build the frontend for production. |
| `shuttle_dashboard` | `npm run lint` | Run ESLint on the frontend. |

## Deployment

Each application has its own build and runtime configuration. Provide production-grade infrastructure and credentials, configure the API and Socket.IO origins, and build each application from its own directory. The backend includes Docker and Compose files plus a staging helper; review their settings and environment configuration before using them in a deployment environment.

## Detailed documentation

- [Backend README: setup, environment, API, worker, and deployment](beroya-shuttle/README.md)
- [Frontend README: dashboard, configuration, integration, and build](shuttle_dashboard/README.md)

## License

This is a private project and is not currently licensed for redistribution.
