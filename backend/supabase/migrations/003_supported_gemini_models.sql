alter table public.teacher_settings
  alter column gemini_model set default 'gemini-3.1-flash-lite';

update public.teacher_settings
set gemini_model = 'gemini-3.1-flash-lite'
where gemini_model not in (
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
);
