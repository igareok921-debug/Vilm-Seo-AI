create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

alter table public.websites
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists websites_organization_created_idx
  on public.websites(organization_id, created_at desc);

create index if not exists organization_members_user_idx
  on public.organization_members(user_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  org_id uuid;
  org_name text;
  base_slug text;
begin
  profile_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'Client VILM SEO AI'
  );

  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    profile_name,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  org_name := profile_name;
  base_slug := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), new.id::text), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then
    base_slug := replace(new.id::text, '-', '');
  end if;

  insert into public.organizations (name, slug, owner_id)
  values (
    org_name,
    base_slug || '-' || substring(replace(new.id::text, '-', '') from 1 for 8),
    new.id
  )
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (org_id, new.id, 'owner')
  on conflict (organization_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

drop policy if exists "Profilul propriu este vizibil" on public.profiles;
create policy "Profilul propriu este vizibil"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Profilul propriu poate fi actualizat" on public.profiles;
create policy "Profilul propriu poate fi actualizat"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Organizațiile membrilor sunt vizibile" on public.organizations;
create policy "Organizațiile membrilor sunt vizibile"
on public.organizations for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
  )
);

drop policy if exists "Ownerii pot actualiza organizația" on public.organizations;
create policy "Ownerii pot actualiza organizația"
on public.organizations for update
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  )
);

drop policy if exists "Membrii organizației sunt vizibili" on public.organization_members;
create policy "Membrii organizației sunt vizibili"
on public.organization_members for select
to authenticated
using (
  exists (
    select 1 from public.organization_members viewer
    where viewer.organization_id = organization_members.organization_id
      and viewer.user_id = auth.uid()
  )
);

drop policy if exists "Website-urile sunt vizibile public" on public.websites;

drop policy if exists "Website-uri vizibile pentru organizație" on public.websites;
create policy "Website-uri vizibile pentru organizație"
on public.websites for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = websites.organization_id
      and om.user_id = auth.uid()
  )
);

drop policy if exists "Website-uri create în organizație" on public.websites;
create policy "Website-uri create în organizație"
on public.websites for insert
to authenticated
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = websites.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin', 'member')
  )
);

drop policy if exists "Website-uri actualizate în organizație" on public.websites;
create policy "Website-uri actualizate în organizație"
on public.websites for update
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = websites.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = websites.organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  )
);

grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select, insert, update on public.websites to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.organizations to service_role;
grant select, insert, update, delete on public.organization_members to service_role;

comment on table public.profiles is 'Profiluri utilizatori Supabase Auth pentru VILM SEO AI.';
comment on table public.organizations is 'Organizații SaaS care izolează datele clienților.';
comment on table public.organization_members is 'Membrii și rolurile din organizații.';
comment on column public.websites.organization_id is 'Organizația care deține website-ul.';

drop policy if exists "Keyword research vizibil public" on public.keyword_research;
drop policy if exists "Keyword clusters vizibile public" on public.keyword_clusters;
drop policy if exists "Planuri editoriale vizibile public" on public.content_plans;
drop policy if exists "Pagini generate vizibile public" on public.generated_pages;
drop policy if exists "Documente AI vizibile public" on public.ai_documents;
drop policy if exists "Rapoarte SEO vizibile public" on public.reports;
drop policy if exists "Rapoarte Copilot vizibile public" on public.assistant_reports;
drop policy if exists "Conversații Copilot vizibile public" on public.assistant_conversations;
drop policy if exists "Mesaje Copilot vizibile public" on public.assistant_messages;
drop policy if exists "Snapshoturi Copilot vizibile public" on public.assistant_context_snapshots;
drop policy if exists "Remedieri audit vizibile public" on public.audit_fixes;

drop policy if exists "Date SEO vizibile pentru organizație - pages" on public.pages;
create policy "Date SEO vizibile pentru organizație - pages"
on public.pages for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = pages.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - crawls" on public.crawls;
create policy "Date SEO vizibile pentru organizație - crawls"
on public.crawls for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = crawls.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - seo_audits" on public.seo_audits;
create policy "Date SEO vizibile pentru organizație - seo_audits"
on public.seo_audits for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = seo_audits.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - audit_issues" on public.audit_issues;
create policy "Date SEO vizibile pentru organizație - audit_issues"
on public.audit_issues for select to authenticated
using (exists (
  select 1 from public.seo_audits a
  join public.websites w on w.id = a.website_id
  join public.organization_members om on om.organization_id = w.organization_id
  where a.id = audit_issues.audit_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - keywords" on public.keywords;
create policy "Date SEO vizibile pentru organizație - keywords"
on public.keywords for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = keywords.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - activity_logs" on public.activity_logs;
create policy "Date SEO vizibile pentru organizație - activity_logs"
on public.activity_logs for select to authenticated
using (website_id is null or exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = activity_logs.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - keyword_research" on public.keyword_research;
create policy "Date SEO vizibile pentru organizație - keyword_research"
on public.keyword_research for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = keyword_research.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - keyword_clusters" on public.keyword_clusters;
create policy "Date SEO vizibile pentru organizație - keyword_clusters"
on public.keyword_clusters for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = keyword_clusters.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - content_plans" on public.content_plans;
create policy "Date SEO vizibile pentru organizație - content_plans"
on public.content_plans for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = content_plans.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - generated_pages" on public.generated_pages;
create policy "Date SEO vizibile pentru organizație - generated_pages"
on public.generated_pages for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = generated_pages.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - ai_documents" on public.ai_documents;
create policy "Date SEO vizibile pentru organizație - ai_documents"
on public.ai_documents for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = ai_documents.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - ai_recommendations" on public.ai_recommendations;
create policy "Date SEO vizibile pentru organizație - ai_recommendations"
on public.ai_recommendations for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = ai_recommendations.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - reports" on public.reports;
create policy "Date SEO vizibile pentru organizație - reports"
on public.reports for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = reports.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - assistant_reports" on public.assistant_reports;
create policy "Date SEO vizibile pentru organizație - assistant_reports"
on public.assistant_reports for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = assistant_reports.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - assistant_conversations" on public.assistant_conversations;
create policy "Date SEO vizibile pentru organizație - assistant_conversations"
on public.assistant_conversations for select to authenticated
using (website_id is null or exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = assistant_conversations.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - assistant_messages" on public.assistant_messages;
create policy "Date SEO vizibile pentru organizație - assistant_messages"
on public.assistant_messages for select to authenticated
using (exists (
  select 1 from public.assistant_conversations c
  join public.websites w on w.id = c.website_id
  join public.organization_members om on om.organization_id = w.organization_id
  where c.id = assistant_messages.conversation_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - assistant_context_snapshots" on public.assistant_context_snapshots;
create policy "Date SEO vizibile pentru organizație - assistant_context_snapshots"
on public.assistant_context_snapshots for select to authenticated
using (website_id is null or exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id = assistant_context_snapshots.website_id and om.user_id = auth.uid()
));

drop policy if exists "Date SEO vizibile pentru organizație - audit_fixes" on public.audit_fixes;
create policy "Date SEO vizibile pentru organizație - audit_fixes"
on public.audit_fixes for select to authenticated
using (exists (
  select 1 from public.websites w
  join public.organization_members om on om.organization_id = w.organization_id
  where w.id::text = audit_fixes.website_id and om.user_id = auth.uid()
));
