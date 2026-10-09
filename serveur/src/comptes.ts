// Comptes, profils et sessions.
//
// Un compte par adresse, en minuscules. Inscription ouverte : la première
// connexion réussie crée le compte. Google (adresse vérifiée) et lien par
// courriel sur la même adresse mènent au même compte ; le compte est cherché
// d'abord par l'identité Google (émetteur, sujet), puis par adresse.
//
// Sessions (modèle : app-academie, src/lib/apprenant.ts) : jeton opaque de
// 256 bits dans un cookie d'hôte HttpOnly, seule son empreinte SHA-256 en base,
// 90 jours glissants, révocation par suppression de la ligne.

import { declarerCompte, empreinte, jetonAleatoire, type Client, type Pool } from "./base.ts";

export const DUREE_SESSION_JOURS = 90;
export const DUREE_SESSION_S = DUREE_SESSION_JOURS * 24 * 3600;

/** Le compte tel que le client le lit (type `Compte` de src/lib/service.ts). */
export interface Compte {
  id: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  organisation: string | null;
}

export interface Rattachement {
  id: string;
  /** Vrai si le compte vient d'être créé : il reste à l'annoncer. */
  annoncer: boolean;
}

/**
 * Trouve le compte de cette adresse, ou le crée avec son profil. Déclare le
 * compte dans la transaction : le profil s'écrit sous sécurité par ligne.
 */
export async function compteParAdresse(
  client: Client,
  email: string,
  profil: { nom?: string | null; prenom?: string | null } = {},
): Promise<Rattachement> {
  const cree = await client.query<{ id: string }>(
    "insert into composer.comptes (email) values ($1) on conflict (email) do nothing returning id",
    [email],
  );
  if (cree.rows[0]) {
    const id = cree.rows[0].id;
    await declarerCompte(client, id);
    await client.query(
      "insert into composer.profils (compte_id, nom, prenom) values ($1, $2, $3)",
      [id, borne(profil.nom), borne(profil.prenom)],
    );
    const annonce = await client.query(
      `insert into composer.annonces_slack (compte_id, inscription_le) values ($1, now())
       on conflict (compte_id) do nothing returning compte_id`,
      [id],
    );
    return { id, annoncer: annonce.rowCount === 1 };
  }
  const { rows } = await client.query<{ id: string }>(
    "select id from composer.comptes where email = $1",
    [email],
  );
  if (!rows[0]) throw new Error("Compte introuvable après conflit d'adresse.");
  await declarerCompte(client, rows[0].id);
  // Un compte né par lien n'a pas de nom : Google le complète, sans écraser.
  if (profil.nom || profil.prenom)
    await client.query(
      `insert into composer.profils as p (compte_id, nom, prenom) values ($1, $2, $3)
       on conflict (compte_id) do update
          set nom = coalesce(p.nom, excluded.nom),
              prenom = coalesce(p.prenom, excluded.prenom)`,
      [rows[0].id, borne(profil.nom), borne(profil.prenom)],
    );
  return { id: rows[0].id, annoncer: false };
}

export interface IdentiteGoogle {
  issuer: string;
  sujet: string;
  email: string;
  nom: string | null;
  prenom: string | null;
}

export async function compteParGoogle(
  client: Client,
  identite: IdentiteGoogle,
): Promise<Rattachement> {
  const { rows } = await client.query<{ compte_id: string }>(
    "select compte_id from composer.identites_google where issuer = $1 and sujet = $2",
    [identite.issuer, identite.sujet],
  );
  if (rows[0]) {
    await declarerCompte(client, rows[0].compte_id);
    return { id: rows[0].compte_id, annoncer: false };
  }
  const rattachement = await compteParAdresse(client, identite.email, identite);
  await client.query(
    `insert into composer.identites_google (issuer, sujet, compte_id) values ($1, $2, $3)
     on conflict (issuer, sujet) do nothing`,
    [identite.issuer, identite.sujet, rattachement.id],
  );
  return rattachement;
}

function borne(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t.slice(0, 200) : null;
}

/** Le compte déclaré dans la transaction, profil compris. */
export async function lireCompte(client: Client, id: string): Promise<Compte | null> {
  const { rows } = await client.query<Compte>(
    `select c.id, c.email, p.nom, p.prenom, p.organisation
       from composer.comptes c
       left join composer.profils p on p.compte_id = c.id
      where c.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Ouvre une session ; rend le jeton à poser en cookie. */
export async function ouvrirSession(
  client: Client,
  compte: string,
  origine: "google" | "lien",
): Promise<string> {
  const jeton = jetonAleatoire();
  await client.query(
    `insert into composer.sessions (empreinte, compte_id, origine, expire_le)
     values ($1, $2, $3, now() + make_interval(days => $4))`,
    [empreinte(jeton), compte, origine, DUREE_SESSION_JOURS],
  );
  await client.query("delete from composer.sessions where expire_le < now()");
  return jeton;
}

export interface SessionLue {
  compte: string;
  /** Vrai si l'échéance vient d'être repoussée : le cookie est à réémettre. */
  prolongee: boolean;
}

const RE_JETON = /^[A-Za-z0-9_-]{43}$/;

/**
 * Le compte d'une session valide, ou null. Glissante : l'échéance est repoussée
 * à 90 jours au plus une fois par jour.
 */
export async function lireSession(pool: Pool, jeton: string | null): Promise<SessionLue | null> {
  if (!jeton || !RE_JETON.test(jeton)) return null;
  const { rows } = await pool.query<{ compte_id: string; prolongee: boolean }>(
    `with lue as (
       select empreinte, compte_id from composer.sessions
        where empreinte = $1 and expire_le > now()
     ), prolongee as (
       update composer.sessions s
          set expire_le = now() + make_interval(days => $2)
         from lue
        where s.empreinte = lue.empreinte
          and s.expire_le < now() + make_interval(days => $2) - interval '1 day'
       returning s.empreinte
     )
     select lue.compte_id, exists (select 1 from prolongee) as prolongee from lue`,
    [empreinte(jeton), DUREE_SESSION_JOURS],
  );
  return rows[0] ? { compte: rows[0].compte_id, prolongee: rows[0].prolongee } : null;
}

export async function fermerSession(pool: Pool, jeton: string | null): Promise<void> {
  if (!jeton || !RE_JETON.test(jeton)) return;
  await pool.query("delete from composer.sessions where empreinte = $1", [empreinte(jeton)]);
}
