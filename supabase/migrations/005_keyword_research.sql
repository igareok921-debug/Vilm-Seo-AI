create table if not exists public.keyword_research (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  keyword text not null,
  search_intent text not null
    check (search_intent in ('informational', 'commercial', 'transactional', 'navigational')),
  difficulty text not null check (difficulty in ('low', 'medium', 'high')),
  priority text not null check (priority in ('high', 'medium', 'low')),
  content_type text not null
    check (content_type in ('landing page', 'blog article', 'service page', 'FAQ')),
  suggested_title text not null,
  suggested_meta_description text not null,
  suggested_slug text not null,
  status text not null default 'planned'
    check (status in ('planned', 'drafted', 'published')),
  created_at timestamptz not null default now(),
  unique (website_id, keyword)
);

create table if not exists public.keyword_clusters (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  cluster_name text not null,
  main_keyword text not null,
  related_keywords text[] not null default '{}',
  priority text not null check (priority in ('high', 'medium', 'low')),
  created_at timestamptz not null default now(),
  unique (website_id, cluster_name)
);

create table if not exists public.content_plans (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  month text not null,
  title text not null,
  content_type text not null
    check (content_type in ('landing page', 'blog article', 'service page', 'FAQ')),
  target_keyword text not null,
  outline jsonb not null default '[]'::jsonb,
  priority text not null check (priority in ('high', 'medium', 'low')),
  status text not null default 'planned'
    check (status in ('planned', 'drafted', 'published')),
  created_at timestamptz not null default now(),
  unique (website_id, title)
);

create index if not exists keyword_research_website_priority_idx
  on public.keyword_research(website_id, priority);

create index if not exists keyword_research_website_intent_idx
  on public.keyword_research(website_id, search_intent);

create index if not exists keyword_clusters_website_priority_idx
  on public.keyword_clusters(website_id, priority);

create index if not exists content_plans_website_status_idx
  on public.content_plans(website_id, status);

alter table public.keyword_research enable row level security;
alter table public.keyword_clusters enable row level security;
alter table public.content_plans enable row level security;

grant select on public.keyword_research to anon, authenticated;
grant select on public.keyword_clusters to anon, authenticated;
grant select on public.content_plans to anon, authenticated;
grant select, insert, update, delete on public.keyword_research to service_role;
grant select, insert, update, delete on public.keyword_clusters to service_role;
grant select, insert, update, delete on public.content_plans to service_role;

drop policy if exists "Keyword research vizibil public" on public.keyword_research;
create policy "Keyword research vizibil public"
on public.keyword_research for select
to anon, authenticated
using (true);

drop policy if exists "Keyword clusters vizibile public" on public.keyword_clusters;
create policy "Keyword clusters vizibile public"
on public.keyword_clusters for select
to anon, authenticated
using (true);

drop policy if exists "Planuri editoriale vizibile public" on public.content_plans;
create policy "Planuri editoriale vizibile public"
on public.content_plans for select
to anon, authenticated
using (true);

comment on table public.keyword_research is
  'Cuvinte cheie, oportunități SEO și recomandări generate de AI.';

comment on table public.keyword_clusters is
  'Clustere tematice de cuvinte cheie pentru fiecare website.';

comment on table public.content_plans is
  'Plan editorial AI pe 30 zile pentru conținut SEO.';
