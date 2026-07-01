alter table public.pages
  add column if not exists crawl_id uuid references public.crawls(id) on delete cascade;

with latest_completed_crawls as (
  select distinct on (website_id)
    id,
    website_id
  from public.crawls
  where status = 'completed'
  order by website_id, created_at desc
)
update public.pages p
set crawl_id = lcc.id
from latest_completed_crawls lcc
where p.website_id = lcc.website_id
  and p.crawl_id is null;

alter table public.pages
  drop constraint if exists pages_website_id_url_key;

create unique index if not exists pages_crawl_id_url_key
  on public.pages(crawl_id, url)
  where crawl_id is not null;

create index if not exists pages_crawl_id_idx
  on public.pages(crawl_id);

create index if not exists pages_website_crawl_crawled_idx
  on public.pages(website_id, crawl_id, crawled_at desc);

comment on column public.pages.crawl_id is
  'Crawl-ul concret care a produs acest snapshot de pagină. Permite istoricul real între crawl-uri.';

comment on index public.pages_crawl_id_url_key is
  'O pagină poate apărea o singură dată într-un crawl, dar aceeași URL poate exista în crawl-uri diferite.';
