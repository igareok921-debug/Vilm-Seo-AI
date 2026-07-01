create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  website_id uuid references public.websites(id) on delete set null,
  title text not null default 'Conversație SEO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.assistant_conversations(id) on delete cascade,
  website_id uuid references public.websites(id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  website_id uuid references public.websites(id) on delete set null,
  context_snapshot_id uuid references public.assistant_context_snapshots(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists assistant_conversations_website_updated_idx
  on public.assistant_conversations(website_id, updated_at desc);

create index if not exists assistant_messages_conversation_created_idx
  on public.assistant_messages(conversation_id, created_at asc);

create index if not exists assistant_context_snapshots_conversation_created_idx
  on public.assistant_context_snapshots(conversation_id, created_at desc);

drop trigger if exists assistant_conversations_set_updated_at on public.assistant_conversations;
create trigger assistant_conversations_set_updated_at before update on public.assistant_conversations
for each row execute function public.set_updated_at();

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_context_snapshots enable row level security;

grant select on public.assistant_conversations to anon, authenticated;
grant select on public.assistant_messages to anon, authenticated;
grant select on public.assistant_context_snapshots to anon, authenticated;
grant select, insert, update, delete on public.assistant_conversations to service_role;
grant select, insert, update, delete on public.assistant_messages to service_role;
grant select, insert, update, delete on public.assistant_context_snapshots to service_role;

drop policy if exists "Conversații Copilot vizibile public" on public.assistant_conversations;
create policy "Conversații Copilot vizibile public"
on public.assistant_conversations for select
to anon, authenticated
using (true);

drop policy if exists "Mesaje Copilot vizibile public" on public.assistant_messages;
create policy "Mesaje Copilot vizibile public"
on public.assistant_messages for select
to anon, authenticated
using (true);

drop policy if exists "Snapshoturi Copilot vizibile public" on public.assistant_context_snapshots;
create policy "Snapshoturi Copilot vizibile public"
on public.assistant_context_snapshots for select
to anon, authenticated
using (true);

comment on table public.assistant_conversations is
  'Conversații ale VILM AI SEO Copilot pentru website-urile monitorizate.';

comment on table public.assistant_messages is
  'Întrebări și răspunsuri generate de AI SEO Copilot.';

comment on table public.assistant_context_snapshots is
  'Contextul SEO exact folosit înaintea fiecărui răspuns AI.';
