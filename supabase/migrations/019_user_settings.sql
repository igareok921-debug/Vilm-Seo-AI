create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notifications jsonb not null default '{
    "crawl_completed": true,
    "audit_completed": true,
    "report_generated": true,
    "critical_issues": true,
    "crawl_errors": true
  }'::jsonb,
  crawl_cleanup_policy text not null default 'disabled'
    check (crawl_cleanup_policy in ('disabled', 'keep_5', 'keep_10', 'older_than_30_days')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at before update on public.user_settings
for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

grant select, insert, update on public.user_settings to authenticated;
grant select, insert, update, delete on public.user_settings to service_role;

drop policy if exists "Setările proprii sunt vizibile" on public.user_settings;
create policy "Setările proprii sunt vizibile"
on public.user_settings for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Setările proprii pot fi create" on public.user_settings;
create policy "Setările proprii pot fi create"
on public.user_settings for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Setările proprii pot fi actualizate" on public.user_settings;
create policy "Setările proprii pot fi actualizate"
on public.user_settings for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

comment on table public.user_settings is
  'Preferințe reale per utilizator: notificări și curățare automată crawl-uri.';

comment on column public.user_settings.notifications is
  'Preferințe email pentru evenimente SEO importante.';

comment on column public.user_settings.crawl_cleanup_policy is
  'Politica de păstrare a istoricului crawl-urilor.';
