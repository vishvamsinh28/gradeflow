-- The model is now a single deployment-wide setting (GEMINI_MODEL), not a
-- per-teacher choice. This column is no longer read by the application.
alter table public.teacher_settings
  drop column if exists gemini_model;
