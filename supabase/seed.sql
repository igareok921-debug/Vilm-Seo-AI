insert into public.websites (
  id, name, url, language, niche, seo_score, pages_count, keywords_count,
  status, last_audit_at, created_at
)
values
  (
    'c0000000-0000-4000-8000-000000000001',
    'Caro Cakes',
    'https://carocakes.md',
    'ro',
    'Cofetărie și torturi la comandă',
    82,
    35,
    12,
    'Activ',
    '2026-06-13T10:30:00Z',
    '2026-05-01T09:00:00Z'
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'VILM Group',
    'https://vilmgroup.md',
    'ro',
    'Construcții și servicii B2B',
    71,
    18,
    6,
    'Atenție',
    '2026-06-12T14:15:00Z',
    '2026-05-02T09:00:00Z'
  )
on conflict (url) do update set
  name = excluded.name,
  language = excluded.language,
  niche = excluded.niche,
  seo_score = excluded.seo_score,
  pages_count = excluded.pages_count,
  keywords_count = excluded.keywords_count,
  status = excluded.status,
  last_audit_at = excluded.last_audit_at;

insert into public.activity_logs (website_id, action, description, metadata)
values
  (
    'c0000000-0000-4000-8000-000000000001',
    'audit.completed',
    'Audit inițial finalizat pentru carocakes.md',
    '{"score": 82}'::jsonb
  ),
  (
    'c0000000-0000-4000-8000-000000000002',
    'crawl.completed',
    'Crawl inițial finalizat pentru vilmgroup.md',
    '{"pages": 18}'::jsonb
  );
