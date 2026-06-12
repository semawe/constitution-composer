-- Déclaration de Principes rattachée au compte (une par utilisateur).
-- Schéma reconstitué depuis la prod le 2026-06-12 (le fichier était resté
-- vide alors que la table existait — appliquée à la main à l'époque).
-- Idempotent : réexécutable sans dommage.

create table if not exists public.declarations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.declarations enable row level security;

-- declarations : chacun gère la sienne ; les admins lisent tout.
drop policy if exists declarations_own on public.declarations;
create policy declarations_own on public.declarations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists declarations_admin_read on public.declarations;
create policy declarations_admin_read on public.declarations
  for select using (public.is_admin());
