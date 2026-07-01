create or replace function public.normalize_website_domain(input_url text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(lower(trim(coalesce(input_url, ''))), '^https?://', ''),
      '^www\.',
      ''
    ),
    '/.*$',
    ''
  );
$$;

alter table public.websites
  add column if not exists owner_organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists normalized_domain text;

update public.websites
set
  owner_organization_id = coalesce(owner_organization_id, organization_id),
  normalized_domain = coalesce(nullif(normalized_domain, ''), public.normalize_website_domain(url))
where owner_organization_id is null
   or normalized_domain is null
   or normalized_domain = '';

create unique index if not exists websites_normalized_domain_key
  on public.websites(normalized_domain)
  where normalized_domain is not null;

create index if not exists websites_owner_organization_created_idx
  on public.websites(owner_organization_id, created_at desc);

drop policy if exists "Website-uri vizibile pentru organizație" on public.websites;
create policy "Website-uri vizibile pentru organizație"
on public.websites for select
to authenticated
using (public.is_organization_member(coalesce(owner_organization_id, organization_id)));

drop policy if exists "Website-uri create în organizație" on public.websites;
create policy "Website-uri create în organizație"
on public.websites for insert
to authenticated
with check (
  public.is_organization_member(coalesce(owner_organization_id, organization_id))
  and owner_organization_id = organization_id
);

drop policy if exists "Website-uri actualizate în organizație" on public.websites;
create policy "Website-uri actualizate în organizație"
on public.websites for update
to authenticated
using (public.is_organization_admin(coalesce(owner_organization_id, organization_id)))
with check (public.is_organization_admin(coalesce(owner_organization_id, organization_id)));

comment on column public.websites.owner_organization_id is
  'Organizația care deține proprietatea website-ului. Transferul se face doar de admin.';

comment on column public.websites.normalized_domain is
  'Domeniu normalizat pentru unicitate globală, indiferent de protocol sau path.';
