alter table public.assistant_conversations
  drop constraint if exists assistant_conversations_website_id_key;

alter table public.assistant_reports
  alter column conversation_id drop not null;

alter table public.assistant_reports
  drop constraint if exists assistant_reports_conversation_id_fkey;

alter table public.assistant_reports
  add constraint assistant_reports_conversation_id_fkey
  foreign key (conversation_id)
  references public.assistant_conversations(id)
  on delete set null;

create index if not exists assistant_conversations_website_created_idx
  on public.assistant_conversations(website_id, created_at desc);

comment on table public.assistant_conversations is
  'Sesiuni de conversație Copilot. Un website poate avea mai multe conversații compacte în istoric.';

comment on column public.assistant_messages.metadata is
  'Metadata pentru mesaje Copilot, inclusiv reportId când răspunsul lung este salvat separat.';
