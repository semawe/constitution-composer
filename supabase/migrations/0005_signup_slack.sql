-- 0005 — Notification Slack à chaque création de compte (PROMPT-328).
-- Canal cible : #constitution-composer-utilisateurs (webhook entrant Slack).
-- Le webhook n'est PAS committé : il vit dans private.app_config (clé
-- slack_signup_webhook), posée via l'API de management. Tant que la clé est
-- absente, les triggers ne font rien — aucun risque pour les inscriptions.
-- Idempotent : réexécutable sans dommage.

create extension if not exists pg_net;

-- Schéma privé : hors de l'API PostgREST (non exposé), lisible uniquement
-- par les fonctions security definer ci-dessous.
create schema if not exists private;

create table if not exists private.app_config (
  key text primary key,
  value text not null
);

-- Envoi d'un message Slack via le webhook configuré. No-op si non configuré.
-- pg_net est asynchrone : aucune latence ajoutée à l'inscription.
create or replace function private.slack_notify(message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook text;
begin
  select value into webhook
    from private.app_config
   where key = 'slack_signup_webhook';
  if webhook is null or webhook = '' then
    return;
  end if;
  perform net.http_post(
    url  := webhook,
    body := jsonb_build_object('text', message)
  );
exception when others then
  -- une notification ne doit jamais faire échouer l'inscription
  null;
end;
$$;

-- 1) Création de compte : nom + email (l'organisation n'est pas encore connue,
--    elle est demandée juste après la première connexion).
create or replace function private.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, '?'), '@', 1)
  );
  perform private.slack_notify(
    ':new: *' || display_name || '* (' || coalesce(new.email, '?') ||
    ') a créé son compte sur Constitution Composer.'
  );
  return new;
end;
$$;

drop trigger if exists notify_slack_on_signup on auth.users;
create trigger notify_slack_on_signup
  after insert on auth.users
  for each row execute function private.on_auth_user_created();

-- 2) Organisation renseignée (première fois) : complète le message initial.
create or replace function private.on_profile_company_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_company text;
begin
  if tg_op = 'INSERT' then
    old_company := '';
  else
    old_company := coalesce(old.company, '');
  end if;
  if coalesce(new.company, '') <> '' and old_company = '' then
    perform private.slack_notify(
      ':office: ' || coalesce(new.full_name, new.email, '?') ||
      ' (' || coalesce(new.email, '?') || ') — organisation : *' ||
      new.company || '*.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_slack_on_company on public.profiles;
create trigger notify_slack_on_company
  after insert or update of company on public.profiles
  for each row execute function private.on_profile_company_set();
