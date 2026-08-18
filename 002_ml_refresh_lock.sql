-- T&T Barateou - Etapa 6.18C
-- Lock de refresh OAuth do Mercado Livre.

begin;

create table if not exists public.tt_ml_refresh_locks (
  refresh_hash text primary key,
  claimed_at timestamptz not null default now()
);

create index if not exists
  tt_ml_refresh_locks_claimed_at_idx
on public.tt_ml_refresh_locks (claimed_at desc);

alter table public.tt_ml_refresh_locks
  enable row level security;

commit;

select
  'tt_ml_refresh_locks' as table_name,
  count(*) as rows
from public.tt_ml_refresh_locks;
