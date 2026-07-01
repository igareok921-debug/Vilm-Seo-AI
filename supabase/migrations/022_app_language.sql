alter table public.user_settings
  add column if not exists app_language text not null default 'en'
    check (app_language in ('en', 'ro'));

comment on column public.user_settings.app_language is
  'Limba interfeței aplicației. English este limba principală implicită.';
