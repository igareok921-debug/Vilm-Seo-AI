alter table public.keyword_research
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.keyword_clusters
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.content_plans
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.generated_pages
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.ai_recommendations
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.ai_documents
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.assistant_conversations
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.keyword_research kr
set organization_id = coalesce(w.owner_organization_id, w.organization_id)
from public.websites w
where w.id = kr.website_id
  and kr.organization_id is null;

update public.keyword_clusters kc
set organization_id = coalesce(w.owner_organization_id, w.organization_id)
from public.websites w
where w.id = kc.website_id
  and kc.organization_id is null;

update public.content_plans cp
set organization_id = coalesce(w.owner_organization_id, w.organization_id)
from public.websites w
where w.id = cp.website_id
  and cp.organization_id is null;

update public.generated_pages gp
set organization_id = coalesce(w.owner_organization_id, w.organization_id)
from public.websites w
where w.id = gp.website_id
  and gp.organization_id is null;

update public.ai_recommendations ar
set organization_id = coalesce(w.owner_organization_id, w.organization_id)
from public.websites w
where w.id = ar.website_id
  and ar.organization_id is null;

update public.ai_documents ad
set organization_id = coalesce(w.owner_organization_id, w.organization_id)
from public.websites w
where w.id = ad.website_id
  and ad.organization_id is null;

update public.assistant_conversations ac
set organization_id = coalesce(w.owner_organization_id, w.organization_id)
from public.websites w
where w.id = ac.website_id
  and ac.organization_id is null;

create index if not exists keyword_research_org_website_idx
  on public.keyword_research(organization_id, website_id, created_at desc);

create index if not exists keyword_clusters_org_website_idx
  on public.keyword_clusters(organization_id, website_id, created_at desc);

create index if not exists content_plans_org_website_idx
  on public.content_plans(organization_id, website_id, created_at desc);

create index if not exists generated_pages_org_website_idx
  on public.generated_pages(organization_id, website_id, created_at desc);

create index if not exists ai_recommendations_org_website_idx
  on public.ai_recommendations(organization_id, website_id, created_at desc);

create index if not exists ai_documents_org_website_idx
  on public.ai_documents(organization_id, website_id, created_at desc);

create index if not exists assistant_conversations_org_website_idx
  on public.assistant_conversations(organization_id, website_id, updated_at desc);

comment on column public.keyword_research.organization_id is
  'Organizația website-ului pentru izolare explicită multi-user.';

comment on column public.keyword_clusters.organization_id is
  'Organizația website-ului pentru izolare explicită multi-user.';

comment on column public.content_plans.organization_id is
  'Organizația website-ului pentru izolare explicită multi-user.';

comment on column public.generated_pages.organization_id is
  'Organizația website-ului pentru izolare explicită multi-user.';

comment on column public.ai_recommendations.organization_id is
  'Organizația website-ului pentru izolare explicită multi-user.';

comment on column public.ai_documents.organization_id is
  'Organizația website-ului pentru izolare explicită multi-user.';

comment on column public.assistant_conversations.organization_id is
  'Organizația website-ului pentru izolare explicită multi-user.';
