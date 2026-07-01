create table if not exists public.ai_documents (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  type text not null
    check (type in ('seo_article', 'landing_page', 'meta_tags', 'faq', 'text_optimization', 'content_ideas')),
  keyword text,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published')),
  language text not null default 'ro',
  tone text not null default 'profesional'
    check (tone in ('profesional', 'prietenos', 'premium', 'comercial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_documents_website_created_at_idx
  on public.ai_documents(website_id, created_at desc);

create index if not exists ai_documents_website_status_idx
  on public.ai_documents(website_id, status);

drop trigger if exists ai_documents_set_updated_at on public.ai_documents;
create trigger ai_documents_set_updated_at before update on public.ai_documents
for each row execute function public.set_updated_at();

alter table public.ai_documents enable row level security;

grant select on public.ai_documents to anon, authenticated;
grant select, insert, update, delete on public.ai_documents to service_role;

drop policy if exists "Documente AI vizibile public" on public.ai_documents;
create policy "Documente AI vizibile public"
on public.ai_documents for select
to anon, authenticated
using (true);

comment on table public.ai_documents is
  'Documente SEO generate cu AI pentru website-urile monitorizate.';

comment on column public.ai_documents.content is
  'Conținutul documentului în format structurat JSON, incluzând markdown sau secțiuni.';
