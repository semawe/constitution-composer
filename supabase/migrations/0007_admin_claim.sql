-- 0007_admin_claim.sql — source de vérité unique pour les droits admin.
-- Idempotent : réexécutable sans dommage.
--
-- Avant : deux listes divergentes. `public.is_admin()` portait des adresses en
-- dur (la vraie barrière RLS) et `NEXT_PUBLIC_ADMIN_EMAILS`, bakée au build,
-- pilotait l'affichage. Retirer quelqu'un du front masquait le lien /admin sans
-- lui retirer quoi que ce soit : il pouvait continuer à lire `profiles`,
-- `compositions` et `declarations` en appelant l'API avec la clé anon publique.
--
-- Après : un claim `admin` dans `app_metadata`, que l'utilisateur ne peut pas
-- modifier (contrairement à `user_metadata`), porté par le JWT. La base et le
-- front lisent le même claim. Qui l'obtient est décidé en un seul endroit :
-- la table `private.admin_emails`.

-- ---------------------------------------------------------------------------
-- 1. L'allocation : une liste, en base, hors de portée de PostgREST.
-- ---------------------------------------------------------------------------

create table if not exists private.admin_emails (
  email      text primary key,
  added_at   timestamptz not null default now()
);

insert into private.admin_emails (email)
values ('aliocha@semawe.fr'), ('juliette@semawe.fr')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- 2. La synchronisation : pose le claim sur les comptes listés, le retire des
--    autres. Appelée par la migration, et à la main après tout changement de
--    la liste (`select private.sync_admin_claims();`).
-- ---------------------------------------------------------------------------

create or replace function private.sync_admin_claims()
returns table (email text, admin boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users u
     set raw_app_meta_data =
           coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"admin": true}'::jsonb
   where lower(u.email) in (select a.email from private.admin_emails a)
     and coalesce(u.raw_app_meta_data ->> 'admin', 'false') <> 'true';

  -- Révocation : un compte retiré de la liste perd le claim au prochain passage.
  update auth.users u
     set raw_app_meta_data = u.raw_app_meta_data - 'admin'
   where u.raw_app_meta_data ? 'admin'
     and lower(u.email) not in (select a.email from private.admin_emails a);

  return query
    select u.email::text,
           coalesce((u.raw_app_meta_data ->> 'admin')::boolean, false)
      from auth.users u
     where u.raw_app_meta_data ? 'admin';
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Le cas du compte qui n'existe pas encore. Avec l'ancienne liste en dur,
--    une adresse admin devenait admin dès sa première connexion. Ce trigger
--    conserve ce confort : le claim est posé à l'inscription si l'adresse est
--    dans l'allocation.
-- ---------------------------------------------------------------------------

create or replace function private.grant_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.admin_emails a
              where a.email = lower(new.email)) then
    new.raw_app_meta_data :=
      coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"admin": true}'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists grant_admin_on_signup on auth.users;
create trigger grant_admin_on_signup
  before insert on auth.users
  for each row execute function private.grant_admin_on_signup();

-- ---------------------------------------------------------------------------
-- 4. La barrière RLS lit le claim, et rien d'autre.
-- ---------------------------------------------------------------------------
-- `app_metadata` n'est modifiable qu'avec la clé service_role : un utilisateur
-- ne peut pas se l'attribuer, contrairement à `user_metadata` qu'il contrôle.

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'admin')::boolean,
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. Application aux comptes existants. En dernier : tant que cette ligne n'a
--    pas tourné, `is_admin()` renvoie false pour tout le monde.
-- ---------------------------------------------------------------------------

select private.sync_admin_claims();
