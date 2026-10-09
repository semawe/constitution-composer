// Les routes du service, écrites sur Request et Response standard.
//
// Chaque route sert une méthode du port du client (src/lib/service.ts) ; la
// table de correspondance est dans le compte rendu du lot 2 (tâche ERP 3050).
//
// Règles communes :
//   * toutes les mutations en POST (le pare-feu de l'instance bloque PATCH et
//     DELETE), toutes sous garde d'origine ;
//   * réponses JSON, `cache-control: no-store` ;
//   * chaque réponse liée à un compte porte son identifiant (`compte`) ;
//   * chaque écriture dit pour quel compte elle a été préparée (`compte` dans le
//     corps) : si la session en porte un autre, 403 et rien n'est écrit.

import { randomBytes } from "node:crypto";
import type { JWTVerifyGetKey } from "jose";
import {
  codeSql,
  contrainteSql,
  empreinte,
  enTransaction,
  jetonAleatoire,
  type Pool,
} from "./base.ts";
import {
  compteParAdresse,
  compteParGoogle,
  DUREE_SESSION_S,
  fermerSession,
  lireCompte,
  lireSession,
  ouvrirSession,
  type Compte,
} from "./comptes.ts";
import type { Configuration } from "./configuration.ts";
import {
  CHEMIN_RETOUR_GOOGLE,
  creerEtat,
  DUREE_ETAT_S,
  echangerCode,
  lireEtat,
  signerEtat,
  urlAutorisation,
  verifierJeton,
} from "./google.ts";
import {
  cheminLocal,
  cookie,
  effacerCookie,
  erreur,
  estUuid,
  gardeOrigine,
  json,
  lireCookie,
  lireFormulaire,
  lireJson,
  nomCookie,
  redirection,
} from "./http.ts";
import {
  DUREE_LIEN_S,
  envoiAutorise,
  envoyerLien,
  lienDeConfirmation,
  normaliserAdresse,
  type Langue,
} from "./lien.ts";
import { consentir, synchroniser } from "./infolettre.ts";
import { logoAdmis } from "./logo.ts";
import { referenceConnue } from "./releases.ts";
import {
  messageInscription,
  messageOrganisation,
  publierSlack,
  type Fetcher,
} from "./slack.ts";

export interface Dependances {
  pool: Pool;
  config: Configuration;
  /** Appels sortants : Brevo, Slack, échange du code Google. Doublé en test. */
  fetcher: Fetcher;
  /** Clés publiques de Google. Doublées en test. */
  clesGoogle: JWTVerifyGetKey;
  journal?: (evenement: string, champs?: Record<string, unknown>) => void;
}

export interface InfoRequete {
  /** Adresse du client telle que nginx la transmet (X-Real-IP), ou null. */
  ip: string | null;
}

export type Gestionnaire = (requete: Request, info?: InfoRequete) => Promise<Response>;

const RE_JETON_LIEN = /^[A-Za-z0-9_-]{43}$/;
const RE_SECRET_NAVIGATEUR = /^[A-Za-z0-9_-]{32}$/;
const RETOUR_PAR_DEFAUT = "/composer";

class Refus extends Error {
  reponse: Response;
  constructor(reponse: Response) {
    super("refus");
    this.reponse = reponse;
  }
}

export function creerApplication(deps: Dependances): Gestionnaire {
  const { pool, config, fetcher } = deps;
  const journal =
    deps.journal ??
    ((evenement: string, champs: Record<string, unknown> = {}) =>
      console.log(JSON.stringify({ t: new Date().toISOString(), evenement, ...champs })));

  const COOKIE_SESSION = nomCookie("cc_session", config.origine);
  const COOKIE_LIEN = nomCookie("cc_lien", config.origine);
  const COOKIE_OIDC = nomCookie("cc_oidc", config.origine);
  const redirectUriGoogle = `${config.origine}${CHEMIN_RETOUR_GOOGLE}`;

  // -------------------------------------------------------------------------
  // Session et écritures
  // -------------------------------------------------------------------------

  interface Session {
    compte: string;
    cookies: string[];
  }

  async function exigerSession(requete: Request): Promise<Session> {
    const jeton = lireCookie(requete, COOKIE_SESSION);
    const lue = await lireSession(pool, jeton);
    if (!lue) throw new Refus(erreur(401, "AUTH", jeton ? [effacerCookie(COOKIE_SESSION, config.origine)] : []));
    return {
      compte: lue.compte,
      cookies: lue.prolongee && jeton ? [cookie(COOKIE_SESSION, jeton, DUREE_SESSION_S, config.origine)] : [],
    };
  }

  /** Garde d'origine, session, corps JSON, et compte destinataire. */
  async function exigerEcriture(
    requete: Request,
  ): Promise<{ session: Session; corps: Record<string, unknown> }> {
    const refus = gardeOrigine(requete, config.origine);
    if (refus) throw new Refus(refus);
    const session = await exigerSession(requete);
    const corps = await lireJson(requete);
    if (!corps) throw new Refus(erreur(422, "INVALIDE"));
    if (corps.compte !== session.compte) throw new Refus(erreur(403, "COMPTE"));
    return { session, corps };
  }

  function avecCookies(reponse: Response, cookies: string[]): Response {
    for (const c of cookies) reponse.headers.append("set-cookie", c);
    return reponse;
  }

  function traduireErreurSql(e: unknown): Response | null {
    switch (codeSql(e)) {
      case "CCLIM":
        return erreur(409, "LIMIT");
      case "CCQUO":
        return erreur(409, "QUOTA");
      case "42501":
        return erreur(403, "COMPTE");
      case "23514":
        return /payload_borne$/.test(contrainteSql(e) ?? "")
          ? erreur(413, "TROP_GROS")
          : erreur(422, "INVALIDE");
      case "22003":
      case "22P02":
      case "54000":
        return erreur(422, "INVALIDE");
      default:
        return null;
    }
  }

  async function annoncer(message: string): Promise<void> {
    await publierSlack(config.slack, message, fetcher, journal);
  }

  // -------------------------------------------------------------------------
  // Santé et session
  // -------------------------------------------------------------------------

  async function sante(): Promise<Response> {
    try {
      await pool.query("select exists (select 1 from composer.comptes) as lu");
      return json(200, { ok: true });
    } catch (e) {
      journal("sante.echec", { message: (e as Error).message });
      return json(503, { ok: false });
    }
  }

  async function session(requete: Request): Promise<Response> {
    const jeton = lireCookie(requete, COOKIE_SESSION);
    const lue = await lireSession(pool, jeton);
    if (!lue)
      return json(200, { compte: null }, jeton ? [effacerCookie(COOKIE_SESSION, config.origine)] : []);
    const compte = await enTransaction(pool, lue.compte, (c) => lireCompte(c, lue.compte));
    const cookies =
      lue.prolongee && jeton ? [cookie(COOKIE_SESSION, jeton, DUREE_SESSION_S, config.origine)] : [];
    return json(200, { compte }, cookies);
  }

  async function sortie(requete: Request): Promise<Response> {
    const refus = gardeOrigine(requete, config.origine);
    if (refus) return refus;
    await fermerSession(pool, lireCookie(requete, COOKIE_SESSION));
    return json(200, { ok: true }, [effacerCookie(COOKIE_SESSION, config.origine)]);
  }

  // -------------------------------------------------------------------------
  // Lien par courriel
  // -------------------------------------------------------------------------

  async function demanderLien(requete: Request, info: InfoRequete): Promise<Response> {
    const refus = gardeOrigine(requete, config.origine);
    if (refus) return refus;
    const corps = await lireJson(requete);
    const adresse = normaliserAdresse(corps?.email);
    if (!corps || !adresse) return json(422, { ok: false, erreur: "INVALIDE" });
    if (!config.brevo) return json(503, { ok: false, erreur: "INDISPONIBLE" });
    const retour = cheminLocal(corps.retour) ?? RETOUR_PAR_DEFAUT;
    const langue: Langue = corps.langue === "en" ? "en" : "fr";
    const infolettre = corps.infolettre === true;

    // Un navigateur qui redemande garde son secret : ses liens précédents
    // restent valables jusqu'à leur échéance.
    const existant = lireCookie(requete, COOKIE_LIEN);
    const secret =
      existant && RE_SECRET_NAVIGATEUR.test(existant)
        ? existant
        : randomBytes(24).toString("base64url");
    const jeton = jetonAleatoire();

    const accorde = await enTransaction(pool, null, async (c) => {
      if (!(await envoiAutorise(c, adresse, info.ip))) return false;
      await c.query(
        `insert into composer.liens (empreinte, email, navigateur, retour, infolettre, expire_le)
         values ($1, $2, $3, $4, $5, now() + make_interval(secs => $6))`,
        [empreinte(jeton), adresse, empreinte(secret), retour, infolettre, DUREE_LIEN_S],
      );
      await c.query("delete from composer.liens where expire_le < now() - interval '1 day'");
      return true;
    });
    // La réponse ne dit jamais si un compte existe pour cette adresse : le
    // compte n'est créé qu'à la consommation du lien.
    if (!accorde) return json(429, { ok: false, erreur: "FREIN" });

    const envoye = await envoyerLien(
      config.brevo,
      adresse,
      lienDeConfirmation(config.origine, jeton, langue),
      langue,
      fetcher,
    );
    if (!envoye) {
      journal("lien.envoi_echec");
      return json(502, { ok: false, erreur: "ENVOI" });
    }
    return json(202, { ok: true }, [cookie(COOKIE_LIEN, secret, DUREE_LIEN_S, config.origine)]);
  }

  async function consommerLien(requete: Request): Promise<Response> {
    const formulaire = await lireFormulaire(requete.clone());
    const enFormulaire = formulaire !== null;
    const langue: Langue = formulaire?.get("langue") === "en" ? "en" : "fr";
    const echec = (statut: number, code: "ORIGINE" | "INVALIDE" | "LIEN_INVALIDE" | "NAVIGATEUR") =>
      enFormulaire
        ? redirection(`${langue === "en" ? "/en" : ""}/connexion/confirmer?erreur=${code}`)
        : erreur(statut, code);

    if (gardeOrigine(requete, config.origine)) return echec(403, "ORIGINE");
    const jeton = enFormulaire ? formulaire.get("jeton") : (await lireJson(requete))?.jeton;
    if (typeof jeton !== "string" || !RE_JETON_LIEN.test(jeton)) return echec(422, "INVALIDE");
    const secret = lireCookie(requete, COOKIE_LIEN);

    type Issue =
      | { refus: "LIEN_INVALIDE" | "NAVIGATEUR" }
      | {
          refus?: undefined;
          compte: Compte;
          session: string;
          retour: string;
          annoncer: boolean;
          consentement: boolean;
        };
    const issue = await enTransaction(pool, null, async (c): Promise<Issue> => {
      const { rows } = await c.query<{
        email: string;
        navigateur: string;
        retour: string;
        infolettre: boolean;
        valide: boolean;
      }>(
        `select email, navigateur, retour, infolettre,
                (utilise_le is null and expire_le > now()) as valide
           from composer.liens where empreinte = $1 for update`,
        [empreinte(jeton)],
      );
      const lien = rows[0];
      if (!lien || !lien.valide) return { refus: "LIEN_INVALIDE" };
      // Un autre navigateur ne consomme pas le lien : il reste au demandeur.
      if (!secret || !RE_SECRET_NAVIGATEUR.test(secret) || empreinte(secret) !== lien.navigateur)
        return { refus: "NAVIGATEUR" };
      await c.query("update composer.liens set utilise_le = now() where empreinte = $1", [
        empreinte(jeton),
      ]);
      const rattachement = await compteParAdresse(c, lien.email);
      const session = await ouvrirSession(c, rattachement.id, "lien");
      const compte = (await lireCompte(c, rattachement.id)) as Compte;
      const consentement = lien.infolettre && (await consentir(c, rattachement.id, "lien"));
      return { compte, session, retour: lien.retour, annoncer: rattachement.annoncer, consentement };
    });

    if (issue.refus) return echec(issue.refus === "NAVIGATEUR" ? 403 : 410, issue.refus);
    if (issue.annoncer) await annoncer(messageInscription(issue.compte.nom, issue.compte.email));
    if (issue.consentement) await synchroniser(pool, config.brevo, fetcher, journal, issue.compte.id);
    const cookies = [
      cookie(COOKIE_SESSION, issue.session, DUREE_SESSION_S, config.origine),
      effacerCookie(COOKIE_LIEN, config.origine),
    ];
    return enFormulaire
      ? redirection(issue.retour, cookies)
      : json(200, { compte: issue.compte, retour: issue.retour }, cookies);
  }

  // -------------------------------------------------------------------------
  // Google
  // -------------------------------------------------------------------------

  async function partirChezGoogle(url: URL): Promise<Response> {
    if (!config.google) return erreur(503, "INDISPONIBLE");
    const etat = creerEtat(
      cheminLocal(url.searchParams.get("retour")) ?? RETOUR_PAR_DEFAUT,
      url.searchParams.get("infolettre") === "1",
    );
    return redirection(urlAutorisation(config.google, redirectUriGoogle, etat).toString(), [
      cookie(COOKIE_OIDC, await signerEtat(etat, config.secrets), DUREE_ETAT_S, config.origine),
    ]);
  }

  async function retourDeGoogle(requete: Request, url: URL): Promise<Response> {
    const sansEtat = effacerCookie(COOKIE_OIDC, config.origine);
    const etat = await lireEtat(
      lireCookie(requete, COOKIE_OIDC),
      url.searchParams.get("state"),
      config.secrets,
    );
    const echec = (motif: string) => {
      journal("google.echec", { motif });
      return redirection(`${etat?.retour ?? RETOUR_PAR_DEFAUT}#connexion-echouee`, [sansEtat]);
    };
    if (!config.google) return echec("non configuré");
    if (!etat) return echec("état absent ou invalide");
    const code = url.searchParams.get("code");
    if (!code || url.searchParams.get("error")) return echec("code absent");

    let identite;
    try {
      const jeton = await echangerCode(config.google, redirectUriGoogle, code, etat.verifier, fetcher);
      identite = await verifierJeton(config.google, jeton, etat.nonce, deps.clesGoogle);
    } catch (e) {
      return echec((e as Error).message);
    }
    const issue = await enTransaction(pool, null, async (c) => {
      const rattachement = await compteParGoogle(c, identite);
      const session = await ouvrirSession(c, rattachement.id, "google");
      const compte = (await lireCompte(c, rattachement.id)) as Compte;
      const consentement = etat.infolettre && (await consentir(c, rattachement.id, "google"));
      return { compte, session, annoncer: rattachement.annoncer, consentement };
    });
    if (issue.annoncer) await annoncer(messageInscription(issue.compte.nom, issue.compte.email));
    if (issue.consentement) await synchroniser(pool, config.brevo, fetcher, journal, issue.compte.id);
    return redirection(etat.retour, [
      sansEtat,
      cookie(COOKIE_SESSION, issue.session, DUREE_SESSION_S, config.origine),
    ]);
  }

  // -------------------------------------------------------------------------
  // Profil
  // -------------------------------------------------------------------------

  async function profil(requete: Request): Promise<Response> {
    const { session, corps } = await exigerEcriture(requete);
    const champs: Record<"nom" | "prenom" | "organisation", string | null | undefined> = {
      nom: undefined,
      prenom: undefined,
      organisation: undefined,
    };
    for (const cle of Object.keys(champs) as (keyof typeof champs)[]) {
      const v = corps[cle];
      if (v === undefined) continue;
      if (v !== null && (typeof v !== "string" || v.trim().length > 200))
        return erreur(422, "INVALIDE");
      champs[cle] = typeof v === "string" && v.trim() ? v.trim() : null;
    }
    const issue = await enTransaction(pool, session.compte, async (c) => {
      await c.query(
        "insert into composer.profils (compte_id) values ($1) on conflict (compte_id) do nothing",
        [session.compte],
      );
      await c.query(
        `update composer.profils
            set nom = case when $2 then $3 else nom end,
                prenom = case when $4 then $5 else prenom end,
                organisation = case when $6 then $7 else organisation end,
                modifie_le = now()
          where compte_id = $1`,
        [
          session.compte,
          champs.nom !== undefined,
          champs.nom ?? null,
          champs.prenom !== undefined,
          champs.prenom ?? null,
          champs.organisation !== undefined,
          champs.organisation ?? null,
        ],
      );
      let annoncer = false;
      if (champs.organisation) {
        // Une seule annonce d'organisation par compte (0006) : la bascule
        // vide puis non vide ne sert pas de robinet à notifications.
        const r = await c.query(
          `insert into composer.annonces_slack as a (compte_id, organisation_le) values ($1, now())
           on conflict (compte_id) do update set organisation_le = now()
            where a.organisation_le is null
           returning compte_id`,
          [session.compte],
        );
        annoncer = r.rowCount === 1;
      }
      return { compte: (await lireCompte(c, session.compte)) as Compte, annoncer };
    });
    if (issue.annoncer && issue.compte.organisation)
      await annoncer(
        messageOrganisation(issue.compte.nom, issue.compte.email, issue.compte.organisation),
      );
    return avecCookies(json(200, { compte: issue.compte }), session.cookies);
  }

  // -------------------------------------------------------------------------
  // Versions
  // -------------------------------------------------------------------------

  const SELECT_VERSION =
    "id, nom as name, payload, to_char(modifie_le at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as updated_at";

  function nomDeVersion(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const nom = v.trim();
    return nom.length >= 1 && nom.length <= 120 ? nom : null;
  }

  /** La charge d'une version, si sa référence de contenu est connue ; sinon le refus. */
  function chargeDeVersion(v: unknown): Record<string, unknown> | Response {
    if (!v || typeof v !== "object" || Array.isArray(v)) return erreur(422, "INVALIDE");
    const payload = v as Record<string, unknown>;
    if (!referenceConnue(config.manifeste, payload.content, "constitution"))
      return erreur(422, "REFERENCE");
    // Le pare-feu ne lit plus ce champ (règle d'exclusion du vhost) : c'est ici
    // qu'il est contrôlé, avec la règle de safeLogo() du client.
    if (!logoAdmis(payload.logo)) return erreur(422, "LOGO");
    return payload;
  }

  async function listerVersions(requete: Request): Promise<Response> {
    const session = await exigerSession(requete);
    const versions = await enTransaction(pool, session.compte, async (c) =>
      (await c.query(`select ${SELECT_VERSION} from composer.versions order by modifie_le desc`)).rows,
    );
    return avecCookies(json(200, { compte: session.compte, versions }), session.cookies);
  }

  async function creerVersion(requete: Request): Promise<Response> {
    const { session, corps } = await exigerEcriture(requete);
    const nom = nomDeVersion(corps.nom);
    if (!nom) return erreur(422, "INVALIDE");
    const payload = chargeDeVersion(corps.payload);
    if (payload instanceof Response) return payload;
    const version = await enTransaction(pool, session.compte, async (c) =>
      (
        await c.query(
          `insert into composer.versions (compte_id, nom, payload) values ($1, $2, $3::jsonb)
           returning ${SELECT_VERSION}`,
          [session.compte, nom, JSON.stringify(payload)],
        )
      ).rows[0],
    );
    return avecCookies(json(201, { compte: session.compte, version }), session.cookies);
  }

  async function modifierVersion(
    requete: Request,
    id: string,
    action: "renommer" | "remplacer" | "supprimer",
  ): Promise<Response> {
    const { session, corps } = await exigerEcriture(requete);
    let sql: string;
    let params: unknown[];
    if (action === "renommer") {
      const nom = nomDeVersion(corps.nom);
      if (!nom) return erreur(422, "INVALIDE");
      sql = "update composer.versions set nom = $2, modifie_le = now() where id = $1";
      params = [id, nom];
    } else if (action === "remplacer") {
      // Figer une version sur un texte, c'est inscrire une référence : elle est
      // validée comme à la création.
      const payload = chargeDeVersion(corps.payload);
      if (payload instanceof Response) return payload;
      sql = "update composer.versions set payload = $2::jsonb, modifie_le = now() where id = $1";
      params = [id, JSON.stringify(payload)];
    } else {
      sql = "delete from composer.versions where id = $1";
      params = [id];
    }
    // La sécurité par ligne rend invisibles les versions d'un autre compte :
    // elles sont introuvables, pas interdites.
    const touchees = await enTransaction(pool, session.compte, async (c) =>
      (await c.query(sql, params)).rowCount,
    );
    if (!touchees) return avecCookies(erreur(404, "INTROUVABLE"), session.cookies);
    return avecCookies(json(200, { compte: session.compte, ok: true }), session.cookies);
  }

  // -------------------------------------------------------------------------
  // Déclaration
  // -------------------------------------------------------------------------

  async function lireDeclaration(requete: Request, url: URL): Promise<Response> {
    const session = await exigerSession(requete);
    const demande = url.searchParams.get("compte");
    if (demande !== null && demande !== session.compte) return erreur(403, "COMPTE");
    const ligne = await enTransaction(pool, session.compte, async (c) =>
      (
        await c.query<{ payload: unknown; revision: string }>(
          "select payload, revision from composer.declarations where compte_id = $1",
          [session.compte],
        )
      ).rows[0],
    );
    const declaration = ligne ? { payload: ligne.payload, revision: Number(ligne.revision) } : null;
    return avecCookies(json(200, { compte: session.compte, declaration }), session.cookies);
  }

  async function ecrireDeclaration(requete: Request): Promise<Response> {
    const { session, corps } = await exigerEcriture(requete);
    const { payload, revision } = corps;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return erreur(422, "INVALIDE");
    if (typeof revision !== "number" || !Number.isInteger(revision)) return erreur(422, "INVALIDE");
    const verdict = await enTransaction(pool, session.compte, async (c) =>
      (
        await c.query<{ r: { ecrite: boolean; revision: number } }>(
          "select composer.save_declaration($1::jsonb, $2::bigint, $3::uuid) as r",
          [JSON.stringify(payload), revision, session.compte],
        )
      ).rows[0].r,
    );
    // Lisible tel quel par `verdict()` (src/lib/declaration-sync.ts).
    return avecCookies(
      json(200, { compte: session.compte, ecrite: verdict.ecrite, revision: Number(verdict.revision) }),
      session.cookies,
    );
  }

  // -------------------------------------------------------------------------
  // Propositions
  // -------------------------------------------------------------------------

  const SELECT_PROPOSITION = `id, compte_id as user_id, nom as name, nature as kind,
    point_integration as integration_point, description, justification as rationale,
    statut as status, note_revue as admin_note,
    to_char(cree_le at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
    to_char(revue_le at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as reviewed_at`;

  async function listerPropositions(requete: Request): Promise<Response> {
    const session = await exigerSession(requete);
    const propositions = await enTransaction(pool, session.compte, async (c) =>
      (await c.query(`select ${SELECT_PROPOSITION} from composer.propositions order by cree_le desc`)).rows,
    );
    return avecCookies(json(200, { compte: session.compte, propositions }), session.cookies);
  }

  function texteBorne(v: unknown, min: number, max: number): string | null | false {
    if (v === undefined || v === null || v === "") return min === 0 ? null : false;
    if (typeof v !== "string") return false;
    const t = v.trim();
    if (t.length < Math.max(min, 1)) return min === 0 ? null : false;
    return t.length <= max ? t : false;
  }

  async function creerProposition(requete: Request): Promise<Response> {
    const { session, corps } = await exigerEcriture(requete);
    const nom = texteBorne(corps.name, 1, 120);
    const description = texteBorne(corps.description, 1, 4000);
    const justification = texteBorne(corps.rationale, 0, 4000);
    const point = texteBorne(corps.integrationPoint, 0, 200);
    const nature = corps.kind ?? "app";
    if (!nom || !description || justification === false || point === false) return erreur(422, "INVALIDE");
    if (nature !== "app" && nature !== "extension") return erreur(422, "INVALIDE");
    // Le statut, la note et la date de revue ne viennent jamais du corps : la
    // base les impose, et sa politique refuse toute autre valeur (0006).
    const proposition = await enTransaction(pool, session.compte, async (c) =>
      (
        await c.query(
          `insert into composer.propositions
             (compte_id, nom, nature, point_integration, description, justification)
           values ($1, $2, $3, $4, $5, $6) returning ${SELECT_PROPOSITION}`,
          [session.compte, nom, nature, point, description, justification],
        )
      ).rows[0],
    );
    return avecCookies(json(201, { compte: session.compte, proposition }), session.cookies);
  }

  // -------------------------------------------------------------------------
  // Aiguillage
  // -------------------------------------------------------------------------

  return async function gerer(requete: Request, info: InfoRequete = { ip: null }): Promise<Response> {
    const url = new URL(requete.url);
    const chemin = url.pathname.replace(/\/+$/, "");
    const m = requete.method;
    try {
      if (chemin === "/api/sante" && m === "GET") return await sante();
      if (chemin === "/api/session" && m === "GET") return await session(requete);
      if (chemin === "/api/session/sortie" && m === "POST") return await sortie(requete);
      if (chemin === "/api/connexion/lien" && m === "POST") return await demanderLien(requete, info);
      if (chemin === "/api/connexion/lien/consommer" && m === "POST") return await consommerLien(requete);
      if (chemin === "/api/connexion/google" && m === "GET") return await partirChezGoogle(url);
      if (chemin === CHEMIN_RETOUR_GOOGLE && m === "GET") return await retourDeGoogle(requete, url);
      if (chemin === "/api/profil" && m === "POST") return await profil(requete);
      if (chemin === "/api/versions" && m === "GET") return await listerVersions(requete);
      if (chemin === "/api/versions" && m === "POST") return await creerVersion(requete);
      const v = /^\/api\/versions\/([^/]+)\/(renommer|remplacer|supprimer)$/.exec(chemin);
      if (v && m === "POST") {
        if (!estUuid(v[1])) return erreur(404, "INTROUVABLE");
        return await modifierVersion(requete, v[1].toLowerCase(), v[2] as "renommer");
      }
      if (chemin === "/api/declaration" && m === "GET") return await lireDeclaration(requete, url);
      if (chemin === "/api/declaration" && m === "POST") return await ecrireDeclaration(requete);
      if (chemin === "/api/propositions" && m === "GET") return await listerPropositions(requete);
      if (chemin === "/api/propositions" && m === "POST") return await creerProposition(requete);
      return json(404, { erreur: "INTROUVABLE" });
    } catch (e) {
      if (e instanceof Refus) return e.reponse;
      const traduite = traduireErreurSql(e);
      if (traduite) return traduite;
      journal("erreur", { chemin, message: (e as Error).message });
      return erreur(500, "INTERNE");
    }
  };
}
