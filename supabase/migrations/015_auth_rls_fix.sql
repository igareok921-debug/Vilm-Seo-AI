create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  );
$$;

drop policy if exists "Organizațiile membrilor sunt vizibile" on public.organizations;
create policy "Organizațiile membrilor sunt vizibile"
on public.organizations for select
to authenticated
using (public.is_organization_member(id));

drop policy if exists "Ownerii pot actualiza organizația" on public.organizations;
create policy "Ownerii pot actualiza organizația"
on public.organizations for update
to authenticated
using (public.is_organization_admin(id))
with check (public.is_organization_admin(id));

drop policy if exists "Membrii organizației sunt vizibili" on public.organization_members;
create policy "Membrii organizației sunt vizibili"
on public.organization_members for select
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "Website-uri vizibile pentru organizație" on public.websites;
create policy "Website-uri vizibile pentru organizație"
on public.websites for select
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "Website-uri create în organizație" on public.websites;
create policy "Website-uri create în organizație"
on public.websites for insert
to authenticated
with check (public.is_organization_member(organization_id));

drop policy if exists "Website-uri actualizate în organizație" on public.websites;
create policy "Website-uri actualizate în organizație"
on public.websites for update
to authenticated
using (public.is_organization_admin(organization_id))
with check (public.is_organization_admin(organization_id));

drop policy if exists "Date SEO vizibile pentru organizație - pages" on public.pages;
create policy "Date SEO vizibile pentru organizație - pages"
on public.pages for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = pages.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - crawls" on public.crawls;
create policy "Date SEO vizibile pentru organizație - crawls"
on public.crawls for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = crawls.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - seo_audits" on public.seo_audits;
create policy "Date SEO vizibile pentru organizație - seo_audits"
on public.seo_audits for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = seo_audits.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - audit_issues" on public.audit_issues;
create policy "Date SEO vizibile pentru organizație - audit_issues"
on public.audit_issues for select to authenticated
using (exists (
  select 1
  from public.seo_audits a
  join public.websites w on w.id = a.website_id
  where a.id = audit_issues.audit_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - keywords" on public.keywords;
create policy "Date SEO vizibile pentru organizație - keywords"
on public.keywords for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = keywords.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - activity_logs" on public.activity_logs;
create policy "Date SEO vizibile pentru organizație - activity_logs"
on public.activity_logs for select to authenticated
using (website_id is null or exists (
  select 1 from public.websites w
  where w.id = activity_logs.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - keyword_research" on public.keyword_research;
create policy "Date SEO vizibile pentru organizație - keyword_research"
on public.keyword_research for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = keyword_research.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - keyword_clusters" on public.keyword_clusters;
create policy "Date SEO vizibile pentru organizație - keyword_clusters"
on public.keyword_clusters for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = keyword_clusters.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - content_plans" on public.content_plans;
create policy "Date SEO vizibile pentru organizație - content_plans"
on public.content_plans for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = content_plans.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - generated_pages" on public.generated_pages;
create policy "Date SEO vizibile pentru organizație - generated_pages"
on public.generated_pages for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = generated_pages.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - ai_documents" on public.ai_documents;
create policy "Date SEO vizibile pentru organizație - ai_documents"
on public.ai_documents for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = ai_documents.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - ai_recommendations" on public.ai_recommendations;
create policy "Date SEO vizibile pentru organizație - ai_recommendations"
on public.ai_recommendations for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = ai_recommendations.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - reports" on public.reports;
create policy "Date SEO vizibile pentru organizație - reports"
on public.reports for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = reports.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - assistant_reports" on public.assistant_reports;
create policy "Date SEO vizibile pentru organizație - assistant_reports"
on public.assistant_reports for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id = assistant_reports.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - assistant_conversations" on public.assistant_conversations;
create policy "Date SEO vizibile pentru organizație - assistant_conversations"
on public.assistant_conversations for select to authenticated
using (website_id is null or exists (
  select 1 from public.websites w
  where w.id = assistant_conversations.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - assistant_messages" on public.assistant_messages;
create policy "Date SEO vizibile pentru organizație - assistant_messages"
on public.assistant_messages for select to authenticated
using (exists (
  select 1
  from public.assistant_conversations c
  join public.websites w on w.id = c.website_id
  where c.id = assistant_messages.conversation_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - assistant_context_snapshots" on public.assistant_context_snapshots;
create policy "Date SEO vizibile pentru organizație - assistant_context_snapshots"
on public.assistant_context_snapshots for select to authenticated
using (website_id is null or exists (
  select 1 from public.websites w
  where w.id = assistant_context_snapshots.website_id
    and public.is_organization_member(w.organization_id)
));

drop policy if exists "Date SEO vizibile pentru organizație - audit_fixes" on public.audit_fixes;
create policy "Date SEO vizibile pentru organizație - audit_fixes"
on public.audit_fixes for select to authenticated
using (exists (
  select 1 from public.websites w
  where w.id::text = audit_fixes.website_id
    and public.is_organization_member(w.organization_id)
));

comment on function public.is_organization_member(uuid) is
  'Verifică membership-ul fără recursie RLS în organization_members.';

comment on function public.is_organization_admin(uuid) is
  'Verifică rol owner/admin fără recursie RLS în organization_members.';
