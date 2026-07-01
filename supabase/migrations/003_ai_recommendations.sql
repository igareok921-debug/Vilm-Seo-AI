create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  model text not null,
  seo_score_explanation text not null,
  problems jsonb not null default '[]'::jsonb,
  recommended_meta_title text not null,
  recommended_meta_description text not null,
  recommended_h1 text not null,
  recommended_faq jsonb not null default '[]'::jsonb,
  internal_linking_suggestions jsonb not null default '[]'::jsonb,
  content_suggestions jsonb not null default '[]'::jsonb,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost_usd numeric(12, 8) not null default 0 check (estimated_cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_recommendations_page_created_at_idx
  on public.ai_recommendations(page_id, created_at desc);

create index if not exists ai_recommendations_website_created_at_idx
  on public.ai_recommendations(website_id, created_at desc);

alter table public.ai_recommendations enable row level security;

grant select, insert, update, delete on public.ai_recommendations to service_role;

comment on table public.ai_recommendations is
  'Recomandări SEO generate de OpenAI pentru paginile crawl-uite.';

comment on column public.ai_recommendations.estimated_cost_usd is
  'Cost estimat pe baza tokenilor raportați și a prețului modelului la momentul implementării.';
