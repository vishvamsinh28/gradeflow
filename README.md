# GradeFlow

AI grading and classroom management for teachers.

Create a classroom, add students, create a test, upload the answer sheets, and GradeFlow
marks every one of them. Marks and attendance collect in one table you can sort, filter
and export.

```text
Create classroom → Add students → Create test → Upload answers → AI grades → Review marks
```

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
| `api` | `NEXT_PUBLIC_API_URL` is set | Real accounts against the FastAPI service — bcrypt hashing, JWT in an http-only cookie, Bearer fallback for preview deployments |
| `local` | no API configured | Accounts live in this browser so the product runs with no server. Passwords are PBKDF2-hashed rather than stored, but this is **not** a security boundary — it exists so the app can be run and demonstrated |

`/app` and everything under it redirect to `/signin` without a session. A new account starts
with an empty workspace and is offered either "create your first classroom" or "explore with
sample data"; the sample workspace is never loaded behind your back.

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
    seed.ts                       Deterministic sample data
    parse.ts                      Roster parsing (paste / CSV / TSV)
```

The store is a small vanilla store read through `useSyncExternalStore` and persisted to
`localStorage`. Long-running work (grading a batch) lives in the store rather than in a
component, so a teacher can start grading and navigate away while it finishes.

Landing-page mockups are built from the same design tokens as the real product rather than
being screenshots, so they stay honest and stay crisp at any size.

### Sample workspace

This build ships as a **self-contained sample workspace**: three classrooms, 78 students
and eight tests of realistic seeded data, generated deterministically so the server and the
client render the same thing. Everything is editable, and *Reset sample data* in the
account menu restores it.

The three AI operations all go through [`frontend/lib/ai.ts`](frontend/lib/ai.ts):

| Call | What it does | In the sample workspace |
| --- | --- | --- |
| `matchFilesToStudents` | Assigns uploaded sheets to students | Real heuristics on filename (ID, roll number, name); anything left over falls back to roster order |
| `extractRoster` | Reads a student list out of a file | Real parsing for CSV/TSV/TXT; a stand-in extraction for images and PDFs |
| `gradeSubmission` | Marks one answer sheet | Deterministic simulated marking with per-question feedback |

That file is the only place to change when pointing the app at a live backend.

## Running it

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

The app runs at `http://localhost:3000`. With no `NEXT_PUBLIC_API_URL` set, accounts and the
workspace are browser-local and nothing else needs to be running.

> Two Next processes must never share one `.next` directory — the second one will start
> throwing `MODULE_NOT_FOUND` and eventually hang. To build while a dev server is running,
> give the build its own output directory:
>
> ```bash
> NEXT_DIST_DIR=.next-build npm --prefix frontend run build
> ```

## Backend

`backend/` holds the original FastAPI service: Supabase Postgres and private Storage,
custom JWT auth, Gemini multimodal extraction and grading, and a LangGraph workflow with
LangSmith tracing. See [`backend/supabase/schema.sql`](backend/supabase/schema.sql) and
`backend/app/`.

**Auth is already wired up.** `/auth/register`, `/auth/login`, `/auth/logout` and `/auth/me`
back the sign-in and sign-up screens whenever `NEXT_PUBLIC_API_URL` is set.

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

Setup for the existing service is unchanged: `./setup.sh`, fill in `backend/.env`,
`make db-setup`, then `./start.sh`.

### Production notes for the backend

- Deploy with Python 3.11+; install from `backend/pyproject.toml`.
- Set `FRONTEND_ORIGIN` (or `FRONTEND_ORIGINS`) to the exact production origins, and use
  `COOKIE_SECURE=true` with `COOKIE_SAMESITE=none` for cross-site cookies.
- Grading currently runs in FastAPI background tasks. Move it to a durable worker or queue
  before large batches or multiple API replicas.
- Add malware scanning and stricter file validation before processing uploads.
- Add signed download URLs and a retention policy for student work.
