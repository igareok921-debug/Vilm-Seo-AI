alter table public.websites
  drop constraint if exists websites_status_check;

alter table public.websites
  add constraint websites_status_check
  check (status in ('Active', 'Attention', 'Analyzing', 'Activ', 'Atenție', 'Se analizează'));

alter table public.websites
  alter column status set default 'Analyzing';

update public.websites
set status = case status
  when 'Activ' then 'Active'
  when 'Atenție' then 'Attention'
  when 'Se analizează' then 'Analyzing'
  else status
end
where status in ('Activ', 'Atenție', 'Se analizează');

comment on constraint websites_status_check on public.websites is
  'Website status values support the English UI while keeping Romanian legacy rows compatible.';
