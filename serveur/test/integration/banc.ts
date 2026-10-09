// Banc d'intégration : une base jetable sur un PostgreSQL réel, les migrations
// du dépôt, le rôle applicatif réel (sans contournement de la sécurité par
// ligne), et l'application appelée avec des Request standard.
//
// Google, Brevo et Slack sont doublés : `fetcher` répond à leur place et garde
// ce qui leur a été envoyé ; les jetons d'identité Google sont signés par une
// paire de clés locale, publiée au service comme le seraient celles de Google.
//
// COMPOSER_TEST_ADMIN_URL désigne un superutilisateur d'un cluster éphémère et
// local (service postgres:15 de la CI, ou cluster jetable du poste) : le banc y
// crée les rôles composer_app et composer_owner, et refuse tout hôte distant.

import { randomBytes, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import pg from "pg";
import { creerApplication, type Gestionnaire } from "../../src/application.ts";
import { creerPool, type Pool } from "../../src/base.ts";
import type { Configuration } from "../../src/configuration.ts";
import { ISSUER_GOOGLE, JETON_GOOGLE } from "../../src/google.ts";
import { chargerManifeste } from "../../src/releases.ts";
import { migrer } from "../../db/migrer.ts";

export const ORIGINE = "https://composer.test";
const ICI = dirname(fileURLToPath(import.meta.url));
export const MANIFESTE = chargerManifeste(join(ICI, "..", "..", "..", "src", "data", "releases", "manifest.json"));
const WEBHOOK = "https://hooks.slack.com/services/T0TEST/B0TEST/secretdetest";
const CLIENT_GOOGLE = "client-test.apps.googleusercontent.com";

export interface Courriel {
  a: string;
  html: string;
  texte: string;
}

export interface Banc {
  gerer: Gestionnaire;
  pool: Pool;
  /** Superutilisateur, connecté à la base de test. */
  admin: pg.Client;
  appUrl: string;
  ownerUrl: string;
  courriels: Courriel[];
  slack: string[];
  pannes: { brevo: boolean; slack: boolean };
  /** Signe un jeton d'identité comme Google le ferait. */
  jetonGoogle(claims: Record<string, unknown>): Promise<string>;
  /** Le prochain id_token que l'échange de code rendra. */
  google: { prochainJeton: string | null; codesRecus: string[] };
  fin(): Promise<void>;
}

function adminUrl(): string {
  const brute = process.env.COMPOSER_TEST_ADMIN_URL;
  if (!brute) throw new Error("COMPOSER_TEST_ADMIN_URL est requis pour la suite d'intégration.");
  const hote = new URL(brute).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(hote))
    throw new Error("La suite d'intégration refuse un cluster qui n'est pas local.");
  return brute;
}

function avecBase(url: string, base: string, utilisateur?: string, motDePasse?: string): string {
  const u = new URL(url);
  u.pathname = `/${base}`;
  if (utilisateur) u.username = utilisateur;
  if (motDePasse) u.password = motDePasse;
  return u.toString();
}

export async function ouvrirBanc(): Promise<Banc> {
  const racine = adminUrl();
  const base = `composer_test_${randomBytes(5).toString("hex")}`;
  const mdpApp = randomBytes(18).toString("base64url");
  const mdpOwner = randomBytes(18).toString("base64url");

  const superu = new pg.Client({ connectionString: racine });
  await superu.connect();
  for (const [role, mdp, options] of [
    ["composer_app", mdpApp, "login nosuperuser nobypassrls nocreatedb nocreaterole"],
    ["composer_owner", mdpOwner, "login nosuperuser nobypassrls nocreatedb nocreaterole"],
  ] as const) {
    const existe = await superu.query("select 1 from pg_roles where rolname = $1", [role]);
    if (!existe.rowCount) await superu.query(`create role ${role} ${options}`);
    await superu.query(`alter role ${role} ${options} password '${mdp}'`);
  }
  await superu.query(`create database ${base} owner composer_owner`);
  await superu.end();

  const ownerUrl = avecBase(racine, base, "composer_owner", mdpOwner);
  const appUrl = avecBase(racine, base, "composer_app", mdpApp);
  await migrer(ownerUrl);

  const admin = new pg.Client({ connectionString: avecBase(racine, base) });
  await admin.connect();
  const pool = creerPool(appUrl, "composer-test");

  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "cle-test", alg: "RS256", use: "sig" };
  const cles = createLocalJWKSet({ keys: [jwk] });

  const courriels: Courriel[] = [];
  const slack: string[] = [];
  const pannes = { brevo: false, slack: false };
  const google = { prochainJeton: null as string | null, codesRecus: [] as string[] };

  const fetcher = async (entree: string, init?: RequestInit): Promise<Response> => {
    const corps = typeof init?.body === "string" ? init.body : "";
    if (entree === "https://api.brevo.com/v3/smtp/email") {
      if (pannes.brevo) return new Response("panne", { status: 503 });
      const c = JSON.parse(corps);
      courriels.push({ a: c.to[0].email, html: c.htmlContent, texte: c.textContent });
      return Response.json({ messageId: randomUUID() }, { status: 201 });
    }
    if (entree === WEBHOOK) {
      if (pannes.slack) return new Response("panne", { status: 500 });
      slack.push(JSON.parse(corps).text);
      return new Response("ok");
    }
    if (entree === JETON_GOOGLE) {
      const params = new URLSearchParams(corps);
      google.codesRecus.push(params.get("code") ?? "");
      if (!google.prochainJeton) return new Response("invalid_grant", { status: 400 });
      return Response.json({ id_token: google.prochainJeton });
    }
    throw new Error(`Appel sortant inattendu : ${entree}`);
  };

  const config: Configuration = {
    origine: ORIGINE,
    secrets: [new Uint8Array(randomBytes(32))],
    google: { clientId: CLIENT_GOOGLE, clientSecret: "secret-test" },
    brevo: { cle: "cle-test", expediteur: { email: "connexion@composer.test", name: "Composer" } },
    slack: { webhookUrl: WEBHOOK },
    manifeste: MANIFESTE,
  };

  const gerer = creerApplication({
    pool,
    config,
    fetcher,
    clesGoogle: cles,
    journal: () => {},
  });

  return {
    gerer,
    pool,
    admin,
    appUrl,
    ownerUrl,
    courriels,
    slack,
    pannes,
    google,
    async jetonGoogle(claims) {
      return new SignJWT({ email_verified: true, ...claims })
        .setProtectedHeader({ alg: "RS256", kid: "cle-test" })
        .setIssuer(ISSUER_GOOGLE)
        .setAudience(CLIENT_GOOGLE)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
    },
    async fin() {
      await pool.end();
      await admin.end();
      const s = new pg.Client({ connectionString: racine });
      await s.connect();
      await s.query(`drop database if exists ${base} with (force)`);
      await s.end();
    },
  };
}

/** Une réponse dont le corps JSON se lit sans transtypage dans les épreuves. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Reponse = Omit<Response, "json"> & { json(): Promise<any> };

/** Un navigateur : un pot à cookies, une origine, une adresse IP. */
export class Navigateur {
  cookies = new Map<string, string>();
  banc: Banc;
  ip: string | null;

  constructor(banc: Banc, ip: string | null = null) {
    this.banc = banc;
    this.ip = ip;
  }

  async requete(
    methode: string,
    chemin: string,
    options: { json?: unknown; form?: Record<string, string>; origine?: string | null } = {},
  ): Promise<Reponse> {
    const entetes = new Headers();
    if (this.cookies.size)
      entetes.set("cookie", [...this.cookies].map(([n, v]) => `${n}=${v}`).join("; "));
    const origine = options.origine === undefined ? ORIGINE : options.origine;
    if (origine !== null && methode !== "GET") entetes.set("origin", origine);
    let corps: string | undefined;
    if (options.json !== undefined) {
      entetes.set("content-type", "application/json");
      corps = JSON.stringify(options.json);
    } else if (options.form) {
      entetes.set("content-type", "application/x-www-form-urlencoded");
      corps = new URLSearchParams(options.form).toString();
    }
    const reponse = await this.banc.gerer(
      new Request(`${ORIGINE}${chemin}`, { method: methode, headers: entetes, body: corps }),
      { ip: this.ip },
    );
    for (const sc of reponse.headers.getSetCookie()) {
      const [paire, ...attributs] = sc.split(";");
      const i = paire.indexOf("=");
      const nom = paire.slice(0, i);
      const valeur = paire.slice(i + 1);
      if (attributs.some((a) => a.trim() === "Max-Age=0") || !valeur) this.cookies.delete(nom);
      else this.cookies.set(nom, valeur);
    }
    return reponse as Reponse;
  }

  get(chemin: string) {
    return this.requete("GET", chemin);
  }

  post(chemin: string, json?: unknown, origine?: string | null) {
    return this.requete("POST", chemin, { json, origine });
  }
}

/** Le dernier jeton de lien envoyé à cette adresse. */
export function dernierJeton(banc: Banc, adresse: string): string {
  const courriel = banc.courriels.filter((c) => c.a === adresse).at(-1);
  const m = courriel && /jeton=([A-Za-z0-9_-]{43})/.exec(courriel.texte);
  if (!m) throw new Error(`Aucun lien envoyé à ${adresse}.`);
  return m[1];
}

/** Connexion complète par lien ; rend le compte. */
export async function connecter(nav: Navigateur, adresse: string): Promise<{ id: string; email: string }> {
  const demande = await nav.post("/api/connexion/lien", { email: adresse, retour: "/composer" });
  if (demande.status !== 202) throw new Error(`Demande de lien refusée : ${demande.status}`);
  const r = await nav.post("/api/connexion/lien/consommer", { jeton: dernierJeton(nav.banc, adresse) });
  if (r.status !== 200) throw new Error(`Consommation refusée : ${r.status}`);
  return (await r.json()).compte;
}

/** Une référence de contenu valide : la release courante, en français. */
export function referenceCourante(locale: "fr" | "en" = "fr") {
  const release = MANIFESTE.releases.at(-1)!;
  return {
    locale,
    release: release.id,
    sha256: release.sha256[`constitution.${locale}.json`],
    kind: "constitution",
  };
}

export function chargeValide(titre = "Constitution d'essai") {
  return { schemaVersion: 2, content: referenceCourante(), title: titre, values: "", active: [] };
}

/** Une adresse jamais vue : les freins par boîte ne se croisent pas d'un test à l'autre. */
export function adresseNeuve(prefixe = "personne"): string {
  return `${prefixe}-${randomBytes(4).toString("hex")}@exemple.test`;
}
