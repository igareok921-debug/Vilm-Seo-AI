alter table public.pages
  add column if not exists h2 text[] not null default '{}',
  add column if not exists meta_robots text,
  add column if not exists language text,
  add column if not exists internal_links_count integer not null default 0 check (internal_links_count >= 0),
  add column if not exists external_links_count integer not null default 0 check (external_links_count >= 0),
  add column if not exists images_count integer not null default 0 check (images_count >= 0),
  add column if not exists images_without_alt integer not null default 0 check (images_without_alt >= 0),
  add column if not exists open_graph_title text,
  add column if not exists open_graph_description text,
  add column if not exists twitter_card text,
  add column if not exists has_schema_org boolean not null default false,
  add column if not exists seo_score integer not null default 0 check (seo_score between 0 and 100),
  add column if not exists issues_count integer not null default 0 check (issues_count >= 0);

alter table public.crawls
  add column if not exists start_url text,
  add column if not exists progress integer not null default 0 check (progress between 0 and 100),
  add column if not exists issues_found integer not null default 0 check (issues_found >= 0);

create index if not exists pages_website_score_idx
  on public.pages(website_id, seo_score);

create index if not exists pages_website_crawled_at_idx
  on public.pages(website_id, crawled_at desc);

comment on column public.pages.h2 is 'Lista heading-urilor H2 detectate.';
comment on column public.pages.has_schema_org is 'Indică prezența JSON-LD, microdata sau RDFa Schema.org.';
comment on column public.pages.seo_score is 'Scor SEO on-page între 0 și 100.';
comment on column public.crawls.progress is 'Progres estimat al crawl-ului între 0 și 100.';
