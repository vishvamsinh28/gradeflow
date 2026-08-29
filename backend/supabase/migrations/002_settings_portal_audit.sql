alter table public.students
  add column if not exists portal_token uuid unique default gen_random_uuid();

update public.students
set portal_token = gen_random_uuid()
where portal_token is null;

alter table public.students
  alter column portal_token set not null;

create table if not exists public.teacher_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  confidence_threshold numeric not null default 0.72 check (confidence_threshold >= 0 and confidence_threshold <= 1),
  default_subject text not null default 'Mathematics',
  default_grade_level text,
  default_grading_rules text not null default 'Award method marks for a correct approach.
Do not penalize the same arithmetic slip twice.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignment_versions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  version_number integer not null,
  title text not null,
  description text,
  total_points numeric not null,
  answer_key jsonb not null,
  rubric jsonb not null,
  change_note text,
  created_at timestamptz not null default now(),
  unique (assignment_id, version_number)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists students_portal_token_idx on public.students(portal_token);
create index if not exists assignment_versions_assignment_idx on public.assignment_versions(assignment_id);
create index if not exists audit_logs_owner_idx on public.audit_logs(owner_id, created_at desc);

alter table public.teacher_settings enable row level security;
alter table public.assignment_versions enable row level security;
alter table public.audit_logs enable row level security;
