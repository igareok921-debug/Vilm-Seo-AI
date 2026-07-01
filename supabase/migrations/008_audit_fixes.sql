create table if not exists public.audit_fixes (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null,
  website_id text not null,
  issue_type text not null
    check (issue_type in ('missing_meta_description', 'images_without_alt', 'duplicate_titles', 'slow_pages')),
  title text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  recommendation text,
  status text not null default 'applied'
    check (status in ('previewed', 'applied')),
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists audit_fixes_website_created_at_idx
  on public.audit_fixes(website_id, created_at desc);

create index if not exists audit_fixes_issue_id_idx
  on public.audit_fixes(issue_id);

alter table public.audit_fixes enable row level security;

grant select on public.audit_fixes to anon, authenticated;
grant select, insert, update, delete on public.audit_fixes to service_role;

drop policy if exists "Remedieri audit vizibile public" on public.audit_fixes;
create policy "Remedieri audit vizibile public"
on public.audit_fixes for select
to anon, authenticated
using (true);

comment on table public.audit_fixes is
  'Istoricul remedierilor aplicate din pagina Audit SEO.';

comment on column public.audit_fixes.before_state is
  'Starea problemei înainte de remediere.';

comment on column public.audit_fixes.after_state is
  'Propunerea sau schimbarea aplicată demonstrativ.';
