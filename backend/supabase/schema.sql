create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  subject text not null default 'Mathematics',
  grade_level text,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  external_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text,
  total_points numeric not null check (total_points > 0),
  answer_key jsonb not null default '{}'::jsonb,
  rubric jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived', 'returned')),
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'completed', 'review_required', 'failed')),
  extracted_answers jsonb,
  score numeric,
  max_score numeric,
  feedback jsonb,
  confidence numeric,
  review_required boolean not null default false,
  reviewed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grading_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_number text not null,
  student_work text,
  score numeric not null default 0,
  max_score numeric not null default 0,
  is_correct boolean not null default false,
  feedback text not null default '',
  confidence numeric not null default 0,
  error_category text,
  created_at timestamptz not null default now()
);

create index if not exists classes_owner_idx on public.classes(owner_id);
create index if not exists students_class_idx on public.students(class_id);
create index if not exists assignments_class_idx on public.assignments(class_id);
create index if not exists submissions_assignment_idx on public.submissions(assignment_id);
create index if not exists grading_results_submission_idx on public.grading_results(submission_id);

alter table public.users enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.grading_results enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'submissions',
  'submissions',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
