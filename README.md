# GradeFlow

GradeFlow is an AI grading workspace for handwritten or typed worksheet submissions. Teachers create classes, build structured answer keys and rubrics, batch-upload student work, run a LangGraph grading workflow with Gemini, review uncertain results, revise rubrics, regrade submissions, return results through student links, and keep an audit trail of grading decisions. LangSmith tracing is required for workflow observability.

## Stack

- Next.js + TypeScript frontend
- FastAPI backend
- Supabase Postgres and private Storage
- Custom bcrypt password hashing and JWT HTTP-only cookies
- Gemini multimodal extraction and grading
- LangGraph workflow orchestration
- LangSmith tracing/observability

## Product workflows

1. Register and sign in as a teacher.
2. Create classes and add students.
3. Configure teacher settings for Gemini model, confidence threshold, and default grading rules.
4. Create assignments with a structured question builder, answer key, and rubric.
5. Batch-upload worksheet images or PDFs and assign submissions by student name.
6. Run grading, inspect extraction evidence, question-level scores, feedback, confidence, and review status.
7. Resolve low-confidence work from the cross-class review queue.
8. Edit rubrics, save assignment versions, and regrade all existing submissions when criteria change.
9. Approve or override final scores and return completed results to student portal links.
10. Review audit logs for settings changes, grading runs, approvals, overrides, returns, deletes, and regrades.

## Project structure

```text
gradeflow/
  backend/       FastAPI API, Gemini service, LangGraph workflow
    supabase/    SQL schema and private Storage bucket setup
  frontend/      Next.js App Router dashboard
  setup.sh       macOS/Linux dependency and environment setup
  start.sh       macOS/Linux frontend + backend development launcher
```

## Quick start

Requirements:

- Python 3.11 or newer
- Node.js 20 or newer
- npm
- A Supabase project and Gemini API key

```bash
chmod +x setup.sh start.sh
./setup.sh
```

Fill in `backend/.env`, apply the Supabase schema, and then start both services:

```bash
make db-setup
./start.sh
```

The frontend runs at `http://localhost:3000` and FastAPI runs at `http://localhost:8000`. Press `Ctrl+C` in the launcher terminal to stop both.

The setup script is safe to run again: it keeps existing `.env` files, creates missing local environment files, generates a secure JWT secret on first setup, and skips the frontend install when `node_modules` is already healthy.

## 1. Configure Supabase

Create a Supabase project, then apply the schema from your terminal:

```bash
make db-setup
```

The script reads `DB_URL` from `backend/.env` and runs `backend/supabase/schema.sql` through `psql`.

The backend uses `SUPABASE_SECRET_KEY` for server-side Supabase API access and `DB_URL` only for direct database setup. Use a server-only Supabase service role or secret key here; never expose this key in frontend environment variables or browser code.

## 2. Environment configuration

`./setup.sh` creates these local files when they do not already exist:

- `backend/.env` from `backend/.env.example`
- `frontend/.env.local` from `frontend/.env.example`

Edit `backend/.env` with your Supabase, Gemini, JWT, and LangSmith values. The frontend example already points to the local FastAPI server. If you already have `frontend/.env`, the setup and start scripts keep using it instead of creating a duplicate frontend env file.

For Supabase, copy the project URL and a server-only service role/secret key into `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-server-only-service-role-or-secret-key
```

Registration and dashboard writes go through FastAPI, which enforces ownership checks before querying Supabase. The secret key is needed because this project uses custom JWT cookies rather than Supabase Auth, so Supabase row-level security cannot identify the current app user from the publishable key.

## 3. Start development servers

Use the root launcher to run the backend and frontend together:

```bash
./start.sh
```

You can still run the services independently with `make backend` and `make frontend` on macOS/Linux.

## Troubleshooting

If registration or login returns `Supabase schema is not ready`, run:

```bash
make db-setup
```

That error means the backend can reach Supabase, but PostgREST cannot find the app tables such as `public.users`. After running the SQL, wait a few seconds for Supabase's schema cache to refresh and retry.

## LangSmith

LangSmith tracing is required. Set these variables in the backend environment:

```env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=...
LANGSMITH_PROJECT=gradeflow-dev
```

The backend validates these on startup and rejects `LANGSMITH_TRACING=false`. LangGraph executions appear as traces. The graph deliberately keeps raw worksheet bytes out of graph state so uploaded student work is not copied into node state traces.

## Grading graph

```text
load_context
   ↓
extract_work (Gemini vision/document understanding)
   ↓
grade_work (Gemini structured JSON)
   ↓
calculate_confidence
   ├── confidence below threshold → mark_for_review
   └── confidence acceptable      → generate_summary
   ↓
persist_result
```

## Assignment builder

Teachers build assignments from the UI instead of typing JSON. Each question captures:

- question number and prompt
- expected answer
- max score
- scoring criteria
- common mistakes

GradeFlow stores that structured answer key/rubric as JSONB internally, snapshots versions on edit, and can regrade existing submissions against the latest version.

## Student result links

Each student has a private portal token. Teachers can copy a returned-results link from the class roster. The public results page only shows assignments marked `returned`; drafts, active grading work, archived assignments, and pending review items are hidden.

## Audit and version history

GradeFlow writes audit events for important teacher and system actions:

- settings updates
- assignment edits, status changes, duplicates, returns, regrades, and deletes
- submission uploads, grading runs, approvals, teacher reviews, and deletes

Assignment edits also create `assignment_versions` rows so rubric changes are traceable before regrading.

## Production notes

- If the frontend and API are on different domains, set `FRONTEND_ORIGIN` to the exact frontend URL, set `COOKIE_SECURE=true`, and set `COOKIE_SAMESITE=none` so browser `credentials: "include"` requests can carry the HTTP-only session cookie over HTTPS.
- If the frontend and API are under the same site, such as `app.example.com` and `api.example.com`, `COOKIE_SAMESITE=lax` can be used with `COOKIE_SECURE=true`.
- Keep the state-changing endpoint Origin checks enabled. Add per-request CSRF tokens if you need stronger browser-side request forgery protection.
- Replace synchronous grading with a worker/queue for larger batches.
- Add malware scanning and stricter file validation before processing uploads.
- Add signed download URLs and retention/deletion policies for student work.
- Build a LangSmith evaluation dataset from teacher-approved grading examples before allowing automatic grade release.
- Add role-based access if schools need co-teachers, department leads, or admin review.
