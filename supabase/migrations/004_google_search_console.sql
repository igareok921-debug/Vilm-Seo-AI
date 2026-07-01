create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  provider text not null check (provider in ('google_search_console')),
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked', 'error')),
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  external_property_id text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (website_id, provider)
);

create index if not exists integrations_provider_status_idx
  on public.integrations(provider, status);

drop trigger if exists integrations_set_updated_at on public.integrations;
create trigger integrations_set_updated_at before update on public.integrations
for each row execute function public.set_updated_at();

alter table public.integrations enable row level security;

grant select, insert, update, delete on public.integrations to service_role;

comment on table public.integrations is
  'Integrări externe. Tokenurile OAuth sunt criptate de aplicație înainte de salvare.';

comment on column public.integrations.external_property_id is
  'Identificatorul proprietății externe, de exemplu sc-domain:example.com.';
