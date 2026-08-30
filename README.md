# GradeFlow

AI grading and classroom management for teachers.

Create a classroom, add students, create a test, upload the answer sheets, and GradeFlow
marks every one of them. Marks and attendance collect in one table you can sort, filter
and export.

```text
Create classroom → Add students → Create test → Upload answers → AI grades → Review marks
```

## Getting started

One Next.js app: the pages and the API live together, so there is one thing to
run and one thing to deploy.

You will need Node 20+, a Supabase project and a Gemini API key.

```bash
git clone <your-fork-or-this-repo> gradeflow
cd gradeflow
npm install
cp .env.example .env      # then fill it in
npm run db:push           # create the tables
npm run dev
```

Open <http://localhost:3000> and create an account on `/signup`.

To watch grading run locally, start Inngest's dev server alongside it — it finds
the app on its own:

```bash
npx inngest-cli@latest dev
```

### Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | The app, pages and API together |
| `npm run build` | Production build |
| `npm run db:push` | Apply `prisma/schema.prisma` to the database |
| `npm run db:pull` | Update the schema from the database |
| `npm run db:studio` | Browse the data |

### Environment

Everything lives in one `.env` — see [`.env.example`](.env.example) for the
annotated list. The ones that need explaining:

- **`DATABASE_URL`** — on Vercel this should be Supabase's *Transaction pooler*
  string, not the direct one. Serverless opens a connection per invocation, and
  pgbouncer is what stops that exhausting Postgres. `DIRECT_URL` stays direct;
  Prisma uses it for schema changes only.
- **`JWT_SECRET`** — 32 characters or more. Changing it signs everyone out.
- **`INNGEST_*`** — the grading queue. Not needed locally, where the Inngest dev
  server handles it. Set both in production from app.inngest.com.

### If something goes wrong

- **`Environment is not configured`** — a variable is missing from `.env`; the
  message names it.
- **Sign-in works but nothing loads** — `DATABASE_URL` points somewhere without
  the schema. Run `npm run db:push`.
- **Grading never starts** — no Inngest dev server locally, or the production
  keys are missing. `/api/inngest` is the endpoint it registers.
- **`MODULE_NOT_FOUND` from Next, or a dev server that hangs** — two Next
  processes are sharing one `.next` directory. Never run `next build` while
  `next dev` is running; give the build its own output directory instead:

  ```bash
  NEXT_DIST_DIR=.next-build npm run build
  ```

## The product

The classroom is the central entity. Everything else hangs off it.

```text
Class 10-A
├── Subjects      Mathematics · Physics · Chemistry · English
├── Students      32, each with a generated ID (STU-001…)
├── Tests         a date, and optionally a subject, title and grading note
│   └── Questions the paper the teacher set — optional, with optional answers
├── Submissions   one answer sheet per student per test
└── Attendance    present/absent per student per test
```

### Design decisions worth knowing

- **A test needs a date and nothing else.** Subject, title, total marks, grading
  instructions and the question paper are all optional. There is no model picker and no
  confidence threshold — the grading notes are one free-text field ("give method marks
  when the arithmetic slips", "be strict about units").
- **The question paper is optional, and so are its answers.** Give the AI the questions
  and it marks every sheet against the same ones; give it the answers too and it marks
  against those. Give it neither and it reads the questions off each student's paper, as
  it always did. Nothing here is a rubric builder — questions are typed, or read off a
  photo of the paper.
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
[`lib/auth.ts`](lib/auth.ts) talks to the API and nothing else — there is
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

Defined once in [`app/globals.css`](app/globals.css) and consumed as
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

## Architecture

```text
src/
  app/
    page.tsx                      Landing page
    app/                          The workspace
      layout.tsx                  App shell: top bar, command palette, create flows
      [classroom]/…               Classroom surfaces
    results/[token]/              The read-only page a parent opens
    api/                          The API — same deployment, same origin
      auth/…                      register, login, logout, me
      classrooms/…                classrooms, subjects, students, tests
      tests/[id]/…                questions, attendance, uploads, grade, regrade
      sheets/[id]/…               review a mark, fetch the paper
      share/[token]/              unauthenticated, whitelisted results
      inngest/                    the grading queue's endpoint
  components/
    ui/                           Design-system primitives
    app/                          Workspace components
    landing/                      Product replicas used on the landing page
  lib/
    api.js                        Client for /api
    workspace.js                  Server-backed cache + derived data
    server/
      db.js                       Prisma client, created on first query
      domain.js                   Ownership and the classroom read
      shape.js                    Pure row → payload shaping
      auth.js  storage.js         Sessions; the private answer-sheet bucket
      grader.js  grading.js       Gemini calls; what marking one sheet means
      rate-limit.js               Fixed-window limits, backed by Postgres
      inngest/                    Queue client and functions
  proxy.js                        Origin check on every mutating /api request
prisma/schema.prisma              The database
```

Plain JavaScript throughout — there is no build-time type checking, so the
guardrails that matter live at the edges: zod validates every request body, and
the ownership helpers are the only way a route can resolve an id.

Everything a teacher owns lives in Postgres, reached through Prisma over a
`pg` driver adapter. Supabase is still there for Storage — answer sheets sit in
a private bucket, served only through an ownership check.

`src/lib/workspace.ts` is a cache in front of the API read through
`useSyncExternalStore` — not a source of truth — so clearing browser storage
loses nothing. The session is an http-only cookie; nothing is kept in
`localStorage` at all.

Mutations refresh the cache from what the server returned rather than
refetching, and a test mutation folds its result back into the cached classroom
so the dashboard's progress counts cannot drift from the test page.

### The API

The domain is `classrooms → subjects · students · tests → submissions ·
attendance`.

| Area | Endpoints |
| --- | --- |
| Auth | `/api/auth/register`, `/login`, `/logout`, `/me` |
| Classrooms | CRUD, plus the grade scale |
| Subjects, students | CRUD, bulk import, `POST /api/classrooms/{id}/students/extract` to read a photographed register |
| Tests | CRUD, attendance, `POST /api/tests/{id}/grade`, `/regrade` |
| Question paper | `PUT /api/tests/{id}/questions`, `POST /api/tests/{id}/questions/extract` |
| Answer sheets | Bulk upload with per-page student matching, review, `GET /api/sheets/{id}/file` |
| Sharing | `GET /api/share/{token}` — unauthenticated, whitelisted fields, graded tests only |

Every read and write funnels through an ownership helper in
`src/lib/server/domain.ts`. A route that forgets to call one cannot reach a row,
because nothing else there resolves an id.

A classroom and everything on it comes back in one query rather than five, and
the list endpoint batches instead of repeating that per classroom — which is
what used to make the dashboard take most of a second on an empty account.

Login, signup and register-extraction are rate limited. The counters live in
Postgres because on serverless every invocation is a fresh process, so an
in-memory limiter would reset constantly and protect nothing.

### The question paper

A test can carry the questions the teacher set — written by hand, or read off a
photographed paper. Both are optional: without them the model reads the
questions off each student's own sheet, which is how grading worked before.

Giving it a paper changes two things. Marking becomes consistent across the
class, because every sheet is scored against the same questions and the same
per-question marks rather than whatever the model reads off each page. And the
test's total stops being a number to keep in step by hand — it is the sum of the
question marks.

An expected answer per question is optional again, one level down. Supply one
and the model marks against it while still awarding method marks for a sound
approach that reaches a different form; leave it blank and it marks the work on
its merits. Uploading a marking scheme rather than a bare question paper fills
those in automatically.

### Grading

Marking a class is too slow for one request, and a serverless function dies with
its request, so grading runs on Inngest: `test/grade.requested` claims the
pending sheets and fans out one `test/sheet.grade` per paper. Each job is a
single model call, retried on its own, capped at five at a time so a big class
cannot open thirty at once.

`/api/inngest` is the endpoint. It has no session — Inngest calls it — and
authenticates with a signing key instead.

### Production notes

- Deploy to Vercel; the whole app is one project. `npm run build` runs
  `prisma generate` first.
- Use Supabase's Transaction pooler for `DATABASE_URL`.
- Connect the Inngest app and set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`,
  or nothing will ever be marked.
- Answer sheets have no retention policy yet; they stay in the bucket until the
  classroom, test or student that owns them is deleted.
- Add malware scanning and stricter file validation before processing uploads.
- Add signed download URLs and a retention policy for student work.
