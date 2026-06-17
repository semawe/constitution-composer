-- App submissions — propositions d'apps/extensions par les utilisateurs,
-- soumises depuis l'App Store et validées (ou non) par un admin.
-- Idempotent : réexécutable sans dommage. Réutilise public.is_admin().

create table if not exists public.app_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'app' check (kind in ('extension', 'app')),
  integration_point text,
  description text not null,
  rationale text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists app_submissions_user_idx
  on public.app_submissions(user_id);
create index if not exists app_submissions_status_idx
  on public.app_submissions(status);

alter table public.app_submissions enable row level security;

-- L'auteur crée et lit ses propres soumissions (compte requis).
drop policy if exists app_submissions_insert_own on public.app_submissions;
create policy app_submissions_insert_own on public.app_submissions
  for insert with check (user_id = auth.uid());

drop policy if exists app_submissions_select_own on public.app_submissions;
create policy app_submissions_select_own on public.app_submissions
  for select using (user_id = auth.uid());

-- L'admin lit toutes les soumissions et met à jour leur statut.
drop policy if exists app_submissions_admin_read on public.app_submissions;
create policy app_submissions_admin_read on public.app_submissions
  for select using (public.is_admin());

drop policy if exists app_submissions_admin_update on public.app_submissions;
create policy app_submissions_admin_update on public.app_submissions
  for update using (public.is_admin()) with check (public.is_admin());
