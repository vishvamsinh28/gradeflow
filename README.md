# GradeFlow

GradeFlow is a portfolio-grade MVP for grading handwritten or typed mathematics worksheets. Teachers create classes and assignments, upload student work, and run a LangGraph workflow that uses Gemini to extract work, grade it against an answer key/rubric, estimate confidence, and route uncertain results to human review. LangSmith tracing works through the standard tracing environment variables.

## Stack

- Next.js + TypeScript frontend
- FastAPI backend
- Supabase Postgres and private Storage
- Custom bcrypt password hashing and JWT HTTP-only cookies
- Gemini multimodal extraction and grading
- LangGraph workflow orchestration
- LangSmith tracing/observability

## Included MVP flows

1. Register and sign in as a teacher.
2. Create classes and add students.
3. Create an assignment with a JSON answer key and rubric.
4. Upload an image or PDF for a student.
5. Run the grading graph.
6. Inspect per-question scores, feedback, confidence, and review status.
7. View assignment-level analytics.
8. Override the final score and mark a submission reviewed.

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

Edit `backend/.env` with your Supabase, Gemini, JWT, and optional LangSmith values. The frontend example already points to the local FastAPI server. If you already have `frontend/.env`, the setup and start scripts keep using it instead of creating a duplicate frontend env file.

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

Set these variables in the backend environment:

```env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=...
LANGSMITH_PROJECT=gradeflow-dev
```

LangGraph executions will then appear as traces. The graph deliberately keeps raw worksheet bytes out of graph state so uploaded student work is not copied into node state traces.

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

## Answer-key example

```json
{
  "questions": [
    {
      "number": "1",
      "prompt": "Solve 2x + 3 = 11",
      "expected_answer": "x = 4",
      "max_score": 5
    }
  ]
}
```

## Rubric example

```json
{
  "general_rules": [
    "Award method marks when the approach is correct.",
    "Do not penalize the same arithmetic slip twice."
  ],
  "questions": {
    "1": {
      "criteria": [
        {"description": "Subtracts 3 from both sides", "points": 2},
        {"description": "Divides both sides by 2", "points": 2},
        {"description": "States x = 4", "points": 1}
      ]
    }
  }
}
```

## Production notes

- Put frontend and API behind the same parent domain, enable `COOKIE_SECURE=true`, and add CSRF protection for state-changing endpoints.
- Replace synchronous grading with a worker/queue for larger batches.
- Add malware scanning and stricter file validation before processing uploads.
- Add signed download URLs and retention/deletion policies for student work.
- Build a LangSmith evaluation dataset from teacher-approved grading examples before allowing automatic grade release.
