# Calendar Clone

A portfolio project: a Google Calendar–inspired app built as a TypeScript monorepo with a Next.js web app and a NestJS API.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 |
| Backend | NestJS + Prisma ORM |
| Database | PostgreSQL |
| Auth | Google OAuth 2.0 + HttpOnly cookie (JWT) |
| Monorepo | Turborepo + pnpm workspaces |

---

## Architecture

```
calendar-clone/
├── apps/
│   ├── web/                         # Next.js frontend
│   │   ├── app/                     # App Router pages & layouts
│   │   ├── components/
│   │   │   ├── calendar/            # Calendar-specific components + views
│   │   │   └── ui/                  # Generic reusable UI (SettingsMenu…)
│   │   ├── lib/
│   │   │   ├── api/                 # apiFetch wrapper + per-resource modules
│   │   │   │   ├── client.ts        # Base fetch — throws ApiError on non-2xx
│   │   │   │   └── events.ts        # listEvents / createEvent / updateEvent / deleteEvent
│   │   │   ├── auth/
│   │   │   │   └── useCurrentUser.ts
│   │   │   ├── events/
│   │   │   │   └── useEventsApi.ts  # Events data hook (fetch + optimistic CRUD)
│   │   │   ├── hooks/
│   │   │   │   ├── useCalendarNavigation.ts  # URL ↔ view/date/range state
│   │   │   │   └── usePopoverState.ts        # Event + day popover state
│   │   │   └── theme/
│   │   │       └── useTheme.ts      # Dark / light / system theme (SSR-safe)
│   │   └── types/
│   │       └── global.d.ts          # Shared CalendarEvent / CalendarView types
│   └── api/                         # NestJS backend
│       ├── src/
│       │   ├── auth/                # Google OAuth + JWT guard
│       │   ├── calendars/           # Calendars CRUD (GET/POST/PATCH/DELETE)
│       │   │   └── dto/             # CreateCalendarDto, UpdateCalendarDto
│       │   ├── events/              # Events CRUD + recurrence expansion
│       │   │   └── dto/             # CreateEventDto, UpdateEventDto
│       │   └── prisma/              # PrismaService
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── test/                    # e2e tests (supertest + real DB)
```

### Key architecture decisions

**API-owned OAuth flow**  
The backend owns the entire Google OAuth redirect flow. The frontend never sees tokens — it only receives an HttpOnly cookie containing a signed JWT. This eliminates XSS token-theft risk.

**`apiFetch` throws, not returns `{ok}`**  
The API client (`lib/api/client.ts`) throws an `ApiError` on non-2xx responses instead of returning a `{ ok: boolean }` union. This means callers write `await apiFetch(...)` and `catch(err)` once — no manual `.ok` check at every call site. `ApiError` carries `.status` so 401 detection still works.

**Custom hooks for all stateful logic**  
`CalendarPageClient` is a pure orchestrator — it composes three hooks and renders. No logic lives in the component itself:
- `useCalendarNavigation` — view/date state in URL search params (deep-linkable, back button works)
- `useEventsApi` — events list + CRUD, 401 → redirect
- `usePopoverState` — event popover + day overflow popover

**SSR-safe theme**  
`useTheme` initialises state to `'system'` (matching the inline `<script>` in `layout.tsx`) to avoid hydration mismatches. `useCallback` wraps `setTheme` for a stable reference.

**Thin controllers, fat services**  
Every NestJS controller method is one line — it calls a service method and returns. All business logic (ownership checks, NotFoundException, etc.) lives in the service. `@UseGuards` is applied at the class level so it's never forgotten on a new route.

---

## Repo structure

- `apps/web` — Next.js frontend
- `apps/api` — NestJS backend + Prisma schema/migrations

---

## Local development

### Prerequisites

- Node.js LTS
- pnpm (`npm i -g pnpm`)
- Docker (recommended for PostgreSQL)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL

```bash
docker run --name calendar-clone-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=calendar_clone \
  -p 5432:5432 \
  -d postgres:16
```

Create a separate **test database** (used by e2e tests):

```bash
docker exec -it calendar-clone-postgres \
  psql -U postgres -c "CREATE DATABASE calendar_clone_test;"
```

### 3. Environment variables

> Do not commit `.env` files. Only commit `.env.*.example` files.

**`apps/api/.env`** (local dev):

```env
PORT=3001
WEB_ORIGIN=http://localhost:3000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/calendar_clone?schema=public

JWT_SECRET=replace-with-a-long-random-string
COOKIE_NAME=access_token

GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/v1/auth/google/callback
```

Generate a secure `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**`apps/api/.env.test`** (e2e tests — do not commit):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/calendar_clone_test?schema=public
JWT_SECRET=test-secret
COOKIE_NAME=access_token
```

**`apps/web/.env.local`** (local dev):

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Run Prisma migrations + seed

```bash
pnpm -C apps/api exec prisma migrate dev
pnpm -C apps/api exec prisma generate
pnpm -C apps/api exec prisma db seed
```

### 5. Start both apps

```bash
pnpm dev
```

- Web → `http://localhost:3000`
- API → `http://localhost:3001`
- API health: `GET /v1/health` · `GET /v1/db-health`

---

## Authentication

### Flow

1. User clicks "Sign in with Google" → browser navigates to `GET /v1/auth/google/start`
2. API redirects to Google's consent screen
3. Google redirects to `GET /v1/auth/google/callback?code=…`
4. API exchanges code → verifies ID token → upserts user → sets **HttpOnly JWT cookie**
5. API redirects back to the web app (`WEB_ORIGIN`)

### Why HttpOnly cookies?

- Tokens are not accessible to JavaScript — eliminates XSS token theft
- Browser sends the cookie automatically on every API request
- The `JwtCookieGuard` validates the JWT and sets `req.user` on every protected route

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/auth/google/start` | No | Redirect to Google |
| `GET` | `/v1/auth/google/callback` | No | Handle Google callback, set cookie |
| `GET` | `/v1/auth/me` | Required | Return current user |
| `POST` | `/v1/auth/logout` | No | Clear cookie |

---

## API reference

### Calendars

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/calendars` | List all calendars for current user |
| `GET` | `/v1/calendars/:id` | Get a single calendar |
| `POST` | `/v1/calendars` | Create a calendar `{ name, color? }` |
| `PATCH` | `/v1/calendars/:id` | Rename / recolor `{ name?, color? }` |
| `DELETE` | `/v1/calendars/:id` | Delete calendar + all its events |

### Events

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/events?from=&to=` | List events in date range (required) |
| `GET` | `/v1/events/search?q=` | Full-text search across title, description, location |
| `GET` | `/v1/events/:id` | Get a single event |
| `POST` | `/v1/events` | Create an event |
| `PATCH` | `/v1/events/:id?scope=` | Update event (`scope`: `this`/`following`/`all`) |
| `DELETE` | `/v1/events/:id?scope=` | Delete event (`scope`: `this`/`following`/`all`) |

All routes require the auth cookie.

---

## Google OAuth setup (local)

1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Create / select a project
3. **APIs & Services → OAuth consent screen** — choose "External", add yourself as a test user
4. **APIs & Services → Credentials → Create OAuth client ID** (Web application)
5. **Authorised redirect URIs:** `http://localhost:3001/v1/auth/google/callback`
6. **Authorised JavaScript origins:** `http://localhost:3000`, `http://localhost:3001`
7. Copy Client ID + Secret into `apps/api/.env`

---

## Testing

### e2e tests (API)

```bash
pnpm -C apps/api test:e2e
```

`pretest:e2e` runs `prisma migrate deploy` against the test DB automatically.

### How auth works in tests (no Google)

- Test user + calendar created directly via Prisma
- JWT signed with `JWT_SECRET` from `.env.test`
- Sent as a cookie in `supertest` requests
- The real `JwtCookieGuard` validates it — tests exercise actual HTTP handlers end-to-end

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `t` | Go to today |
| `d` | Day view |
| `w` | Week view |
| `m` | Month view |
| `y` | Year view |
| `c` | Create new event |
| `←` / `p` / `k` | Previous period |
| `→` / `n` / `j` | Next period |

---

## Production deployment

### Docker Compose (all-in-one)

```bash
cp apps/api/.env.example .env.prod
# Fill in JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, etc.
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Services:
- `db` — PostgreSQL 16
- `api` — NestJS API on port 3001
- `web` — Next.js on port 3000

### API documentation (dev only)

Swagger UI available at `http://localhost:3001/v1/docs` when `NODE_ENV != production`.

---

## Milestones

### ✅ Milestone 1 — UI prototype
- Calendar UI: month / week / day / year views
- Sidebar with mini-calendar + calendar visibility toggles
- Dark mode (light / dark / system) persisted to localStorage
- Settings menu with appearance + export/import
- Responsive layout with collapsible sidebar (hamburger toggle)

### ✅ Milestone 2 — Backend foundation
- NestJS + Prisma + PostgreSQL
- `GET /v1/health` + `GET /v1/db-health`
- Docker Compose for local Postgres

### ✅ Milestone 3 — Authentication
- Google OAuth 2.0 (API-owned flow)
- HttpOnly cookie session (JWT)
- `JwtCookieGuard` protecting all private routes

### ✅ Milestone 4 — API-backed core data
- Events + Calendars CRUD with DTOs and validation
- URL-driven view/date navigation (deep-linkable, back button works)
- e2e tests: events CRUD + auth smoke tests

### ✅ Milestone 5 — Google Calendar feature parity
- Recurring events with RRULE + per-instance exceptions (`this` / `following` / `all`)
- Correct all-day / timezone handling
- Event colour: per-calendar default + per-event override
- Reminders / notifications editor
- Custom recurrence rule builder dialog

### ✅ Milestone 6 — Polish & FAANG-portfolio level
- **Calendar visibility filtering** — unchecking a calendar hides its events live
- **Calendar management UI** — create, rename, recolor, delete calendars from sidebar
- **Full-text event search** — debounced search bar in header with dropdown results
- **Keyboard shortcuts** — `t/d/w/m/y/c/←/→` (matches Google Calendar)
- **Google-style ViewSwitcher** — pill tab bar replacing native `<select>`
- **Event Page Shell** — proper header with back-arrow on `/events/new` and `/events/edit/[id]`
- **Toast notifications** — success/error/info feedback on all CRUD operations
- **Security hardening** — `helmet` headers, rate limiting (120 req/min), production-secure cookies
- **API documentation** — Swagger UI at `/v1/docs` (dev only)
- **Docker production setup** — multi-stage Dockerfiles + `docker-compose.prod.yml`
- **Next.js standalone output** — minimal self-contained production server
