-- 0006_hardening.sql — durcissement issu de la revue de code adverse du 2026-08-10.
-- Idempotent : réexécutable sans dommage.
--
-- Quatre correctifs :
--   1. app_submissions : l'auteur ne peut plus insérer une soumission déjà
--      « approuvée », ni forger admin_note / reviewed_at, ni remplir la table.
--   2. Notifications Slack : formatage neutralisé (plus de <!channel>), longueurs
--      bornées, une seule notification d'organisation par compte.
--   3. keepalive() : une écriture réelle par jour au maximum, le reste no-op.
--   4. Plafond de 5 versions : verrou par utilisateur (deux insertions
--      concurrentes pouvaient passer à 6).
--
-- Note : `set search_path = ''` sur les fonctions ; pg_catalog reste toujours
-- implicitement visible, seuls les objets public./private. sont qualifiés.

-- ---------------------------------------------------------------------------
-- 1. app_submissions — l'insertion ne peut créer qu'une soumission en attente.
-- ---------------------------------------------------------------------------

drop policy if exists app_submissions_insert_own on public.app_submissions;
create policy app_submissions_insert_own on public.app_submissions
  for insert with check (
    user_id = auth.uid()
    and status = 'pending'
    and admin_note is null
    and reviewed_at is null
    and length(name) between 1 and 120
    and length(description) between 1 and 4000
    and (rationale is null or length(rationale) <= 4000)
    and (integration_point is null or length(integration_point) <= 200)
  );

-- Quota par compte : 20 soumissions, pour éviter le remplissage illimité.
create or replace function public.enforce_submission_quota()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('app_submissions:' || new.user_id::text, 0)
  );
  if (select count(*) from public.app_submissions
       where user_id = new.user_id) >= 20 then
    raise exception 'Limite de 20 soumissions atteinte';
  end if;
  return new;
end;
$$;
drop trigger if exists app_submissions_quota on public.app_submissions;
create trigger app_submissions_quota before insert on public.app_submissions
  for each row execute function public.enforce_submission_quota();

-- ---------------------------------------------------------------------------
-- 2. Slack — neutralisation du formatage et notification unique.
-- ---------------------------------------------------------------------------

-- Échappe les métacaractères mrkdwn (& < >) : les mentions <!channel>, <!here>
-- et les liens <url|texte> deviennent du texte inerte. Aplatit les sauts de
-- ligne et borne la longueur.
create or replace function private.slack_text(raw text, max_len int default 120)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(
           replace(
             replace(
               left(regexp_replace(coalesce(raw, ''), '[\r\n\t]+', ' ', 'g'),
                    max_len),
               '&', '&amp;'),
             '<', '&lt;'),
           '>', '&gt;');
$$;

-- Trace des notifications déjà émises. Dans `private`, donc hors de PostgREST
-- et hors de portée de l'utilisateur — contrairement à `profiles`, dont il
-- contrôle toutes les colonnes.
create table if not exists private.slack_notified (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  kind        text not null default 'company',
  notified_at timestamptz not null default now()
);

create or replace function private.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
begin
  display_name := private.slack_text(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, '?'), '@', 1)
  ));
  perform private.slack_notify(
    ':new: *' || display_name || '* (' ||
    private.slack_text(coalesce(new.email, '?')) ||
    ') a créé son compte sur Constitution Composer.'
  );
  return new;
end;
$$;

-- L'organisation ne notifie qu'une fois par compte : la bascule répétée
-- « vide → non vide » ne peut plus servir de robinet à notifications.
create or replace function private.on_profile_company_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted int;
begin
  if coalesce(new.company, '') = '' then
    return new;
  end if;

  insert into private.slack_notified (user_id, kind)
  values (new.id, 'company')
  on conflict (user_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return new;  -- ce compte a déjà été annoncé
  end if;

  perform private.slack_notify(
    ':office: ' ||
    private.slack_text(coalesce(new.full_name, new.email, '?')) ||
    ' (' || private.slack_text(coalesce(new.email, '?')) ||
    ') — organisation : *' || private.slack_text(new.company) || '*.'
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. keepalive() — une écriture réelle par jour, appels surnuméraires inertes.
-- ---------------------------------------------------------------------------
-- La fonction reste exécutable par `anon` (le cron GitHub Actions n'a que la
-- clé publique), mais la clause WHERE rend un martèlement sans effet : aucune
-- ligne modifiée, aucun WAL, aucun verrou tenu.

create or replace function public.keepalive()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  with touched as (
    update public.keepalive
       set last_ping = now(), ping_count = ping_count + 1
     where id = 1
       and last_ping < now() - interval '1 hour'
    returning last_ping
  )
  select coalesce(
    (select last_ping from touched),
    (select last_ping from public.keepalive where id = 1)
  );
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon;

-- ---------------------------------------------------------------------------
-- 4. Plafond de 5 versions — sérialisation par utilisateur.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_composition_limit()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  -- Sans ce verrou, deux insertions concurrentes lisent count(*) = 4 chacune
  -- avant que l'autre soit visible, et le compte finit à 6 versions.
  perform pg_advisory_xact_lock(
    hashtextextended('compositions:' || new.user_id::text, 0)
  );
  if (select count(*) from public.compositions
       where user_id = new.user_id) >= 5 then
    raise exception 'Limite de 5 versions atteinte';
  end if;
  return new;
end;
$$;
