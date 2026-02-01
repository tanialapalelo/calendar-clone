# Calendar Clone (MVP)

A portfolio project: a Google Calendar–inspired app built as a TypeScript monorepo with a Next.js web app and a NestJS API.

## Tech

- **Web:** Next.js (App Router) + TypeScript
- **API:** NestJS + Prisma
- **DB:** PostgreSQL (local dev; Docker recommended)
- **Auth:** Google OAuth 2.0 (API-driven redirect) + **HttpOnly cookie** session (JWT)

---

## Repo structure

- `apps/web` — Next.js frontend
- `apps/api` — NestJS backend + Prisma schema/migrations

---

## Local development

### Prerequisites

- Node.js (LTS recommended)
- pnpm
- PostgreSQL running locally (or via Docker)

### Install dependencies

```bash
pnpm install
```

---

## Database

The API uses `DATABASE_URL` (PostgreSQL). You can run Postgres locally or via Docker.

### PostgreSQL via Docker (recommended)

Run Postgres:

```bash
docker run --name calendar-clone-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=calendar_clone \
  -p 5432:5432 \
  -d postgres:16
```

Create a separate **test database** in the same container (used by e2e tests):

```bash
docker exec -it calendar-clone-postgres \
  psql -U postgres -c "CREATE DATABASE calendar_clone_test;"
```

Stop/remove when needed:

```bash
docker stop calendar-clone-postgres
docker rm calendar-clone-postgres
```

---

## Environment variables

> Do not commit real `.env` files. Commit only `.env.*.example` files.

### API — `apps/api/.env` (local dev, do not commit)

Create `apps/api/.env`:

```env
# Server
PORT=3001
WEB_ORIGIN=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/calendar_clone?schema=public

# Auth cookie + JWT
JWT_SECRET=replace-with-a-long-random-string
COOKIE_NAME=access_token

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/v1/auth/google/callback
```

Generate a good JWT secret quickly:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### API tests — `apps/api/.env.test` (do not commit)

Create `apps/api/.env.test` based on `apps/api/.env.test.example`.

This points to the dedicated test DB (`calendar_clone_test`) and uses a test-only `JWT_SECRET`.

### Web — `apps/web/.env.local` (local dev, do not commit)

Create `apps/web/.env.local`:

```env
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Prisma setup (dev DB)

Run migrations + generate client + seed (development database):

```bash
pnpm -C apps/api exec prisma migrate dev
pnpm -C apps/api exec prisma generate
pnpm -C apps/api exec prisma db seed
```

> Note: seeding creates demo user/calendar data for local development.

---

## Run everything (web + api)

From the repo root:

```bash
pnpm dev
```

This runs both apps in parallel using Turborepo.

---

## Run apps individually

### Run the API

```bash
pnpm -C apps/api dev
```

API runs on `http://localhost:3001` (default).

Health checks:

- `GET http://localhost:3001/v1/health`
- `GET http://localhost:3001/v1/db-health`

### Run the web app

```bash
pnpm -C apps/web dev
```

Web runs on `http://localhost:3000`.

---

## Authentication (Google OAuth + HttpOnly Cookie)

This project uses an **API-owned** auth flow (no NextAuth):

1. The web app links the user to the API: `GET /v1/auth/google/start`
2. The API redirects to Google’s consent screen
3. Google redirects back to the API callback with an authorization code
4. The API exchanges the code for tokens, verifies the **Google ID token**, upserts the user, and sets an **HttpOnly cookie** containing a signed JWT
5. The API redirects back to the web app

### Why HttpOnly cookies?

- Tokens are not accessible to JavaScript (mitigates XSS token theft)
- The browser automatically sends the cookie to the API on requests
- The API authenticates requests using a Nest Guard that verifies the JWT and sets `req.user`

### Auth endpoints

- `GET /v1/auth/google/start` — redirect to Google
- `GET /v1/auth/google/callback` — handle Google redirect, set cookie, redirect to web
- `GET /v1/auth/me` — returns the current user (requires auth cookie)
- `POST /v1/auth/logout` — clears the auth cookie

### CORS note (local dev)

Web and API run on different origins (`localhost:3000` and `localhost:3001`), so the API enables CORS with credentials.  
From the web app, requests to the API must use:

```ts
fetch('http://localhost:3001/v1/auth/me', { credentials: 'include' })
```

---

## Google OAuth setup (local)

In Google Cloud Console:

1. Create/select a project
2. Configure **OAuth consent screen**
- Choose “External” (fine for local dev)
- Add your Google account as a **test user** if required
3. Create credentials:
- **APIs & Services → Credentials → Create Credentials → OAuth client ID**
- Application type: **Web application**
4. Configure URLs:

**Authorized redirect URIs**
- `http://localhost:3001/v1/auth/google/callback`

**Authorized JavaScript origins**
- `http://localhost:3000`
- `http://localhost:3001`

---

## Testing

### API e2e tests

E2E tests run against a dedicated database (`calendar_clone_test`) so tests can freely create/delete data without affecting your dev database.

#### One-time setup

1) Ensure Postgres is running and the test database exists:

```bash
docker exec -it calendar-clone-postgres \
  psql -U postgres -c "CREATE DATABASE calendar_clone_test;"
```

2) Create `apps/api/.env.test` based on `apps/api/.env.test.example`

#### Run e2e tests

```bash
pnpm -C apps/api test:e2e
```

This runs:
- `pretest:e2e`: `dotenv -e .env.test -- prisma migrate deploy` (applies migrations to the test DB)
- then `test:e2e`: runs Jest (`*.e2e-spec.ts`)

#### How auth works in tests (no Google)

E2E tests do not call Google OAuth. Instead they:
- create a test user + calendar directly in the test DB (via Prisma)
- generate a signed JWT using `JWT_SECRET` from `.env.test`
- send it as a cookie (`COOKIE_NAME`, default `access_token`)
- call real API endpoints using `supertest`

---
## Milestones / roadmap

### Milestone 1 ✅ — UI prototype
- UI-only calendar prototype (localStorage)

### Milestone 2 ✅ — Backend foundation
- NestJS API + Prisma + Postgres foundation
- Health + db-health endpoints

### Milestone 3 ✅ — Authentication
- Google OAuth login
- HttpOnly cookie session (JWT)
- `/v1/auth/me` protected route using a JWT cookie Guard

### Milestone 4 🚧 — API-backed core calendar/events (data correctness + tests)
- Replace localStorage event data with API-backed events scoped to the authenticated user ✅
- Replace localStorage calendar data with API-backed calendars scoped to the authenticated user 🚧
- Request validation (DTOs) for core endpoints ✅ (create/update events)
- Core error handling (consistent 400/401/403/404) 🚧
- Tests:
  - API e2e tests for events CRUD ✅
  - Auth e2e smoke tests (me/logout) 🚧
  - Unit tests for tricky logic (recurrence/timezone) 🚧
- Docs:
  - README “How to run + test” ✅
  - API endpoint docs / Swagger (optional) 🚧

### Milestone 5 ⏭️ — Google Calendar features (clone direction)
- Recurring events (RRULE + exceptions) + correct all-day/timezone behavior
- Event color (calendar default + optional event override)
- Reminders/notifications (persist config first; delivery later)
- Search (title/description/location) + optional pagination for list/search endpoints

### Milestone 6 ⏭️ — UI polish + layout parity
- Sidebar (mini calendar + calendars list)
- Responsive layout + skeleton/loading states
- Better event editor UX (all-day handling, timezone display)
- Keyboard & accessibility improvements
