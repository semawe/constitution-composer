-- export-supabase.sql — export en lecture seule des comptes du Composer, au
-- format composer-export.v1 que lit db/importer.ts.
--
-- À exécuter dans l'éditeur SQL du projet Supabase (lot 5, tâche ERP 3053) ;
-- n'écrit rien. Le résultat est une seule valeur JSON, à enregistrer telle
-- quelle dans un fichier hors du dépôt (il contient des adresses).
--
-- Chaque charge voyage sous sa forme texte jsonb, avec l'empreinte SHA-256 de
-- ce texte : l'import compare cette empreinte à celle que la base cible
-- recalcule après écriture. Passer par le texte, et non par un objet JSON,
-- évite qu'un analyseur réécrive un nombre (1.10 en 1.1) et fasse diverger
-- l'empreinte sans que le document ait changé.
--
-- Non joué contre Supabase au lot 2 : la forme des tables est celle des
-- migrations 0001 à 0010 du dossier supabase/migrations.

select jsonb_build_object(
  'format', 'composer-export.v1',
  'comptes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id,
      'email', lower(u.email),
      'cree_le', u.created_at,
      'nom', coalesce(nullif(p.full_name, ''), u.raw_user_meta_data ->> 'full_name'),
      'prenom', u.raw_user_meta_data ->> 'given_name',
      'organisation', coalesce(nullif(p.company, ''), nullif(u.raw_user_meta_data ->> 'company', ''))
    ) order by u.created_at)
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.email is not null
  ), '[]'::jsonb),
  'identites_google', coalesce((
    select jsonb_agg(jsonb_build_object(
      'compte_id', i.user_id,
      'issuer', 'https://accounts.google.com',
      'sujet', i.provider_id
    ))
      from auth.identities i
     where i.provider = 'google'
  ), '[]'::jsonb),
  'declarations', coalesce((
    select jsonb_agg(jsonb_build_object(
      'compte_id', d.user_id,
      'payload', d.payload::text,
      'revision', d.revision,
      'modifie_le', d.updated_at,
      'sha256', encode(sha256(convert_to(d.payload::text, 'UTF8')), 'hex')
    ))
      from public.declarations d
  ), '[]'::jsonb),
  'versions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'compte_id', c.user_id,
      'nom', c.name,
      'payload', c.payload::text,
      'cree_le', c.created_at,
      'modifie_le', c.updated_at,
      'sha256', encode(sha256(convert_to(c.payload::text, 'UTF8')), 'hex')
    ))
      from public.compositions c
  ), '[]'::jsonb),
  'propositions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'compte_id', s.user_id,
      'nom', s.name,
      'nature', s.kind,
      'point_integration', s.integration_point,
      'description', s.description,
      'justification', s.rationale,
      'statut', s.status,
      'note_revue', s.admin_note,
      'cree_le', s.created_at,
      'revue_le', s.reviewed_at
    ))
      from public.app_submissions s
  ), '[]'::jsonb),
  'annonces_slack', coalesce((
    select jsonb_agg(jsonb_build_object(
      'compte_id', n.user_id,
      'organisation_le', n.notified_at
    ))
      from private.slack_notified n
     where n.kind = 'company'
  ), '[]'::jsonb)
) as export;
