create extension if not exists pgcrypto;

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  url text not null unique check (url ~ '^https?://'),
  language text not null default 'ro' check (char_length(language) between 2 and 10),
  niche text not null default 'General' check (char_length(niche) between 2 and 120),
  seo_score integer not null default 0 check (seo_score between 0 and 100),
  pages_count integer not null default 0 check (pages_count >= 0),
  keywords_count integer not null default 0 check (keywords_count >= 0),
  status text not null default 'Se analizează'
    check (status in ('Activ', 'Atenție', 'Se analizează')),
  last_audit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  url text not null,
  title text,
  meta_description text,
  h1 text,
  canonical_url text,
  status_code integer,
  word_count integer not null default 0 check (word_count >= 0),
  is_indexable boolean not null default true,
  load_time_ms integer check (load_time_ms >= 0),
  crawled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, url)
);

create table if not exists public.crawls (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  pages_discovered integer not null default 0 check (pages_discovered >= 0),
  pages_crawled integer not null default 0 check (pages_crawled >= 0),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.seo_audits (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  crawl_id uuid references public.crawls(id) on delete set null,
  score integer not null default 0 check (score between 0 and 100),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_issues (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.seo_audits(id) on delete cascade,
  page_id uuid references public.pages(id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  severity text not null check (severity in ('critical', 'warning', 'notice')),
  category text not null,
  recommendation text,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.keywords (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  keyword text not null,
  target_url text,
  language text not null default 'ro',
  country text not null default 'MD',
  current_position integer check (current_position > 0),
  previous_position integer check (previous_position > 0),
  search_volume integer not null default 0 check (search_volume >= 0),
  difficulty integer not null default 0 check (difficulty between 0 and 100),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, keyword, country)
);

create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  title text not null,
  primary_keyword text,
  search_intent text check (search_intent in ('informational', 'commercial', 'transactional', 'navigational')),
  brief jsonb not null default '{}'::jsonb,
  status text not null default 'idea'
    check (status in ('idea', 'planned', 'draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  website_id uuid references public.websites(id) on delete cascade,
  action text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pages_website_id_idx on public.pages(website_id);
create index if not exists crawls_website_id_created_at_idx on public.crawls(website_id, created_at desc);
create index if not exists seo_audits_website_id_created_at_idx on public.seo_audits(website_id, created_at desc);
create index if not exists audit_issues_audit_id_severity_idx on public.audit_issues(audit_id, severity);
create index if not exists keywords_website_id_idx on public.keywords(website_id);
create index if not exists content_ideas_website_id_idx on public.content_ideas(website_id);
create index if not exists activity_logs_website_id_created_at_idx on public.activity_logs(website_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists websites_set_updated_at on public.websites;
create trigger websites_set_updated_at before update on public.websites
for each row execute function public.set_updated_at();

drop trigger if exists pages_set_updated_at on public.pages;
create trigger pages_set_updated_at before update on public.pages
for each row execute function public.set_updated_at();

drop trigger if exists keywords_set_updated_at on public.keywords;
create trigger keywords_set_updated_at before update on public.keywords
for each row execute function public.set_updated_at();

drop trigger if exists content_ideas_set_updated_at on public.content_ideas;
create trigger content_ideas_set_updated_at before update on public.content_ideas
for each row execute function public.set_updated_at();

alter table public.websites enable row level security;
alter table public.pages enable row level security;
alter table public.crawls enable row level security;
alter table public.seo_audits enable row level security;
alter table public.audit_issues enable row level security;
alter table public.keywords enable row level security;
alter table public.content_ideas enable row level security;
alter table public.activity_logs enable row level security;

grant select on public.websites to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

drop policy if exists "Website-urile sunt vizibile public" on public.websites;
create policy "Website-urile sunt vizibile public"
on public.websites for select
to anon, authenticated
using (true);

comment on table public.websites is 'Website-uri monitorizate în VILM SEO AI.';
comment on table public.pages is 'Pagini descoperite și analizate de crawler.';
comment on table public.crawls is 'Execuții și progres pentru crawl-uri.';
comment on table public.seo_audits is 'Rezultatele agregate ale auditurilor SEO.';
comment on table public.audit_issues is 'Probleme individuale detectate într-un audit.';
comment on table public.keywords is 'Cuvinte cheie și poziții monitorizate.';
comment on table public.content_ideas is 'Idei și brief-uri pentru Conținut AI.';
comment on table public.activity_logs is 'Jurnalul activităților platformei.';
