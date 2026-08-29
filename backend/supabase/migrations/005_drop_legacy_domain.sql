-- Retire the original assignment/class domain.
--
-- The product was rebuilt around classrooms, tests and answer sheets
-- (004_classroom_domain.sql). Nothing in the API or the frontend has read these
-- tables since; the routers that did were removed alongside this migration.
--
-- Dropped in dependency order. `cascade` on classes and assignments clears the
-- foreign keys from the child tables that go with them.

drop table if exists public.audit_logs cascade;
drop table if exists public.grading_results cascade;
drop table if exists public.teacher_settings cascade;
drop table if exists public.submissions cascade;
drop table if exists public.assignment_versions cascade;
drop table if exists public.assignments cascade;
drop table if exists public.students cascade;
drop table if exists public.classes cascade;

-- The old `submissions` bucket goes with them, but not from here: Supabase
-- guards storage.objects with a trigger that rejects direct deletes, so this
-- has to go through the Storage API. Run:
--
--   backend/.venv/bin/python -m app.scripts.drop_legacy_bucket
--
-- It is safe to run before or after this migration, and safe to re-run.
