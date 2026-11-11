# Beroya Shuttle API

**Backend service for Beroya On +** — a multi-institution school and university transportation platform. This repository contains the REST API, background worker, data model, and realtime gateway used by the web dashboard and mobile clients.

> This project is private and currently has no public license. Do not redistribute it without authorization.

## Contents

- [Platform capabilities](#platform-capabilities)
- [Architecture and technology](#architecture-and-technology)
- [Requirements](#requirements)
- [Local development](#local-development)
- [Environment configuration](#environment-configuration)
- [API and realtime contract](#api-and-realtime-contract)
- [Authentication](#authentication)
- [Background worker](#background-worker)
- [Production deployment](#production-deployment)
- [Useful commands](#useful-commands)
- [Repository map](#repository-map)

## Platform capabilities

- Role-based workflows for `BEROYA_ADMIN`, `INSTITUTION_ADMIN`, `DRIVER`, `ATTENDANT`, `PARENT`, and `UNIVERSITY_STUDENT`.
- Multi-tenant institution data isolation and support for Beroya-operated, institution-operated, and hybrid fleets.
- Separate route plans and daily trips, with trip generation, live tracking, ETA, delays, boarding and drop-off, incidents, emergencies, and crew changes.
- Notifications, audit history, institution operations, and administrative reporting.
- Realtime updates over Socket.IO and asynchronous scheduled work through BullMQ.

Feature boundaries and the generated client contract are documented in the repository-level `BACKEND_PLAN.md`, `FRONTEND_PLAN.md`, and `MOBILE_PLAN.md` files.

## Architecture and technology

| Area | Technology |
| --- | --- |
| API | NestJS 11, TypeScript, Express |
| Database | PostgreSQL 16, Prisma 7 |
| Jobs and cache | Redis 7, BullMQ |
| Realtime | Socket.IO on `/realtime` |
| Object storage | MinIO locally; S3-compatible storage |
| API documentation | Swagger / OpenAPI |
| Observability | Pino, Prometheus metrics, optional Sentry |

The API prefix is `/api/v1/shuttle`. Health and metrics endpoints are mounted at `/health` and `/metrics`.

## Requirements

- Node.js 22 (use the version pinned by the repository if one is added).
- npm.
- Docker Desktop or compatible Docker Engine with Compose.
- PostgreSQL 16, Redis 7, and MinIO. The provided Compose file starts these dependencies.

## Local development

Run these commands from this directory (`beroya-shuttle`).

1. Create local configuration:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env`.

2. Start the local infrastructure:

   ```bash
   docker compose up -d postgres redis minio minio-init
   ```

3. Set the required values in `.env`. A typical local setup uses the Compose PostgreSQL credentials (`beroya` / `beroya`, database `beroya_shuttle`), `PORT=3001`, `REDIS_HOST=localhost`, and `MOCK_REDIS=true` if you do not want the API to connect to Redis during development. Provide `DATABASE_URL`, JWT secrets (at least 16 characters each), and either MinIO settings or complete R2 settings. Check `src/config/env.schema.ts` for defaults and validation rules.

4. Install dependencies, apply migrations, generate Prisma Client, and seed the database:

   ```bash
   npm ci
   npx prisma migrate deploy
   npx prisma generate
   npx prisma db seed
   ```

5. Start the API:

   ```bash
   npm run dev
   ```

   The default local API origin is `http://localhost:3001` when `PORT=3001` is configured.

6. (Optional) Start the background worker in a second terminal:

   ```bash
   npm run start:worker:dev
   ```

### Local endpoints

| Service | URL |
| --- | --- |
| API base | `http://localhost:3001/api/v1/shuttle` |
| Swagger UI | `http://localhost:3001/api/v1/shuttle/docs` |
| Health | `http://localhost:3001/health` |
| Prometheus metrics | `http://localhost:3001/metrics` |
| Socket.IO | `http://localhost:3001/realtime` |
| MinIO console | `http://localhost:9001` |

Daily trip generation is available through `POST /institution/trips/generate`.

## Environment configuration

The authoritative configuration is `.env.example` together with `src/config/env.schema.ts`. Do not commit real credentials or production secrets.

| Setting | Purpose |
| --- | --- |
| `PORT` | HTTP listen port; use `3001` for the dashboard's default local configuration. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Redis connection settings used by queues and realtime scaling. |
| `MOCK_REDIS` | Enables local development without Redis where supported. Background jobs are not scheduled in mock mode. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Secrets used to sign access and refresh tokens. Set strong, distinct values. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional Firebase Admin credentials for push notifications; without it, push delivery is mocked/disabled. |
| `SENTRY_DSN` | Optional Sentry error reporting DSN. |
| `S3_*` / `MINIO_*` | Object storage endpoint, bucket, and credentials; see the environment schema for exact names. |

Do not use the Compose example credentials outside local development.

## API and realtime contract

- Successful responses use `{ "data": ..., "meta": ... }`.
- Errors use `{ "error": { "code": ..., "message": ..., "details": ... } }`.
- JSON request and response fields use `snake_case`; the server maps them to internal camelCase.
- Swagger is served at `/api/v1/shuttle/docs` and is the interactive reference for endpoints and DTOs.
- Sensitive retryable POST requests support the `Idempotency-Key` header.
- OTP request endpoints are rate-limited; clients should handle throttling and return user-safe errors.
- Socket clients connect to namespace `/realtime` and subscribe to authorized rooms such as `institution:<id>`, `trip:<id>`, `route:<id>`, and `admin:beroya`. Room access is checked against the authenticated user's role and tenant.

## Authentication

The current backend environment schema has the OTP module and OTP routes parked; do not assume the OTP flow described by older frontend notes is available. Authentication endpoints and request shapes are documented in Swagger for the running build. Sign-in uses existing seeded or provisioned accounts; self-service registration is not enabled.

```http
GET /api/v1/shuttle/docs
```

The verification response contains access and refresh tokens. The dashboard refreshes an expired access token and clears the session when the server reports `SESSION_REVOKED`.

Seeded local accounts and demo data vary with the configured seed script. Inspect `prisma/seed.ts` and `prisma/seed-demo.ts` before relying on specific account details. To load additional demo institution data, run:

```bash
npm run prisma:seed:demo
```

Use development seed accounts only in local environments.

## Background worker

The worker processes queued and scheduled tasks separately from the API process. Start it in development with `npm run start:worker:dev`; in production use `npm run start:worker:prod` after building. Redis must be available for real queue processing.

## Production deployment

The repository includes `Dockerfile`, `docker-compose.yml`, and `docker-compose.prod.yml`. The staging helper starts infrastructure, runs migrations, and then starts the API and worker:

```bash
npm run staging:up
```

Before deployment, provide production-grade environment secrets and durable PostgreSQL, Redis, and object-storage services. Ensure migrations complete before serving traffic, expose only intended public ports, configure TLS at the deployment edge, and keep the worker process running independently. The helper is intended for the repository's staging workflow; review both Compose files and the environment schema before adapting it for production.

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with watch mode. |
| `npm run start:worker:dev` | Start the worker with watch mode. |
| `npm run build` | Build the NestJS application (the `prebuild` hook deploys migrations and generates Prisma Client). |
| `npm run start:prod` | Run the compiled API. |
| `npm run start:worker:prod` | Run the compiled worker. |
| `npm run typecheck` | Type-check the backend. |
| `npm test` | Run unit tests. |
| `npm run test:e2e` | Run end-to-end tests. |
| `npm run prisma:migrate` | Create/apply a development migration. |
| `npm run prisma:migrate:deploy` | Apply committed migrations. |
| `npm run prisma:seed` | Run the configured seed. |
| `npm run prisma:studio` | Open Prisma Studio. |

## Repository map

```text
src/
  modules/       Feature modules and domain workflows
  infra/         Database, queue, storage, realtime, and infrastructure adapters
  config/        Environment schema and application configuration
  swagger/       OpenAPI setup and generated contract adjustments
prisma/          Prisma schema, migrations, and seed scripts
scripts/         Verification and contract generation utilities
test/            End-to-end test setup and scenarios
```

## Related application

The web dashboard lives in [`../shuttle_dashboard`](../shuttle_dashboard) and defaults to this API on port `3001`. Set the dashboard's `BACKEND_URL` and `NEXT_PUBLIC_SOCKET_URL` to the API origin when running the services separately.
