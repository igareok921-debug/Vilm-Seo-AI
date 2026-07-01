create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  title text not null,
  type text not null default 'full_seo',
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'failed')),
  period_start date not null,
  period_end date not null,
  summary text,
  data jsonb not null default '{}'::jsonb,
  pdf_url text,
  downloads_count integer not null default 0 check (downloads_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_website_created_at_idx
  on public.reports(website_id, created_at desc);

create index if not exists reports_website_status_idx
  on public.reports(website_id, status);

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at before update on public.reports
for each row execute function public.set_updated_at();

alter table public.reports enable row level security;

grant select on public.reports to anon, authenticated;
grant select, insert, update, delete on public.reports to service_role;

drop policy if exists "Rapoarte SEO vizibile public" on public.reports;
create policy "Rapoarte SEO vizibile public"
on public.reports for select
to anon, authenticated
using (true);

comment on table public.reports is
  'Rapoarte SEO PDF generate pe baza datelor reale din VILM SEO AI.';

comment on column public.reports.data is
  'Snapshot JSON cu datele folosite pentru raport, filtrate strict după website_id.';

comment on column public.reports.pdf_url is
  'URL către PDF în Supabase Storage sau fallback local în development.';
