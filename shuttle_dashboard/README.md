<div align="center">

# Beroya On + Dashboard

**Web operations console for Beroya Shuttle** — a bilingual dashboard for Beroya administrators and institution teams to manage transportation operations, monitor trips, and coordinate their fleet.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind_CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss&logoColor=white)
![next-intl](https://img.shields.io/badge/i18n-next--intl-0F766E)

</div>

---

## Product overview

The dashboard provides two role-specific workspaces:

- **Beroya administration** (`/admin`) for platform operations, institutions, subscriptions, fleet management, search, audit history, and scheduled jobs.
- **Institution administration** (`/institution`) for institutional dashboards, live maps, trips, incidents, notifications, routes, branches, meeting points, students, parents, university students, drivers, vehicles, attendants, search, audit history, and settings.

The interface supports Arabic and English, Arabic-first routing, right-to-left layouts, and light and dark themes. Access is limited to authorized `BEROYA_ADMIN` and `INSTITUTION_ADMIN` accounts.

## Technology

| Area | Technology |
| --- | --- |
| Framework | Next.js 16, React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Localization | next-intl, Arabic and English, RTL support |
| Data fetching | TanStack Query |
| Realtime | Socket.IO client |
| Maps | Leaflet |
| Forms and validation | Zod |
| Client state | Zustand |

## Requirements

- Node.js 20.9 or newer (Node.js 22 is recommended to align with the backend).
- npm.
- The [Beroya Shuttle API](../beroya-shuttle) available locally or in a configured environment.

## Run locally

1. Start the backend and its dependencies by following [`../beroya-shuttle/README.md`](../beroya-shuttle/README.md). For the defaults below, the API should listen on `http://localhost:3001`.

2. Create the frontend environment file:

   ```bash
   cp .env.example .env.local
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env.local`.

3. Install packages and start Next.js:

   ```bash
   npm ci
   npm run dev
   ```

4. Open [http://localhost:3005](http://localhost:3005). The root route redirects to the Arabic login page.

The development and production scripts both use port `3005` as configured in `package.json`.

## Sign in

The login screen is present, but the backend currently has its OTP module and OTP routes parked in the environment schema. Confirm the active authentication contract in the running backend's Swagger docs before expecting sign-in to work. Accounts must already be provisioned, and only Beroya or institution administrators can access this dashboard. The backend seed scripts determine which local accounts are available.

## Configuration

Copy `.env.example` to `.env.local`. The Next.js server reads `BACKEND_URL` for its API rewrite. Values prefixed with `NEXT_PUBLIC_` are available to browser code; configure them with that exposure in mind.

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | `Beroya on plus` | Display name for the application. |
| `NEXT_PUBLIC_API_BASE` | `/api/v1/shuttle` | Browser REST base path. Keep relative to use the same-origin Next.js rewrite. |
| `BACKEND_URL` | `http://localhost:3001` | Backend origin used by the rewrite for `/api/v1/shuttle/:path*`. |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:3001` | Socket.IO origin; the app connects to the `/realtime` namespace. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | empty | Optional international phone number for landing-page contact links. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` and related Firebase fields | unset | Optional Firebase web-app configuration for push notifications. |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | empty | Optional Web Push VAPID public key. |

For production, set `BACKEND_URL` and `NEXT_PUBLIC_SOCKET_URL` to the reachable API origin. Keep `NEXT_PUBLIC_API_BASE` relative unless the browser is intentionally configured to call a separate API origin and the backend CORS policy allows it. Never put server secrets in `NEXT_PUBLIC_*` variables.

## Backend integration

| Concern | Implementation |
| --- | --- |
| HTTP client | `src/infrastructure/http/client.ts` attaches session credentials, handles token refresh, unwraps API responses, and maps API errors. |
| API modules | `src/infrastructure/api/*.api.ts` contains typed endpoint functions. |
| Request casing | `src/infrastructure/http/case.ts` converts between frontend camelCase and the backend's `snake_case` JSON contract. |
| Query cache | TanStack Query with centralized keys in `src/infrastructure/api/query-keys.ts`. |
| Realtime | `src/infrastructure/realtime/` joins authorized tenant rooms and invalidates or updates relevant cached data. |
| Uploads | `src/infrastructure/api/uploads.ts` validates files and coordinates presigned upload, transfer, and completion. |
| Localization | `src/i18n/` and `messages/` define Arabic and English navigation and messages. |

The API's Swagger reference is available at `<BACKEND_URL>/api/v1/shuttle/docs` when the backend is running.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server on port `3005`. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build on port `3005`. |
| `npm run lint` | Run ESLint. |

## Production build

```bash
npm ci
npm run build
npm run start
```

Configure the runtime environment before starting the production server. The backend must be reachable from the Next.js server for rewritten API requests, and from clients for Socket.IO if the dashboard is deployed on another origin.

## Project structure

```text
src/
  app/             Next.js routes and global styles
  application/     Use cases and client-side stores
  domain/          Domain models, entities, and repository contracts
  i18n/            Locale routing and message configuration
  infrastructure/  API, HTTP, Firebase, realtime, and environment adapters
  presentation/    Screens, feature components, hooks, and providers
  shared/          Shared utilities, validation, and types
messages/          Arabic and English translation catalogs
public/            Brand assets and static files
```

## Related service

The API and worker are maintained in [`../beroya-shuttle`](../beroya-shuttle). For local development, start the API first, then run this dashboard. The frontend development server uses port `3005`; the backend commonly uses `3001`.
