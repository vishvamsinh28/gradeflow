alter table public.assignments
  drop constraint if exists assignments_status_check;

alter table public.assignments
  add constraint assignments_status_check
  check (status in ('draft', 'active', 'archived', 'returned'));
