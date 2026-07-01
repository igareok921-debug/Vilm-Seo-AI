update public.profiles
set
  role = 'admin',
  updated_at = now()
where lower(email) = 'igareok921@gmail.com';

with admin_profile as (
  select id
  from public.profiles
  where lower(email) = 'igareok921@gmail.com'
  limit 1
),
admin_org as (
  select om.organization_id
  from public.organization_members om
  join admin_profile ap on ap.id = om.user_id
  order by om.created_at asc
  limit 1
)
update public.websites w
set
  owner_organization_id = admin_org.organization_id,
  organization_id = admin_org.organization_id,
  updated_at = now()
from admin_org
where public.normalize_website_domain(w.url) in ('carocakes.md', 'vilmgroup.md')
  and admin_org.organization_id is not null;

comment on table public.websites is
  'Website-uri monitorizate în VILM SEO AI. Seed-urile carocakes.md și vilmgroup.md pot fi revendicate de adminul igareok921@gmail.com.';
