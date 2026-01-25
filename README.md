# Calendar Clone (MVP)

A portfolio project: a Google Calendar–inspired app built as a TypeScript monorepo with a Next.js web app and a NestJS API.

## Tech

- **Web:** Next.js (App Router) + TypeScript (+ Tailwind planned)
- **API:** NestJS + Prisma
- **DB:** PostgreSQL (local dev)
- **Auth (current):** Google OAuth 2.0 (API-driven redirect) + **HttpOnly cookie** session (JWT)

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

### Database

The API uses `DATABASE_URL` (PostgreSQL). Ensure Postgres is running and reachable, then set:

- `apps/api/.env` → `DATABASE_URL=...`

Then run Prisma:

```bash
pnpm -C apps/api exec prisma migrate dev
pnpm -C apps/api exec prisma generate
pnpm -C apps/api exec prisma db seed
```

> Note: seeding creates a demo user and calendar data for local development.

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

## Environment variables

### API — `apps/api/.env`

```env
# Server
PORT=3001
WEB_ORIGIN=http://localhost:3000

# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public

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

### Web — `apps/web/.env.local`

```env
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> Do not commit `.env` files. Use `.env.example` files or this README as reference.

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

## Milestones / roadmap

### Milestone 1 (done / in progress)
- UI-only calendar prototype (localStorage)

### Milestone 2 (done / in progress)
- NestJS API + Prisma + Postgres foundation

### Milestone 3 (current)
- Google OAuth login
- HttpOnly cookie session
- `/v1/auth/me` protected route using a JWT cookie Guard

### Next
- Replace localStorage calendar data with API-backed calendars/events scoped to `req.user.sub`
- Add request validation (DTOs), error handling, and better API docs
- Add tests (unit + e2e) for auth and core endpoints
- UI polish (login state in header, loading states, responsive layout)
