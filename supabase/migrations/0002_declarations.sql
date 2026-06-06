-- Rattache la Déclaration de Principes au compte (une par utilisateur), pour la
-- retrouver sur tout appareil et la rendre visible côté admin.
-- À coller dans le SQL editor du projet Supabase. Idempotent.

create table if not exists public.declarations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.declarations enable row level security;

-- Chacun gère la sienne ; les admins lisent tout.
drop policy if exists declarations_own on public.declarations;
create policy declarations_own on public.declarations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists declarations_admin_read on public.declarations;
create policy declarations_admin_read on public.declarations
  for select using (public.is_admin());
