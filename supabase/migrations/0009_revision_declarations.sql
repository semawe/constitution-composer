-- 0009_revision_declarations.sql — l'écriture d'une Déclaration devient
-- conditionnelle à sa révision.
-- Issu de la revue de code adverse du 2026-08-18 (constat élevé, vérifié).
-- À coller dans le SQL editor du projet Supabase. Idempotent : réexécutable.
--
-- Le problème : `declarations` porte une ligne par compte, et l'application
-- l'écrasait par un upsert inconditionnel. La sérialisation posée côté client le
-- 18/08 (une requête en vol au plus, la dernière valeur en attente) ne règle
-- qu'un seul onglet. À deux onglets, ou à deux appareils, le dernier arrivé
-- gagne même s'il porte un état plus ancien : la personne travaille d'un côté,
-- l'autre fenêtre finit son cycle de sauvegarde et remet en base ce qu'elle
-- avait en mémoire. Le travail de la fenêtre active disparaît, et aucune erreur
-- ne se produit — c'est ce silence qui rend le défaut grave.
--
-- Le remède : un compteur de révision par compte, et une écriture qui refuse de
-- reculer. `save_declaration()` n'écrit que si la révision proposée est
-- strictement supérieure à celle en base ; sinon elle ne touche à rien et dit où
-- la base en est. Le client lit ce verdict : accepté, il avance ; refusé, il
-- s'arrête et demande à la personne de recharger plutôt que de réessayer en
-- écrasant.
--
-- SECURITY INVOKER, donc la RLS de `declarations_own` s'applique : la fonction
-- n'ouvre aucun accès que le compte n'avait pas, et la borne de taille du
-- payload posée en 0008 continue de valoir. Corollaire assumé : cette politique
-- autorise toujours l'écriture directe de la table, donc un client qui contourne
-- la RPC contourne le garde-fou — il n'abîme alors que sa propre Déclaration. La
-- course que ce fichier ferme est celle de l'application avec elle-même.

-- ---------------------------------------------------------------------------
-- 1. Le compteur. 0 pour les Déclarations écrites avant ce fichier : la
--    première sauvegarde qui suit propose 1, et passe.
-- ---------------------------------------------------------------------------

alter table public.declarations
  add column if not exists revision bigint not null default 0;

-- Une révision négative rendrait la comparaison muette ; une révision
-- absurdement grande, proposée une fois par un client forgé, bloquerait le
-- compte contre lui-même pour toujours. Un milliard de révisions représente une
-- sauvegarde toutes les secondes et demie pendant quarante-sept ans.
alter table public.declarations
  drop constraint if exists declarations_revision_bornee;
alter table public.declarations
  add constraint declarations_revision_bornee
  check (revision between 0 and 1000000000);

-- ---------------------------------------------------------------------------
-- 2. L'écriture conditionnelle.
-- ---------------------------------------------------------------------------
-- Renvoie `{"ecrite": <bool>, "revision": <bigint>}` : ce qui a été fait, et la
-- révision que le compte porte après l'appel. Deux champs plutôt qu'un entier
-- nullable, parce qu'une écriture refusée peut rendre la même valeur que celle
-- qu'on proposait (le garde-fou est strict) et serait alors indistinguable d'un
-- succès.
--
-- `insert ... on conflict do update ... where` fait tout le travail sous un seul
-- verrou de ligne : PostgreSQL relit la version courante de la ligne avant
-- d'évaluer la clause, donc deux appels concurrents ne peuvent pas passer tous
-- les deux. Un « select la révision, puis update » laisserait entre les deux
-- exactement la fenêtre que ce fichier ferme.

create or replace function public.save_declaration(
  p_payload  jsonb,
  p_revision bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_ecrite   bigint;
  v_courante bigint;
begin
  if v_uid is null then
    raise exception 'Aucun compte connecté.';
  end if;
  if p_revision is null or p_revision <= 0 or p_revision > 1000000000 then
    raise exception 'Révision hors bornes : %', p_revision;
  end if;

  insert into public.declarations as d (user_id, payload, revision, updated_at)
  values (v_uid, p_payload, p_revision, now())
  on conflict (user_id) do update
     set payload    = excluded.payload,
         revision   = excluded.revision,
         updated_at = excluded.updated_at
   where d.revision < excluded.revision
  returning d.revision into v_ecrite;

  if v_ecrite is not null then
    return jsonb_build_object('ecrite', true, 'revision', v_ecrite);
  end if;

  -- Refusée : la ligne en base porte une révision au moins égale à celle
  -- proposée. On n'a rien écrit, et on dit où elle en est.
  select d2.revision into v_courante
    from public.declarations d2
   where d2.user_id = v_uid;
  return jsonb_build_object('ecrite', false, 'revision', v_courante);
end;
$$;

-- Seul un compte connecté écrit sa Déclaration ; `anon` n'a rien à faire ici.
revoke all on function public.save_declaration(jsonb, bigint) from public;
grant execute on function public.save_declaration(jsonb, bigint) to authenticated;

-- Contrôle après application (la colonne, sa borne, et la fonction en INVOKER) :
--   select column_name, data_type, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'declarations'
--      and column_name = 'revision';
--   select conname from pg_constraint
--    where conname = 'declarations_revision_bornee';
--   select proname, prosecdef from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'save_declaration';
--   -- prosecdef doit valoir false : SECURITY INVOKER, la RLS s'applique.
--
-- Épreuve en négatif, depuis un compte connecté (la fonction lit `auth.uid()` :
-- à jouer depuis l'application, ou avec un jeton d'accès dans l'en-tête). Deux
-- onglets, et le retardataire arrive en dernier :
--   select public.save_declaration('{"marque":"onglet A"}'::jsonb, 1);
--   -- {"ecrite": true,  "revision": 1}
--   select public.save_declaration('{"marque":"onglet B"}'::jsonb, 2);
--   -- {"ecrite": true,  "revision": 2}
--   select public.save_declaration('{"marque":"onglet A"}'::jsonb, 2);
--   -- {"ecrite": false, "revision": 2}   <- refusée, et non pas « acceptée à 2 »
--   select payload ->> 'marque', revision from public.declarations
--    where user_id = auth.uid();
--   -- doit rendre « onglet B », 2 : rien de perdu, et l'ancien n'a pas gagné.
--
-- Épreuve en négatif de la borne (doit être refusée) :
--   select public.save_declaration('{}'::jsonb, 0);
--   select public.save_declaration('{}'::jsonb, 1000000001);
