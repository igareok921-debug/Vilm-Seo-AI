alter table public.assistant_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

with ranked as (
  select
    id,
    website_id,
    first_value(id) over (
      partition by website_id
      order by updated_at desc nulls last, created_at desc
    ) as keep_id,
    row_number() over (
      partition by website_id
      order by updated_at desc nulls last, created_at desc
    ) as rn
  from public.assistant_conversations
  where website_id is not null
),
duplicates as (
  select id, keep_id
  from ranked
  where rn > 1
)
update public.assistant_messages as message
set conversation_id = duplicates.keep_id
from duplicates
where message.conversation_id = duplicates.id;

with ranked as (
  select
    id,
    website_id,
    first_value(id) over (
      partition by website_id
      order by updated_at desc nulls last, created_at desc
    ) as keep_id,
    row_number() over (
      partition by website_id
      order by updated_at desc nulls last, created_at desc
    ) as rn
  from public.assistant_conversations
  where website_id is not null
),
duplicates as (
  select id, keep_id
  from ranked
  where rn > 1
)
update public.assistant_context_snapshots as snapshot
set conversation_id = duplicates.keep_id
from duplicates
where snapshot.conversation_id = duplicates.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by website_id
      order by updated_at desc nulls last, created_at desc
    ) as rn
  from public.assistant_conversations
  where website_id is not null
)
delete from public.assistant_conversations
using ranked
where public.assistant_conversations.id = ranked.id
  and ranked.rn > 1;

alter table public.assistant_conversations
  drop constraint if exists assistant_conversations_website_id_key;

alter table public.assistant_conversations
  add constraint assistant_conversations_website_id_key unique (website_id);

create table if not exists public.assistant_reports (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  title text not null,
  summary text not null,
  report text not null,
  type text not null default 'seo_analysis',
  created_at timestamptz not null default now()
);

create index if not exists assistant_reports_website_created_idx
  on public.assistant_reports(website_id, created_at desc);

create index if not exists assistant_reports_conversation_created_idx
  on public.assistant_reports(conversation_id, created_at desc);

alter table public.assistant_reports enable row level security;

grant select on public.assistant_reports to anon, authenticated;
grant select, insert, update, delete on public.assistant_reports to service_role;

drop policy if exists "Rapoarte Copilot vizibile public" on public.assistant_reports;
create policy "Rapoarte Copilot vizibile public"
on public.assistant_reports for select
to anon, authenticated
using (true);

comment on table public.assistant_reports is
  'Rapoarte SEO mari generate de Copilot, salvate separat de mesajele conversaționale.';

comment on constraint assistant_conversations_website_id_key on public.assistant_conversations is
  'Fiecare website are o singură conversație permanentă în AI SEO Copilot.';
