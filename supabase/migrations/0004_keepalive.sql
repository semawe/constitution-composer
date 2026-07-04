-- 0004_keepalive.sql
-- Keep-alive plan Free Supabase.
--
-- Le plan Free met en pause les projets sans activité base pendant >7 jours.
-- Constat (2026-06-26 puis 2026-07-03) : un simple GET REST en lecture
-- (`/rest/v1/profiles?limit=1` via l'anon key) ne compte PAS comme « activité
-- suffisante » pour le scan de Supabase — le projet a été pausé, puis re-listé,
-- malgré le ping quotidien HTTP 200. Une ÉCRITURE est une activité non ambiguë.
--
-- Ce module expose une fonction RPC `keepalive()` que le cron GitHub Actions
-- appelle une fois par jour via POST /rest/v1/rpc/keepalive avec l'anon key.
-- Elle fait un UPDATE réel sur une table dédiée, sans exposer cette table.

create table if not exists public.keepalive (
  id         smallint primary key default 1,
  last_ping  timestamptz not null default now(),
  ping_count bigint not null default 0,
  constraint keepalive_singleton check (id = 1)
);

insert into public.keepalive (id) values (1) on conflict (id) do nothing;

-- RLS activé sans aucune policy => table totalement inaccessible en direct via
-- PostgREST (anon comme authenticated). Seule la fonction SECURITY DEFINER
-- ci-dessous, qui s'exécute avec les droits du propriétaire, peut y écrire.
alter table public.keepalive enable row level security;

create or replace function public.keepalive()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.keepalive
     set last_ping = now(), ping_count = ping_count + 1
   where id = 1
  returning last_ping;
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon;
