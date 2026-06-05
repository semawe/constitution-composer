-- Phase B — sauvegarde de compositions + profils (pour l'écran admin).
-- À coller dans le SQL editor du projet Supabase de constitution.semawe.fr.
-- Idempotent : réexécutable sans dommage.

create extension if not exists pgcrypto;

-- Profils : miroir des infos utilisateur (Google + entreprise), lisible par
-- les admins. Alimenté par upsert côté app à la connexion.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compositions sauvegardées (≤5 par compte).
create table if not exists public.compositions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists compositions_user_idx on public.compositions(user_id);

-- E-mail admin ? (répliqué dans src/lib/admin.ts — garder synchronisé)
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') in ('contact@semawe.fr', 'admin@example.com'),
    false
  );
$$;

-- Plafond ≤5 (garde-fou serveur, en plus du contrôle applicatif).
create or replace function public.enforce_composition_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.compositions where user_id = new.user_id) >= 5 then
    raise exception 'Limite de 5 versions atteinte';
  end if;
  return new;
end;
$$;
drop trigger if exists compositions_limit on public.compositions;
create trigger compositions_limit before insert on public.compositions
  for each row execute function public.enforce_composition_limit();

-- RLS
alter table public.profiles enable row level security;
alter table public.compositions enable row level security;

-- profiles : chacun gère le sien ; les admins lisent tout.
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles
  for select using (public.is_admin());

-- compositions : chacun gère les siennes ; les admins lisent tout.
drop policy if exists compositions_own on public.compositions;
create policy compositions_own on public.compositions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists compositions_admin_read on public.compositions;
create policy compositions_admin_read on public.compositions
  for select using (public.is_admin());
