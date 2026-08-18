-- T&T Barateou - Etapa 6.18A
-- Estrutura inicial para substituir o Vercel Blob por Supabase/Postgres.
--
-- Execute este arquivo no Supabase:
-- SQL Editor -> New query -> cole tudo -> Run
--
-- IMPORTANTE:
-- As tabelas ficam com RLS ligado e sem policy pública.
-- O backend usará SUPABASE_SECRET_KEY, nunca o navegador.

begin;

create or replace function public.tt_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1) Token OAuth do Mercado Livre.
-- Guardaremos o envelope já criptografado pelo T&T.
create table if not exists public.tt_ml_tokens (
  provider text primary key,
  token_envelope jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists tt_ml_tokens_set_updated_at
on public.tt_ml_tokens;

create trigger tt_ml_tokens_set_updated_at
before update on public.tt_ml_tokens
for each row
execute function public.tt_set_updated_at();


-- 2) Fila de publicação.
-- item_id continua sendo a chave da entrada.
-- product_id tem índice UNIQUE parcial para impedir o mesmo produto
-- entrando novamente com outro seller/item representativo.
create table if not exists public.tt_publication_queue (
  item_id text primary key,
  product_id text,
  tt_category_id text,

  status text not null,
  priority text,
  score numeric,

  title text,
  affiliate_url text,

  payload jsonb not null default '{}'::jsonb,

  queued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists
  tt_publication_queue_product_id_unique
on public.tt_publication_queue (product_id)
where product_id is not null;

create index if not exists
  tt_publication_queue_status_idx
on public.tt_publication_queue (status);

create index if not exists
  tt_publication_queue_category_status_idx
on public.tt_publication_queue (tt_category_id, status);

create index if not exists
  tt_publication_queue_updated_at_idx
on public.tt_publication_queue (updated_at desc);

drop trigger if exists tt_publication_queue_set_updated_at
on public.tt_publication_queue;

create trigger tt_publication_queue_set_updated_at
before update on public.tt_publication_queue
for each row
execute function public.tt_set_updated_at();


-- 3) Estado pequeno do aplicativo.
-- Ex.: cursores e outros valores que antes poderiam depender de Blob.
create table if not exists public.tt_app_state (
  state_key text primary key,
  state_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists tt_app_state_set_updated_at
on public.tt_app_state;

create trigger tt_app_state_set_updated_at
before update on public.tt_app_state
for each row
execute function public.tt_set_updated_at();


-- 4) Cache normalizado das categorias do Mercado Livre.
-- Evita voltar a guardar uma árvore inteira em um único arquivo Blob.
create table if not exists public.tt_ml_categories (
  category_id text primary key,
  site_id text not null default 'MLB',
  name text not null,
  parent_id text,
  root_category_id text,
  root_category_name text,
  path jsonb not null default '[]'::jsonb,
  is_leaf boolean not null default false,
  depth integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists
  tt_ml_categories_parent_idx
on public.tt_ml_categories (parent_id);

create index if not exists
  tt_ml_categories_root_idx
on public.tt_ml_categories (root_category_id);

create index if not exists
  tt_ml_categories_site_idx
on public.tt_ml_categories (site_id);

drop trigger if exists tt_ml_categories_set_updated_at
on public.tt_ml_categories;

create trigger tt_ml_categories_set_updated_at
before update on public.tt_ml_categories
for each row
execute function public.tt_set_updated_at();


-- RLS ligado em todas as tabelas.
-- Não criamos policies para anon/publishable.
-- O backend usará a Secret key do Supabase.
alter table public.tt_ml_tokens enable row level security;
alter table public.tt_publication_queue enable row level security;
alter table public.tt_app_state enable row level security;
alter table public.tt_ml_categories enable row level security;

commit;

-- Conferência rápida:
select 'tt_ml_tokens' as table_name, count(*) as rows
from public.tt_ml_tokens
union all
select 'tt_publication_queue', count(*)
from public.tt_publication_queue
union all
select 'tt_app_state', count(*)
from public.tt_app_state
union all
select 'tt_ml_categories', count(*)
from public.tt_ml_categories;
