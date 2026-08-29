# GradeFlow

AI grading and classroom management for teachers.

Create a classroom, add students, create a test, upload the answer sheets, and GradeFlow
marks every one of them. Marks and attendance collect in one table you can sort, filter
and export.

```text
Create classroom → Add students → Create test → Upload answers → AI grades → Review marks
```

## Getting started

GradeFlow is a frontend and an API. Everything a teacher owns lives in Postgres, so the
API is not optional — without `API_URL` the app renders but nothing can be saved.

You will need Node 20+, Python 3.11–3.13, `psql`, a Supabase project and a Gemini API key.

### Setting it up

**1. Install everything.** From the repo root:

```bash
./setup.sh
```

That creates `backend/.venv`, installs both dependency sets, and writes `backend/.env`
with a freshly generated `JWT_SECRET`. It is safe to re-run; it never overwrites an
existing `.env`.

**2. Fill in `backend/.env`.** `setup.sh` leaves four values as placeholders:

| Key | Where it comes from |
| --- | --- |
| `SUPABASE_URL` | Supabase → Project Settings → Data API |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → **service role**. Server-only; never expose it to the browser |
| `DB_URL` | Supabase → Project Settings → Database → Connection string (URI). Used only to apply the schema |
| `GEMINI_API_KEY` | <https://aistudio.google.com/apikey> |

`GEMINI_MODEL` sets the one model used for both extraction and grading. It has a working
default, so you only need to touch it to switch models — there is no per-teacher model
choice and no model picker in the UI.

**3. Create the database tables.**

```bash
make db-setup
```

This runs `backend/supabase/schema.sql` and the migrations through `psql`, so you need the
PostgreSQL client tools installed (`brew install libpq` on macOS, `apt install
postgresql-client` on Debian/Ubuntu).

**4. Point the frontend at the API.** Set it in `frontend/.env.local`:

```env
API_URL=http://localhost:8000/api/v1
```

**5. Run both services.**

```bash
./start.sh
```

Frontend on <http://localhost:3000>, API on <http://localhost:8000>. `Ctrl+C` stops both.

### Everyday commands

| Command | What it does |
| --- | --- |
| `./start.sh` | Both services together |
| `make frontend` | Frontend only |
| `make backend` | API only |
| `make test` | Backend tests |
| `make lint` | Ruff over the backend |
| `make build` | Production build of the frontend |

### If something goes wrong

- **`Cannot reach the GradeFlow server` on sign-in** — the frontend has
  `API_URL` set but the API is not running. Start it with `make backend`.
- **`No API is configured`** — `API_URL` is unset in `frontend/.env`. The app needs it;
  there is no offline mode.
- **`Supabase schema is not ready`** — the tables do not exist yet. Run `make db-setup`,
  wait a few seconds for Supabase's schema cache, and retry.
- **`MODULE_NOT_FOUND` from Next, or a dev server that hangs** — two Next processes are
  sharing one `.next` directory. Never run `next build` while `next dev` is running; give
  the build its own output directory instead:

  ```bash
  NEXT_DIST_DIR=.next-build npm --prefix frontend run build
  ```

- **`Python 3.11+ is required`** — `setup.sh` could not find a suitable interpreter.
  Install Python 3.11, 3.12 or 3.13 and run it again.

## The product

The classroom is the central entity. Everything else hangs off it.

```text
Class 10-A
├── Subjects      Mathematics · Physics · Chemistry · English
├── Students      32, each with a generated ID (STU-001…)
├── Tests         a date, and optionally a subject, title and grading note
├── Submissions   one answer sheet per student per test
└── Attendance    present/absent per student per test
```

### Design decisions worth knowing

- **A test needs a date and nothing else.** Subject, title, total marks and grading
  instructions are all optional. There is no rubric builder, no answer key editor, no
  model picker, no confidence threshold — the grading notes are one free-text field
  ("give method marks when the arithmetic slips", "be strict about units").
- **Tests have three states**: `collecting` → `grading` → `graded`. No draft/publish step.
- **Attendance is tied to a test**, not to a day. An absent student is never asked for an
  answer sheet and never drags down an average.
- **Subjects are just names.** They live inline on the classroom overview rather than
  getting a page of their own.
- **Grading starts by itself** once answers are uploaded. Progress is shown per student,
  and it keeps running if the teacher navigates away.

## Screens

| Route | What it is |
| --- | --- |
| `/` | Landing page |
| `/signin`, `/signup` | Accounts |
| `/app` | Dashboard — classroom cards, plus the work that actually needs you |
| `/app/[classroom]` | Overview — stats, tests, subjects, students |
| `/app/[classroom]/students` | Roster with search, sorting and a per-student record |
| `/app/[classroom]/tests` | All tests, filtered by status and subject |
| `/app/[classroom]/tests/[testId]` | The core screen: attendance, uploads, grading, results |
| `/app/[classroom]/marks` | The marks table — sort, filter, search, export |

`⌘K` opens a command palette that searches classrooms, tests and students. `c` creates a
classroom, `t` creates a test, `/` opens search.

## Accounts

Every workspace belongs to a signed-in teacher.
[`frontend/lib/auth.ts`](frontend/lib/auth.ts) talks to the API and nothing else — there is
no local fallback. Accounts are bcrypt-hashed server-side, with the JWT in an http-only
cookie and a Bearer fallback for preview deployments where a cross-origin cookie cannot be
read back.

`/app` and everything under it redirect to `/signin` without a session. A new account starts
with an empty workspace and one call to action: create your first classroom.

Sessions persist until the teacher signs out. The http-only cookie is the primary session;
the JWT is mirrored into `localStorage` (not `sessionStorage`) so closing the tab does not
sign anyone out. That token is the only thing the app keeps in browser storage — classrooms,
students, tests and marks are read from Postgres on demand, so clearing site data costs you
the session and nothing else.

## Design system

Defined once in [`frontend/app/globals.css`](frontend/app/globals.css) and consumed as
Tailwind v4 utilities.

**One theme: a cool navy night.** The neutrals are derived from the same family as the
star-field sections, so a night band and the page around it are the same material rather
than two darks that happen to sit beside each other. `--night-edge` resolves to the page
background, which is why those bands fade out instead of butting against an edge.

- Navy-black page, lifted navy surfaces, hairline borders
- A single evergreen accent that also carries "graded" and "correct"
- Amber for "needs review", coral for "absent"
- Instrument Serif for display type, Instrument Sans for UI, IBM Plex Mono with tabular
  figures for every number
- Restrained radii (5–14px), soft shadows, no gradients outside the night sections

Nothing in the app names a hex value. Solid fills carry their own foreground token
(`--accent-on`, `--danger-on`), and shared class constants never set a colour a caller might
need to override — both are how white-on-white buttons and silently-ignored mark colours got
in the first time.

Base styles live inside `@layer base` so utility classes still win on elements like
`<button>`. `@source` globs are listed explicitly because they resolve relative to the CSS
file, not the project root.

## Frontend architecture

```text
frontend/
  app/
    page.tsx                      Landing page
    app/                          The workspace (client-rendered)
      layout.tsx                  App shell: top bar, command palette, create flows
      [classroom]/…               Classroom surfaces
    results/[token]/              The read-only page a parent opens
  components/
    ui/                           Design-system primitives (buttons, fields, overlays…)
    app/                          Workspace components
    landing/                      Product replicas used on the landing page
  lib/
    types.ts                      Domain model
    api.ts                        Typed client for the FastAPI service
    workspace.ts                  Server-backed cache + derived data
    parse.ts                      Roster parsing (paste / CSV / TSV)
    runtime-config.ts             Resolves `API_URL` at runtime, not build time
```

Everything a teacher owns lives in Postgres. `workspace.ts` is a cache in front of the API
read through `useSyncExternalStore` — not a source of truth — so clearing browser storage
loses nothing but the session. The only thing in `localStorage` is the auth token.

Mutations refresh the cache from what the server returned rather than refetching, and a
test mutation folds its result back into the cached classroom so the dashboard's progress
counts cannot drift from the test page.

Landing-page mockups are built from the same design tokens as the real product rather than
being screenshots, so they stay honest and stay crisp at any size.

## Backend

`backend/` holds the FastAPI service: Supabase Postgres and private Storage, custom JWT
auth, and Gemini multimodal grading. See
[`backend/supabase/schema.sql`](backend/supabase/schema.sql), the migrations beside it,
and `backend/app/`.

The domain is `classrooms → subjects · students · tests → submissions · attendance`.

| Area | Endpoints |
| --- | --- |
| Auth | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me` |
| Classrooms | CRUD, plus the grade scale |
| Subjects, students | CRUD, bulk import, `POST /classrooms/{id}/students/extract` to read a photographed register |
| Tests | CRUD, attendance, `POST /tests/{id}/grade`, `POST /tests/{id}/regrade` |
| Answer sheets | Bulk upload with per-page student matching, review, `GET /sheets/{id}/file` |
| Sharing | `GET /share/{token}` — unauthenticated, whitelisted fields, graded tests only |

The service role key bypasses RLS, so every query is scoped by owner in the router. Sheets
live in a private bucket and are served only through an ownership check.

### Production notes for the backend

- Deploy with Python 3.11+; install from `backend/pyproject.toml`.
- Set `FRONTEND_ORIGIN` (or `FRONTEND_ORIGINS`) to the exact production origins, and use
  `COOKIE_SECURE=true` with `COOKIE_SAMESITE=none` for cross-site cookies.
- Grading currently runs in FastAPI background tasks. Move it to a durable worker or queue
  before large batches or multiple API replicas.
- Add malware scanning and stricter file validation before processing uploads.
- Add signed download URLs and a retention policy for student work.
