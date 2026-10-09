// Connexion par lien reçu par courriel.
//
// Conception reprise d'app-triaapp (src/lib/connexion-courriel.ts et
// src/lib/frein.ts), sans Auth.js :
//
//   * Le courriel mène à une page de confirmation du site, sans effet à
//     l'ouverture ; le jeton n'est consommé que par l'envoi de son formulaire
//     (POST). Les robots des messageries ouvrent les liens, ils ne soumettent pas
//     les formulaires.
//   * Le lien est lié au navigateur qui l'a demandé : un secret aléatoire est
//     posé en cookie HttpOnly à la demande, son empreinte est gardée avec le
//     lien. Un autre navigateur ne peut pas le consommer (TriApp avertit
//     seulement ; ici on refuse).
//   * 30 minutes, usage unique.
//   * Freins tenus en base : 5 demandes par heure et par boîte (sous-adresses et
//     points Gmail confondus), 1 par minute, 20 par heure et par adresse IP, 300
//     par heure au total.

import type { Client } from "./base.ts";
import type { ConfigurationBrevo } from "./configuration.ts";
import type { Fetcher } from "./slack.ts";

export const DUREE_LIEN_S = 30 * 60;

export const FREINS = {
  boiteParHeure: 5,
  boiteParMinute: 1,
  ipParHeure: 20,
  totalParHeure: 300,
} as const;

/** Adresse normalisée, ou null si elle n'a pas la forme d'une adresse. */
export function normaliserAdresse(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const adresse = valeur.trim().toLowerCase();
  if (adresse.length > 254 || !/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(adresse)) return null;
  return adresse;
}

/** La boîte derrière une adresse : sous-adresse retirée, points ignorés chez Gmail. */
export function cleDeBoite(adresse: string): string {
  const at = adresse.lastIndexOf("@");
  let local = adresse.slice(0, at).toLowerCase();
  let domaine = adresse.slice(at + 1).toLowerCase();
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (domaine === "googlemail.com") domaine = "gmail.com";
  if (domaine === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domaine}`;
}

/**
 * Accorde un envoi si aucun frein ne s'y oppose, et l'inscrit au journal. Un
 * verrou consultatif sérialise les demandes : deux requêtes simultanées ne
 * passent pas toutes deux sous un seuil. Un refus n'écrit rien.
 */
export async function envoiAutorise(
  client: Client,
  adresse: string,
  ip: string | null,
): Promise<boolean> {
  const boite = cleDeBoite(adresse);
  await client.query("select pg_advisory_xact_lock(hashtextextended('composer.envois', 0))");
  const { rows } = await client.query<{
    total: string;
    boite_heure: string;
    boite_minute: string;
    ip_heure: string;
  }>(
    `select count(*) as total,
            count(*) filter (where boite = $1) as boite_heure,
            count(*) filter (where boite = $1 and cree_le > clock_timestamp() - interval '1 minute') as boite_minute,
            count(*) filter (where $2::text is not null and ip = $2::text) as ip_heure
       from composer.envois
      where cree_le > clock_timestamp() - interval '1 hour'`,
    [boite, ip],
  );
  const r = rows[0];
  if (
    Number(r.total) >= FREINS.totalParHeure ||
    Number(r.boite_heure) >= FREINS.boiteParHeure ||
    Number(r.boite_minute) >= FREINS.boiteParMinute ||
    (ip !== null && Number(r.ip_heure) >= FREINS.ipParHeure)
  )
    return false;
  await client.query(
    "insert into composer.envois (boite, ip, cree_le) values ($1, $2, clock_timestamp())",
    [boite, ip],
  );
  await client.query("delete from composer.envois where cree_le < now() - interval '2 hours'");
  return true;
}

const TEXTES = {
  fr: {
    sujet: "Votre lien de connexion au Constitution Composer",
    titre: "Connexion au Constitution Composer",
    corps: "Pour vous connecter, ouvrez ce lien puis confirmez d'un clic, dans le navigateur où vous l'avez demandé.",
    bouton: "Se connecter",
    validite:
      "Le lien est valable 30 minutes et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez ce courriel : personne ne peut se connecter sans l'ouvrir.",
    chemin: "/connexion/confirmer",
  },
  en: {
    sujet: "Your Constitution Composer sign-in link",
    titre: "Sign in to Constitution Composer",
    corps: "To sign in, open this link and confirm with one click, in the browser where you requested it.",
    bouton: "Sign in",
    validite:
      "The link is valid for 30 minutes and works only once. If you did not ask for it, ignore this email: nobody can sign in without opening it.",
    chemin: "/en/connexion/confirmer",
  },
} as const;

export type Langue = keyof typeof TEXTES;

/** L'adresse de la page de confirmation que porte le courriel. */
export function lienDeConfirmation(origine: string, jeton: string, langue: Langue): string {
  return `${origine}${TEXTES[langue].chemin}?jeton=${encodeURIComponent(jeton)}`;
}

/**
 * Envoi par l'API transactionnelle Brevo (modèle : app-academie, src/lib/email.ts).
 *
 * Suivi des clics : Brevo réécrit chaque lien d'un courriel transactionnel vers
 * son domaine de suivi (constaté le 05/10/2026 sur un vrai envoi), et l'API
 * n'offre aucun moyen de l'éviter pour un message : POST /v3/smtp/email n'a ni
 * paramètre ni en-tête documenté qui désactive la réécriture, et Brevo ne
 * propose pas de réglage de compte pour le transactionnel. Le seul levier
 * documenté par message est `contactPixelTrackingConsent: false` sur le
 * destinataire, qui anonymise les ouvertures et les clics (comptés dans les
 * statistiques agrégées seulement) : il est posé. Le jeton transite donc
 * encore par la redirection de Brevo. Ce qui borne l'exposition est la
 * conception du lien, pas l'envoi : la page de confirmation ne consomme rien à
 * l'ouverture, le lien est lié au navigateur demandeur (cookie HttpOnly), vaut
 * 30 minutes et sert une fois. Un jeton lu par un tiers, Brevo compris, ne
 * connecte personne sans le cookie du navigateur qui l'a demandé.
 */
export async function envoyerLien(
  config: ConfigurationBrevo,
  adresse: string,
  lien: string,
  langue: Langue,
  fetcher: Fetcher,
): Promise<boolean> {
  const t = TEXTES[langue];
  const href = lien.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  try {
    const reponse = await fetcher("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": config.cle,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: config.expediteur,
        to: [{ email: adresse, contactPixelTrackingConsent: false }],
        subject: t.sujet,
        htmlContent: `<!doctype html><html><body>
<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
<h2 style="margin-bottom:8px">${t.titre}</h2>
<p>${t.corps}</p>
<p style="margin:24px 0"><a href="${href}" style="background:#111827;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">${t.bouton}</a></p>
<p style="color:#6b7280;font-size:13px">${t.validite}</p>
</div></body></html>`,
        textContent: `${t.corps}\n\n${lien}\n\n${t.validite}`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return reponse.ok;
  } catch {
    return false;
  }
}
