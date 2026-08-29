# GradeFlow

AI grading and classroom management for teachers.

Create a classroom, add students, create a test, upload the answer sheets, and GradeFlow
marks every one of them. Marks and attendance collect in one table you can sort, filter
and export.

```text
Create classroom → Add students → Create test → Upload answers → AI grades → Review marks
```

## Getting started

There are two ways to run this, depending on whether you want the AI grading server.

| | What you get | What you need |
| --- | --- | --- |
| **A — app only** | The full interface. Accounts and your workspace live in the browser. Grading is simulated locally. | Node 20+ |
| **B — full stack** | Real accounts and real Gemini grading, backed by Postgres. | Everything in A, plus Python 3.11–3.13, `psql`, a Supabase project and a Gemini API key |

Start with A. It runs in two commands and needs no accounts anywhere.

### A — app only

```bash
git clone <your-fork-or-this-repo> gradeflow
cd gradeflow/frontend
npm install
npm run dev
```

Open <http://localhost:3000>, create an account on `/signup`, and you are in. The account
and everything you create are stored in that browser — see [Accounts](#accounts) for what
that does and does not mean.

### B — full stack

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
  `API_URL` set but the API is not running. Start it with `make backend`, or
  comment the variable out to go back to browser-local accounts.
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

Every workspace belongs to a signed-in teacher. [`frontend/lib/auth.ts`](frontend/lib/auth.ts)
has two backends behind one interface:

| Mode | When | What happens |
| --- | --- | --- |
| `api` | `API_URL` is set | Real accounts against the FastAPI service — bcrypt hashing, JWT in an http-only cookie, Bearer fallback for preview deployments |
| `local` | no API configured | Accounts live in this browser so the product runs with no server. Passwords are PBKDF2-hashed rather than stored, but this is **not** a security boundary — it exists so the app can be run and demonstrated |

`/app` and everything under it redirect to `/signin` without a session. A new account starts
with an empty workspace and one call to action: create your first classroom.

Sessions persist until the teacher signs out. The http-only cookie is the primary session;
the JWT is mirrored into `localStorage` (not `sessionStorage`) so closing the tab does not
sign anyone out.

Workspace data is stored per account under `gradeflow.workspace.v2:<userId>`, so two accounts
in the same browser never see each other's classrooms.

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
  components/
    ui/                           Design-system primitives (buttons, fields, overlays…)
    app/                          Workspace components
    landing/                      Product replicas used on the landing page
  lib/
    types.ts                      Domain model
    store.ts                      Workspace store + derived data
    ai.ts                         The AI seam (matching, extraction, grading)
                                  plus the deterministic stand-in for the model
    parse.ts                      Roster parsing (paste / CSV / TSV)
```

The store is a small vanilla store read through `useSyncExternalStore` and persisted to
`localStorage`. Long-running work (grading a batch) lives in the store rather than in a
component, so a teacher can start grading and navigate away while it finishes.

Landing-page mockups are built from the same design tokens as the real product rather than
being screenshots, so they stay honest and stay crisp at any size.

### The AI seam

The three AI operations all go through [`frontend/lib/ai.ts`](frontend/lib/ai.ts):

| Call | What it does | Without a grading server |
| --- | --- | --- |
| `matchFilesToStudents` | Assigns uploaded sheets to students | Real heuristics on filename (ID, roll number, name); anything left over falls back to roster order |
| `extractRoster` | Reads a student list out of a file | Real parsing for CSV/TSV/TXT; a stand-in extraction for images and PDFs |
| `gradeSubmission` | Marks one answer sheet | Deterministic simulated marking with per-question feedback, seeded so a submission always returns the same marks |

That file is the only place to change when pointing the app at a live backend.

## Backend

`backend/` holds the original FastAPI service: Supabase Postgres and private Storage,
custom JWT auth, Gemini multimodal extraction and grading, and a LangGraph grading workflow.
See [`backend/supabase/schema.sql`](backend/supabase/schema.sql) and `backend/app/`.

**Auth is already wired up.** `/auth/register`, `/auth/login`, `/auth/logout` and `/auth/me`
back the sign-in and sign-up screens whenever `API_URL` is set.

**The rest has not been migrated to the redesigned domain model yet.** It still models
`classes → assignments (answer_key, rubric, total_points) → submissions`, so classrooms,
tests and marks are still held client-side. Moving them onto the server needs:

- `subjects` (classroom-scoped) and `attendance` (test × student) tables
- `assignments` → `tests`: a required `date`, optional `subject_id`/`title`, free-text
  `instructions` replacing `answer_key`/`rubric`, and the three-state status
- `students`: a stable display `code` (`STU-001`) and `roll_no`
- Endpoints for bulk student import, bulk answer upload with AI student matching, and
  attendance
- A grading prompt driven by the test's free-text instructions rather than a structured
  rubric

See [Getting started, option B](#b--full-stack) for how to set it up.

### Production notes for the backend

- Deploy with Python 3.11+; install from `backend/pyproject.toml`.
- Set `FRONTEND_ORIGIN` (or `FRONTEND_ORIGINS`) to the exact production origins, and use
  `COOKIE_SECURE=true` with `COOKIE_SAMESITE=none` for cross-site cookies.
- Grading currently runs in FastAPI background tasks. Move it to a durable worker or queue
  before large batches or multiple API replicas.
- Add malware scanning and stricter file validation before processing uploads.
- Add signed download URLs and a retention policy for student work.
