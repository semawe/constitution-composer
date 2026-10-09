// Nouvelles du Composer : consentement et liste Brevo (tâche ERP 846).
//
// La case de la connexion, facultative et non cochée, voyage avec le lien (ou
// dans l'état Google) ; le consentement n'est inscrit qu'à la connexion
// réussie, dans la transaction qui ouvre la session (migration 0002). Brevo
// est servi ensuite, hors transaction : une panne de Brevo ne fait jamais
// échouer une connexion. Ce qui n'est pas passé est repris par la relance
// périodique du processus (serveur.ts), toutes les cinq minutes.
//
// Seule l'adresse part chez Brevo, dans la liste désignée par
// BREVO_LISTE_INSCRITS : ni nom, ni organisation, ni contenu du compte.

import type { Client, Pool } from "./base.ts";
import type { ConfigurationBrevo } from "./configuration.ts";
import type { Fetcher } from "./slack.ts";

export const RELANCE_MS = 5 * 60 * 1000;
/** Au-delà, un consentement n'est plus retenté : il attend une intervention. */
export const ESSAIS_MAX = 20;
const LOT = 50;

/** Inscrit le consentement du compte déclaré ; rend vrai s'il est nouveau. */
export async function consentir(
  client: Client,
  compte: string,
  origine: "lien" | "google",
): Promise<boolean> {
  const r = await client.query(
    `insert into composer.infolettre (compte_id, origine) values ($1, $2)
     on conflict (compte_id) do nothing`,
    [compte, origine],
  );
  return r.rowCount === 1;
}

/** Ajoute l'adresse à la liste ; rend vrai si Brevo l'a acceptée. */
export async function inscrireChezBrevo(
  config: ConfigurationBrevo,
  liste: number,
  email: string,
  fetcher: Fetcher,
): Promise<boolean> {
  try {
    // updateEnabled : un contact déjà connu de Brevo rejoint la liste sans être
    // recréé. Une opposition déjà enregistrée chez Brevo n'est pas levée.
    const r = await fetcher("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": config.cle,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ email, listIds: [liste], updateEnabled: true }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Sert les consentements en attente (tous, ou celui d'un compte). Ne lève
 * jamais ; rend le nombre d'adresses acceptées par Brevo.
 */
export async function synchroniser(
  pool: Pool,
  config: ConfigurationBrevo | null,
  fetcher: Fetcher,
  journal: (evenement: string, champs?: Record<string, unknown>) => void,
  compte: string | null = null,
): Promise<number> {
  if (!config?.listeInscrits) return 0;
  let acceptees = 0;
  try {
    const { rows } = await pool.query<{ compte_id: string; email: string }>(
      `select i.compte_id, c.email
         from composer.infolettre i
         join composer.comptes c on c.id = i.compte_id
        where i.synchro_le is null and i.essais < $1
          and ($2::uuid is null or i.compte_id = $2::uuid)
        order by i.consenti_le
        limit $3`,
      [ESSAIS_MAX, compte, LOT],
    );
    for (const ligne of rows) {
      const ok = await inscrireChezBrevo(config, config.listeInscrits, ligne.email, fetcher);
      await pool.query(
        ok
          ? "update composer.infolettre set synchro_le = now(), essai_le = now() where compte_id = $1"
          : "update composer.infolettre set essais = essais + 1, essai_le = now() where compte_id = $1",
        [ligne.compte_id],
      );
      if (ok) acceptees++;
      else journal("infolettre.echec");
    }
  } catch (e) {
    journal("infolettre.erreur", { message: (e as Error).message });
  }
  return acceptees;
}
