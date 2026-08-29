create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- The API reaches Postgres with the service role key, which bypasses RLS. RLS
-- is enabled anyway so that anon/authenticated keys — a leaked publishable key,
-- a direct PostgREST call — get nothing.
alter table public.users enable row level security;

-- Everything else lives in supabase/migrations/004_classroom_domain.sql:
-- classrooms, subjects, classroom_students, tests, test_submissions,
-- test_attendance, and the private answer-sheets bucket.
