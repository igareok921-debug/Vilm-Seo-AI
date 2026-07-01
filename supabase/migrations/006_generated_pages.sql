create table if not exists public.generated_pages (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  keyword text not null,
  title text not null,
  meta_title text not null,
  meta_description text not null,
  slug text not null,
  content jsonb not null default '{}'::jsonb,
  faq_schema jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, slug)
);

create index if not exists generated_pages_website_created_at_idx
  on public.generated_pages(website_id, created_at desc);

create index if not exists generated_pages_website_status_idx
  on public.generated_pages(website_id, status);

drop trigger if exists generated_pages_set_updated_at on public.generated_pages;
create trigger generated_pages_set_updated_at before update on public.generated_pages
for each row execute function public.set_updated_at();

alter table public.generated_pages enable row level security;

grant select on public.generated_pages to anon, authenticated;
grant select, insert, update, delete on public.generated_pages to service_role;

drop policy if exists "Pagini generate vizibile public" on public.generated_pages;
create policy "Pagini generate vizibile public"
on public.generated_pages for select
to anon, authenticated
using (true);

comment on table public.generated_pages is
  'Landing pages generate cu AI din keyword research, editabile înainte de publicare.';

comment on column public.generated_pages.content is
  'Conținut structurat: H1, introducere, secțiuni H2/H3, CTA și linkuri interne.';

comment on column public.generated_pages.faq_schema is
  'FAQPage schema.org generat pentru pagina SEO.';
