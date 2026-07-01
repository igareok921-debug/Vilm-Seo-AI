create table if not exists public.plans (
  id text primary key,
  name text not null,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plans (id, name, limits)
values
  (
    'free',
    'Free',
    '{
      "crawl_per_website_per_day": 5,
      "crawl_per_website_per_month": 5,
      "ai_messages_per_day": 20,
      "ai_generations_per_month": 50,
      "reports_per_month": 3
    }'::jsonb
  ),
  (
    'starter',
    'Starter',
    '{
      "crawl_per_website_per_day": 30,
      "crawl_per_website_per_month": 30,
      "ai_messages_per_day": 200,
      "ai_generations_per_month": 500,
      "reports_per_month": 20
    }'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  limits = excluded.limits,
  updated_at = now();

alter table public.organizations
  add column if not exists plan_id text not null default 'free' references public.plans(id);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  website_id uuid references public.websites(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  tokens_used integer not null default 0 check (tokens_used >= 0),
  estimated_cost numeric(12, 8) not null default 0 check (estimated_cost >= 0),
  created_at timestamptz not null default now()
);

create index if not exists usage_events_org_type_created_idx
  on public.usage_events(organization_id, event_type, created_at desc);

create index if not exists usage_events_website_type_created_idx
  on public.usage_events(website_id, event_type, created_at desc);

alter table public.plans enable row level security;
alter table public.usage_events enable row level security;

grant select on public.plans to authenticated;
grant select on public.usage_events to authenticated;
grant select, insert, update, delete on public.plans to service_role;
grant select, insert, update, delete on public.usage_events to service_role;

drop policy if exists "Planurile sunt vizibile utilizatorilor autentificați" on public.plans;
create policy "Planurile sunt vizibile utilizatorilor autentificați"
on public.plans for select
to authenticated
using (true);

drop policy if exists "Usage vizibil pentru organizație" on public.usage_events;
create policy "Usage vizibil pentru organizație"
on public.usage_events for select
to authenticated
using (public.is_organization_member(organization_id));

comment on table public.usage_events is
  'Evenimente de utilizare pentru rate limiting și cost tracking.';

comment on table public.plans is
  'Planuri comerciale VILM SEO AI și limitele lor operaționale.';
