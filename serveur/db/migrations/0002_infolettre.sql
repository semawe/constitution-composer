-- Consentement aux nouvelles du Composer (tâche ERP 846), décision d'Aliocha
-- du 09/10/2026 : une case facultative, non cochée, à la connexion ; seules les
-- personnes qui l'ont cochée rejoignent la liste Brevo « Composer — inscrits ».
--
-- Le consentement se prouve ici : date, voie de connexion par laquelle il a été
-- donné. Il ne vaut que confirmé : par la consommation du lien reçu (preuve que
-- la personne tient la boîte), ou par le retour de Google (adresse vérifiée).
-- Taper l'adresse d'un tiers et cocher la case ne l'inscrit donc pas.
--
-- Le retrait se fait par le lien de désinscription des envois Brevo : Brevo
-- tient l'opposition, et une nouvelle connexion avec la case cochée ne la lève
-- pas (le contact reste en liste noire chez Brevo).

-- La case cochée voyage avec le lien jusqu'à sa consommation.
alter table composer.liens add column infolettre boolean not null default false;

create table composer.infolettre (
  compte_id   uuid primary key references composer.comptes (id) on delete cascade,
  -- Premier consentement : une case recochée plus tard ne le déplace pas.
  consenti_le timestamptz not null default now(),
  origine     text not null check (origine in ('lien', 'google')),
  -- Envoi accepté par Brevo ; null tant qu'il reste à faire.
  synchro_le  timestamptz,
  essais      integer not null default 0,
  essai_le    timestamptz
);
create index infolettre_a_synchroniser_idx on composer.infolettre (consenti_le)
  where synchro_le is null;

grant select, insert, update on composer.infolettre to composer_app;
