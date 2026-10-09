-- 0010_identite_declarations.sql — l'écriture d'une Déclaration vérifie pour
-- quel compte elle a été préparée.
-- Issu de l'audit adverse du 2026-10-04 (constat F07, vérifié).
-- À coller dans le SQL editor du projet Supabase. Idempotent : réexécutable.
--
-- Le problème : `save_declaration()` écrit sous `auth.uid()`, c'est-à-dire sous
-- le jeton que le navigateur porte au moment de l'appel. Or une charge peut être
-- préparée sous un compte et partir sous un autre : la file d'écriture du compte
-- A, encore en attente quand la session bascule sur B dans le même onglet,
-- envoyait la Déclaration de A avec le jeton de B. La RLS n'y voit rien : B
-- écrit bien dans sa propre ligne — mais c'est le document de A qu'il y écrit.
--
-- Le remède a deux moitiés. Côté client, la file s'arrête quand son compte s'en
-- va (`arreter()`, src/lib/declaration-sync.ts). Côté base, ce fichier : le
-- client dit pour quel compte la charge a été préparée, et la fonction refuse si
-- ce n'est pas celui de la session. La seconde moitié ne dépend pas de la
-- première : elle tient même face à un client qui aurait gardé l'ancien code.
--
-- `p_user_id` est facultatif (`default null`) : un client d'avant ce fichier,
-- resté ouvert dans un onglet, continue d'écrire comme avant. Le client à jour
-- le fournit toujours. Ordre de mise en ligne indifférent — le client à jour
-- sait reconnaître une base qui n'a pas encore ce paramètre.

begin;

-- Une signature à deux paramètres et une autre à trois, dont le dernier
-- facultatif, rendraient l'appel à deux paramètres ambigu. L'ancienne part donc
-- dans la même transaction que l'arrivée de la nouvelle : à aucun instant la
-- fonction ne manque.
drop function if exists public.save_declaration(jsonb, bigint);

create or replace function public.save_declaration(
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
  v_uid      uuid := auth.uid();
  v_ecrite   bigint;
  v_courante bigint;
begin
  if v_uid is null then
    raise exception 'Aucun compte connecté.';
  end if;
  -- La charge a été préparée pour un compte ; si la session en porte un autre,
  -- on n'écrit rien. 42501 = insufficient_privilege : le client y lit un refus,
  -- pas une panne à réessayer.
  if p_user_id is not null and p_user_id <> v_uid then
    raise exception 'Cette écriture a été préparée pour un autre compte.'
      using errcode = '42501';
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
revoke all on function public.save_declaration(jsonb, bigint, uuid) from public;
grant execute on function public.save_declaration(jsonb, bigint, uuid) to authenticated;

commit;

-- PostgREST garde en mémoire la liste des fonctions : sans ce signal, la
-- nouvelle signature reste invisible de l'API jusqu'à son prochain rechargement.
notify pgrst, 'reload schema';

-- Contrôle après application (une seule fonction, à trois paramètres, INVOKER) :
--   select p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'save_declaration';
--   -- une ligne : « p_payload jsonb, p_revision bigint, p_user_id uuid », false.
--
-- Épreuve en négatif (tout est annulé par le `rollback`) ; `<uuid>` = un compte
-- de `auth.users`, `<autre>` = n'importe quel autre uuid.
--   begin;
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--            '{"sub":"<uuid>","role":"authenticated"}', true);
--
--   -- Client d'avant : deux paramètres, écrit comme avant.
--   select public.save_declaration('{"marque":"ancien client"}'::jsonb, 1);
--   -- {"ecrite": true, "revision": 1}
--   -- Client à jour, bon compte : écrit.
--   select public.save_declaration('{"marque":"A"}'::jsonb, 2, '<uuid>');
--   -- {"ecrite": true, "revision": 2}
--   -- Charge préparée pour un autre compte : doit lever, et ne rien écrire.
--   -- Le point de reprise évite que l'erreur attendue n'avorte la transaction.
--   savepoint avant_refus;
--   select public.save_declaration('{"marque":"de A, sous B"}'::jsonb, 3, '<autre>');
--   rollback to avant_refus;
--   select payload ->> 'marque', revision from public.declarations
--    where user_id = auth.uid();
--   -- « A », 2.
--   rollback;
--
-- Joué sur un PostgreSQL 16.14 jetable le 04/10/2026, avec le socle de 0002 et
-- 0009 : appliquée deux fois sans erreur, une seule fonction à trois paramètres
-- en INVOKER ; l'appel à deux paramètres écrit, l'appel pour le bon compte
-- écrit, la charge préparée pour un autre compte lève et laisse « A », 2 en
-- base, et le garde-fou de révision répond toujours `ecrite: false`.
