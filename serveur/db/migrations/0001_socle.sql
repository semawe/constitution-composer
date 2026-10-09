-- 0001_socle.sql — la base du Constitution Composer hors de Supabase.
--
-- Transpose les dix migrations de supabase/migrations (tâche ERP 3045) sur une
-- base « composer » du cluster PostgreSQL 15 de l'instance Sémawé. Ce qui
-- change de forme, et pourquoi :
--
--   * `auth.users` et `auth.uid()` n'existent plus. Le compte vit dans
--     `composer.comptes` ; le compte de la session est déclaré par le serveur au
--     début de chaque transaction (`set_config('composer.compte', …, true)`) et
--     relu par `composer.compte_courant()`. Les politiques de 0001 à 0003 sont
--     écrites sur ce compte déclaré.
--   * Le rôle applicatif `composer_app` n'est ni propriétaire des tables, ni
--     superutilisateur, ni BYPASSRLS : la sécurité par ligne s'applique à lui
--     sans échappatoire. Le propriétaire (rôle de migration) ne sert qu'aux
--     migrations et à l'import.
--   * Plus de rôle administrateur (écran supprimé le 19/08/2026) : les
--     politiques de lecture « admin » de 0001 à 0003 et 0007 ne sont pas reprises.
--   * La notification Slack (0005, 0006) quitte la base : pg_net n'existe pas
--     ici, le serveur l'envoie après la transaction. Le registre des annonces
--     reste en base, hors de portée de la sécurité par ligne.
--   * `keepalive()` (0004) n'est pas reprise.
--
-- Le rôle applicatif est créé à l'installation (lot 3), pas ici : une migration
-- n'a pas à poser de mot de passe.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'composer_app') then
    raise exception 'Le rôle applicatif composer_app doit exister avant la migration.';
  end if;
end;
$$;

create schema composer;
revoke all on schema composer from public;
grant usage on schema composer to composer_app;

-- ---------------------------------------------------------------------------
-- Le compte de la transaction.
-- ---------------------------------------------------------------------------
-- Null si le serveur n'en a déclaré aucun : toute politique compare alors à
-- null, et rien ne passe.
create function composer.compte_courant()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('composer.compte', true), '')::uuid;
$$;

-- ---------------------------------------------------------------------------
-- Comptes et identités. Côté connexion : le serveur cherche un compte avant de
-- savoir qui c'est, ces tables ne sont donc pas sous sécurité par ligne. Elles
-- ne portent aucun document.
-- ---------------------------------------------------------------------------

-- Un compte par adresse, en minuscules.
create table composer.comptes (
  id      uuid primary key default gen_random_uuid(),
  email   text not null unique,
  cree_le timestamptz not null default now(),
  constraint comptes_email_forme
    check (email = lower(email) and length(email) between 3 and 320)
);

-- Identité Google : (émetteur, sujet). Le compte est cherché par elle d'abord,
-- puis par adresse.
create table composer.identites_google (
  issuer    text not null,
  sujet     text not null,
  compte_id uuid not null references composer.comptes (id) on delete cascade,
  cree_le   timestamptz not null default now(),
  primary key (issuer, sujet),
  constraint identites_google_bornes
    check (length(issuer) between 1 and 200 and length(sujet) between 1 and 255)
);
create index identites_google_compte_idx on composer.identites_google (compte_id);

-- Sessions : seule l'empreinte SHA-256 du jeton est en base. Révoquer, c'est
-- supprimer la ligne.
create table composer.sessions (
  empreinte char(64) primary key,
  compte_id uuid not null references composer.comptes (id) on delete cascade,
  origine   text not null check (origine in ('google', 'lien')),
  cree_le   timestamptz not null default now(),
  expire_le timestamptz not null
);
create index sessions_compte_idx on composer.sessions (compte_id);
create index sessions_expire_idx on composer.sessions (expire_le);

-- Liens de connexion par courriel : empreinte du jeton, empreinte du secret du
-- navigateur demandeur, 30 minutes, usage unique (`utilise_le`).
create table composer.liens (
  empreinte  char(64) primary key,
  email      text not null check (length(email) between 3 and 320),
  navigateur char(64) not null,
  retour     text not null check (length(retour) between 1 and 512),
  cree_le    timestamptz not null default now(),
  expire_le  timestamptz not null,
  utilise_le timestamptz
);
create index liens_expire_idx on composer.liens (expire_le);

-- Journal des envois de liens, qui porte les freins : par boîte, par adresse
-- IP, au total. Tenu en base et non en mémoire : il survit à un redémarrage.
create table composer.envois (
  id      bigint generated always as identity primary key,
  boite   text not null,
  ip      text,
  cree_le timestamptz not null default now()
);
create index envois_cree_idx on composer.envois (cree_le);
create index envois_boite_idx on composer.envois (boite, cree_le);
create index envois_ip_idx on composer.envois (ip, cree_le);

-- Registre des annonces Slack (0006, private.slack_notified) : un compte n'est
-- annoncé qu'une fois à sa création, et son organisation qu'une fois.
create table composer.annonces_slack (
  compte_id       uuid primary key references composer.comptes (id) on delete cascade,
  inscription_le  timestamptz,
  organisation_le timestamptz
);

-- ---------------------------------------------------------------------------
-- Documents du compte : sous sécurité par ligne.
-- ---------------------------------------------------------------------------

-- Profil (0001 profiles, bornes de 0008). L'adresse reste dans `comptes`.
create table composer.profils (
  compte_id    uuid primary key references composer.comptes (id) on delete cascade,
  nom          text,
  prenom       text,
  organisation text,
  modifie_le   timestamptz not null default now(),
  constraint profils_bornes check (
    length(coalesce(nom, '')) <= 200
    and length(coalesce(prenom, '')) <= 200
    and length(coalesce(organisation, '')) <= 200
  )
);

-- Versions de la Constitution (0001 compositions, bornes de 0008).
create table composer.versions (
  id         uuid primary key default gen_random_uuid(),
  compte_id  uuid not null references composer.comptes (id) on delete cascade,
  nom        text not null,
  payload    jsonb not null,
  cree_le    timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint versions_nom_borne check (length(nom) between 1 and 120),
  -- Sur le chemin d'écriture, pg_column_size() mesure la valeur non compressée
  -- (voir 0008) : la borne ferme aussi l'abus par charge très compressible.
  constraint versions_payload_borne check (pg_column_size(payload) <= 1500000)
);
create index versions_compte_idx on composer.versions (compte_id);

-- Déclaration de Principes : une par compte (0002), révisée (0009).
create table composer.declarations (
  compte_id  uuid primary key references composer.comptes (id) on delete cascade,
  payload    jsonb not null,
  revision   bigint not null default 0,
  modifie_le timestamptz not null default now(),
  constraint declarations_revision_bornee check (revision between 0 and 1000000000),
  constraint declarations_payload_borne check (pg_column_size(payload) <= 1500000)
);

-- Propositions d'apps (0003 app_submissions). Les valeurs de `statut` restent
-- celles du client (pending, approved, rejected).
create table composer.propositions (
  id                uuid primary key default gen_random_uuid(),
  compte_id         uuid not null references composer.comptes (id) on delete cascade,
  nom               text not null,
  nature            text not null default 'app' check (nature in ('extension', 'app')),
  point_integration text,
  description       text not null,
  justification     text,
  statut            text not null default 'pending'
    check (statut in ('pending', 'approved', 'rejected')),
  note_revue        text,
  cree_le           timestamptz not null default now(),
  revue_le          timestamptz
);
create index propositions_compte_idx on composer.propositions (compte_id);

-- ---------------------------------------------------------------------------
-- Plafonds (0006) : un verrou consultatif par compte sérialise les insertions,
-- sans quoi deux créations concurrentes lisent 4 chacune et le compte finit à 6.
-- Une insertion qui reprend un identifiant déjà présent (import rejoué, voir
-- db/importer.ts) n'est pas une version de plus : elle finit en mise à jour.
-- ---------------------------------------------------------------------------

create function composer.plafond_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('composer.versions:' || new.compte_id::text, 0)
  );
  if exists (select 1 from composer.versions where id = new.id) then
    return new;
  end if;
  if (select count(*) from composer.versions
       where compte_id = new.compte_id) >= 5 then
    raise exception 'Limite de 5 versions atteinte' using errcode = 'CCLIM';
  end if;
  return new;
end;
$$;

create trigger versions_plafond
  before insert on composer.versions
  for each row execute function composer.plafond_versions();

create function composer.quota_propositions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended('composer.propositions:' || new.compte_id::text, 0)
  );
  if exists (select 1 from composer.propositions where id = new.id) then
    return new;
  end if;
  if (select count(*) from composer.propositions
       where compte_id = new.compte_id) >= 20 then
    raise exception 'Limite de 20 propositions atteinte' using errcode = 'CCQUO';
  end if;
  return new;
end;
$$;

create trigger propositions_quota
  before insert on composer.propositions
  for each row execute function composer.quota_propositions();

-- ---------------------------------------------------------------------------
-- Sécurité par ligne (0001 à 0003, 0006), sur le compte déclaré.
-- ---------------------------------------------------------------------------

alter table composer.profils enable row level security;
alter table composer.versions enable row level security;
alter table composer.declarations enable row level security;
alter table composer.propositions enable row level security;

create policy profils_propres on composer.profils
  for all to composer_app
  using (compte_id = composer.compte_courant())
  with check (compte_id = composer.compte_courant());

create policy versions_propres on composer.versions
  for all to composer_app
  using (compte_id = composer.compte_courant())
  with check (compte_id = composer.compte_courant());

create policy declarations_propres on composer.declarations
  for all to composer_app
  using (compte_id = composer.compte_courant())
  with check (compte_id = composer.compte_courant());

-- L'auteur ne crée qu'une proposition en attente, sans note ni date de revue,
-- aux longueurs bornées (0006).
create policy propositions_insertion on composer.propositions
  for insert to composer_app
  with check (
    compte_id = composer.compte_courant()
    and statut = 'pending'
    and note_revue is null
    and revue_le is null
    and length(nom) between 1 and 120
    and length(description) between 1 and 4000
    and (justification is null or length(justification) <= 4000)
    and (point_integration is null or length(point_integration) <= 200)
  );

create policy propositions_lecture on composer.propositions
  for select to composer_app
  using (compte_id = composer.compte_courant());

-- ---------------------------------------------------------------------------
-- Écriture de la Déclaration (0009 et 0010, reprises telles quelles : seul
-- `auth.uid()` devient `composer.compte_courant()`).
-- ---------------------------------------------------------------------------
-- Renvoie `{"ecrite": <bool>, "revision": <bigint>}`. SECURITY INVOKER : la
-- sécurité par ligne de `declarations_propres` s'applique.

create function composer.save_declaration(
  p_payload  jsonb,
  p_revision bigint,
  p_user_id  uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := composer.compte_courant();
  v_ecrite   bigint;
  v_courante bigint;
begin
  if v_uid is null then
    raise exception 'Aucun compte connecté.' using errcode = '42501';
  end if;
  if p_user_id is not null and p_user_id <> v_uid then
    raise exception 'Cette écriture a été préparée pour un autre compte.'
      using errcode = '42501';
  end if;
  if p_revision is null or p_revision <= 0 or p_revision > 1000000000 then
    raise exception 'Révision hors bornes : %', p_revision using errcode = '22003';
  end if;

  insert into composer.declarations as d (compte_id, payload, revision, modifie_le)
  values (v_uid, p_payload, p_revision, now())
  on conflict (compte_id) do update
     set payload    = excluded.payload,
         revision   = excluded.revision,
         modifie_le = excluded.modifie_le
   where d.revision < excluded.revision
  returning d.revision into v_ecrite;

  if v_ecrite is not null then
    return jsonb_build_object('ecrite', true, 'revision', v_ecrite);
  end if;

  select d2.revision into v_courante
    from composer.declarations d2
   where d2.compte_id = v_uid;
  return jsonb_build_object('ecrite', false, 'revision', v_courante);
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits du rôle applicatif : le strict nécessaire, rien sur le registre des
-- migrations.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema composer from public;
revoke all on all functions in schema composer from public;

grant select, insert on composer.comptes to composer_app;
grant select, insert on composer.identites_google to composer_app;
grant select, insert, update, delete on composer.sessions to composer_app;
grant select, insert, update, delete on composer.liens to composer_app;
grant select, insert, delete on composer.envois to composer_app;
grant select, insert, update on composer.annonces_slack to composer_app;
grant select, insert, update on composer.profils to composer_app;
grant select, insert, update, delete on composer.versions to composer_app;
grant select, insert, update on composer.declarations to composer_app;
grant select, insert on composer.propositions to composer_app;

grant execute on function composer.compte_courant() to composer_app;
grant execute on function composer.save_declaration(jsonb, bigint, uuid) to composer_app;
grant execute on function composer.plafond_versions() to composer_app;
grant execute on function composer.quota_propositions() to composer_app;
