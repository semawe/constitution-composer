-- 0008_bornes.sql — bornes de taille sur ce qu'un compte peut écrire.
-- Issu de la revue de code adverse du 2026-08-18 (constat élevé, vérifié).
-- À coller dans le SQL editor du projet Supabase. Idempotent : réexécutable.
--
-- Le problème : ni `compositions.payload`, ni `declarations.payload`, ni les
-- champs de `profiles` n'étaient bornés. La RLS autorise chaque compte à écrire
-- ses propres lignes, et PostgREST est joignable directement avec la clé anonyme
-- publique : rien n'empêchait un compte d'y déposer cinq compositions et une
-- Déclaration de plusieurs mégaoctets, remplissant le quota de la base et
-- l'egress du projet. Le plafond de cinq versions bornait le nombre, pas la
-- taille.
--
-- Les valeurs : 1,5 Mo par payload laisse largement la place à un logo en data
-- URL redimensionné (quelques dizaines de kilo-octets) et à un texte de valeurs
-- long, tout en fermant l'abus. `pg_column_size()` mesure la représentation
-- stockée (TOAST comprise), c'est-à-dire ce qui coûte réellement.

-- Compositions : nom et payload.
alter table public.compositions
  drop constraint if exists compositions_name_size;
alter table public.compositions
  add constraint compositions_name_size
  check (length(name) between 1 and 120);

alter table public.compositions
  drop constraint if exists compositions_payload_size;
alter table public.compositions
  add constraint compositions_payload_size
  check (pg_column_size(payload) <= 1500000);

-- Déclarations : une par compte, mais rien n'en bornait le poids.
alter table public.declarations
  drop constraint if exists declarations_payload_size;
alter table public.declarations
  add constraint declarations_payload_size
  check (pg_column_size(payload) <= 1500000);

-- Profils : miroir alimenté par l'application, donc écrit par le compte lui-même.
-- 320 caractères est la longueur maximale d'une adresse électronique (RFC 5321).
alter table public.profiles
  drop constraint if exists profiles_fields_size;
alter table public.profiles
  add constraint profiles_fields_size
  check (
    length(coalesce(email, '')) <= 320
    and length(coalesce(full_name, '')) <= 200
    and length(coalesce(company, '')) <= 200
  );

-- Contrôle après application (doit renvoyer les quatre contraintes) :
--   select conname, conrelid::regclass
--     from pg_constraint
--    where conname in (
--            'compositions_name_size', 'compositions_payload_size',
--            'declarations_payload_size', 'profiles_fields_size');
--
-- Épreuve en négatif, depuis un compte connecté (doit être refusée) :
--   insert into public.compositions (user_id, name, payload)
--   values (auth.uid(), 'trop gros', jsonb_build_object('x', repeat('a', 2000000)));
