-- The redesigned domain, persisted server-side.
--
-- Distinct table names from the legacy `classes/assignments/submissions` set so
-- both can coexist while the old surface is retired. Nothing here drops data.

create extension if not exists pgcrypto;

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  -- Ordered bands, highest first: [{"label":"A","min":80}, ...]. Empty = percentages only.
  grade_scale jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (classroom_id, name)
);

create table if not exists public.classroom_students (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  code text not null,
  name text not null,
  roll_no text,
  -- Private link for returning results to a student or parent.
  share_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (classroom_id, code)
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  test_date date not null,
  title text,
  -- Free-text guidance for the model. Replaces answer keys and rubrics.
  instructions text,
  max_marks numeric not null default 100 check (max_marks > 0),
  status text not null default 'collecting' check (status in ('collecting', 'grading', 'graded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_submissions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.classroom_students(id) on delete cascade,
  file_name text,
  storage_path text,
  mime_type text,
  -- Page range when one uploaded PDF held the whole class.
  source_page_from integer,
  source_page_to integer,
  matched_by_ai boolean not null default false,
  status text not null default 'awaiting'
    check (status in ('awaiting', 'queued', 'grading', 'graded', 'failed')),
  score numeric,
  out_of numeric,
  summary text,
  questions jsonb not null default '[]'::jsonb,
  needs_review boolean not null default false,
  overridden boolean not null default false,
  error_message text,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One answer sheet per student per test. Enforced here, not by convention.
  unique (test_id, student_id)
);

create table if not exists public.test_attendance (
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.classroom_students(id) on delete cascade,
  mark text not null default 'present' check (mark in ('present', 'absent')),
  updated_at timestamptz not null default now(),
  primary key (test_id, student_id)
);

create index if not exists classrooms_owner_idx on public.classrooms(owner_id);
create index if not exists subjects_classroom_idx on public.subjects(classroom_id);
create index if not exists classroom_students_classroom_idx on public.classroom_students(classroom_id);
create index if not exists classroom_students_share_idx on public.classroom_students(share_token);
create index if not exists tests_classroom_idx on public.tests(classroom_id, test_date desc);
create index if not exists test_submissions_test_idx on public.test_submissions(test_id);
create index if not exists test_submissions_student_idx on public.test_submissions(student_id);

alter table public.classrooms enable row level security;
alter table public.subjects enable row level security;
alter table public.classroom_students enable row level security;
alter table public.tests enable row level security;
alter table public.test_submissions enable row level security;
alter table public.test_attendance enable row level security;

-- Answer sheets. Private bucket; the API serves them through ownership checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'answer-sheets',
  'answer-sheets',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
