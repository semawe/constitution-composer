// L'adaptateur HTTP du port de service (`./service.ts`) : le service des
// comptes de l'instance Sémawé, sur la même origine que le site, sous « api »
// (dossier `serveur/`, tâche ERP 3045, lots 2 à 4).
//
// Ce que la même origine change, et ce que cet adaptateur rattrape :
//
//   * La session est un cookie HttpOnly : la page ne le lit pas, ne le pose
//     pas, ne l'efface pas. Elle demande au service qui est là
//     (`GET /api/session`).
//   * Supabase prévenait tous les onglets d'un changement de session. Ici, un
//     canal de diffusion du navigateur (BroadcastChannel) prévient les autres
//     onglets, qui relisent la session ; un onglet qui redevient visible la
//     relit aussi (un canal ne porte rien entre deux navigateurs, ni pendant
//     qu'un onglet dort).
//   * Chaque réponse liée à un compte dit lequel (`compte`). Une réponse qui
//     porte un autre compte que celui affiché est écartée : elle ne s'affiche
//     pas, et la session est relue pour que l'écran suive (audit du 04/10/2026,
//     F06).
//   * Chaque écriture dit pour quel compte elle a été préparée ; le service
//     refuse (403) si la session en porte un autre (F07).
//   * Sortir quand le service ne répond pas : le cookie ne peut pas être effacé
//     par la page. La sortie est donc notée dans le navigateur, l'état local
//     purgé tout de suite, et la demande de sortie rejouée avant toute lecture
//     au prochain contact avec le service.
//
// Toutes les mutations passent en POST : le pare-feu applicatif de l'instance
// bloque PATCH et DELETE.

import type { CompositionPayload, SavedComposition } from "./compositions";
import { verdict, type Reponse } from "./declaration-sync";
import type {
  Compte,
  DeclarationDistante,
  EvenementSession,
  Service,
} from "./service";
import type { AppSubmission, NewSubmission } from "./submissions";

/** La sortie demandée et pas encore entendue par le service. */
export const CLE_SORTIE = "cc_sortie_en_attente";
/** Le dernier compte vu dans ce navigateur : dit qu'une session est neuve. */
export const CLE_COMPTE = "cc_session_compte";
/** Le canal qui relie les onglets d'un même navigateur. */
export const CANAL_SESSION = "cc-session";
/** La clé de session que Supabase laissait dans le stockage local. */
const RE_CLE_SUPABASE = /^sb-[a-z0-9]+-auth-token(?:-code-verifier)?$/;

type Ecouteur = (compte: Compte | null, evenement: EvenementSession) => void;

/** Ce qu'il faut d'un canal de diffusion. */
export interface Canal {
  postMessage(message: unknown): void;
  onmessage: ((evenement: { data: unknown }) => void) | null;
  close?(): void;
}

export interface OptionsHttp {
  /** Préfixe des routes ; vide pour la même origine. */
  base?: string;
  fetch?: typeof fetch;
  /** Stockage local du navigateur, ou null s'il est inaccessible. */
  stockage?: Storage | null;
  /** Ouvre le canal entre onglets, ou null si le navigateur n'en a pas. */
  canal?: () => Canal | null;
  /** Le document, pour relire la session au retour sur l'onglet. */
  document?: Document | null;
  /** Quitte la page pour `url` (départ chez Google). */
  naviguer?: (url: string) => void;
  /** L'origine de la page, pour ramener une adresse de retour à un chemin local. */
  origine?: () => string;
}

/** Une erreur du service, sous le code que le client lit (`LIMIT`, `AUTH`…). */
export class ErreurService extends Error {
  statut: number;
  constructor(code: string, statut: number) {
    super(code);
    this.name = "ErreurService";
    this.statut = statut;
  }
}

function texte(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

/** Le compte tel que le service le rend, ou null s'il n'en a pas la forme. */
export function lireCompte(brut: unknown): Compte | null {
  if (!brut || typeof brut !== "object") return null;
  const c = brut as Record<string, unknown>;
  if (typeof c.id !== "string" || !c.id) return null;
  return {
    id: c.id,
    email: texte(c.email),
    nom: texte(c.nom),
    prenom: texte(c.prenom),
    organisation: texte(c.organisation),
  };
}

function memeCompte(a: Compte | null, b: Compte | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.id === b.id &&
    a.email === b.email &&
    a.nom === b.nom &&
    a.prenom === b.prenom &&
    a.organisation === b.organisation
  );
}

/**
 * Un chemin local à partir d'une adresse de retour, ou le Composer par défaut.
 * Le service n'admet que des chemins locaux ; une adresse d'une autre origine
 * ne voyage pas.
 */
export function cheminDeRetour(retour: string, origine: string): string {
  try {
    const url = new URL(retour, origine);
    if (url.origin !== origine) return "/composer";
    const chemin = url.pathname;
    if (!chemin.startsWith("/") || chemin.startsWith("//")) return "/composer";
    return chemin;
  } catch {
    return "/composer";
  }
}

function lire(stockage: Storage | null, cle: string): string | null {
  try {
    return stockage?.getItem(cle) ?? null;
  } catch {
    return null;
  }
}

function ecrire(stockage: Storage | null, cle: string, valeur: string | null) {
  try {
    if (valeur === null) stockage?.removeItem(cle);
    else stockage?.setItem(cle, valeur);
  } catch {}
}

/** Efface la session que Supabase avait laissée dans ce navigateur. */
export function effacerSessionSupabase(stockage: Storage | null): void {
  if (!stockage) return;
  try {
    for (let i = stockage.length - 1; i >= 0; i--) {
      const cle = stockage.key(i);
      if (cle && RE_CLE_SUPABASE.test(cle)) stockage.removeItem(cle);
    }
  } catch {}
}

export function adaptateurHttp(options: OptionsHttp = {}): Service {
  const base = options.base ?? "";
  const appeler = options.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const stockage = options.stockage ?? null;
  const origine = options.origine ?? (() => window.location.origin);
  const naviguer =
    options.naviguer ?? ((url: string) => window.location.assign(url));

  /** Le compte affiché ; undefined tant que la session n'a jamais été lue. */
  let courant: Compte | null | undefined;
  /** Seule la dernière lecture de session lancée a le droit de conclure. */
  let generation = 0;
  const ecouteurs = new Set<Ecouteur>();

  effacerSessionSupabase(stockage);

  let canal: Canal | null = null;
  try {
    canal = options.canal ? options.canal() : null;
  } catch {
    canal = null;
  }
  if (canal) canal.onmessage = () => void relire();
  const doc = options.document ?? null;
  doc?.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "visible" && ecouteurs.size) void relire();
  });

  function prevenirLesAutresOnglets() {
    try {
      canal?.postMessage({ type: "session" });
    } catch {}
  }

  /**
   * Pose le compte affiché, et prévient qui écoute s'il a changé. Une session
   * neuve dans ce navigateur se dit « connexion » une seule fois, quel que soit
   * l'onglet qui la découvre : le dernier compte vu est partagé par le stockage.
   */
  function poser(compte: Compte | null, diffuser: boolean) {
    const avant = courant;
    courant = compte;
    const vuAvant = lire(stockage, CLE_COMPTE);
    ecrire(stockage, CLE_COMPTE, compte?.id ?? null);
    if (avant !== undefined && memeCompte(avant, compte)) return;
    let evenement: EvenementSession = "autre";
    if (compte && vuAvant !== compte.id) evenement = "connexion";
    else if (!compte && avant) evenement = "deconnexion";
    for (const e of [...ecouteurs]) e(compte, evenement);
    // Les autres onglets relisent dès que l'identité change : ici depuis la
    // dernière lecture, ou depuis le dernier compte vu dans ce navigateur pour
    // une première lecture (retour de Google, lien consommé). Leur relecture ne
    // rediffuse que si elle découvre à son tour un changement : la chaîne
    // s'éteint d'elle-même.
    const idAvant = avant === undefined ? vuAvant : (avant?.id ?? null);
    if (diffuser && idAvant !== (compte?.id ?? null)) prevenirLesAutresOnglets();
  }

  async function requete(
    methode: "GET" | "POST",
    chemin: string,
    corps?: unknown,
  ): Promise<Response> {
    return appeler(base + chemin, {
      method: methode,
      credentials: "same-origin",
      cache: "no-store",
      headers:
        corps === undefined
          ? { accept: "application/json" }
          : { accept: "application/json", "content-type": "application/json" },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  }

  async function json(r: Response): Promise<Record<string, unknown>> {
    try {
      const v: unknown = await r.json();
      return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  /**
   * Rejoue la sortie que le service n'a pas encore entendue. Rend vrai quand il
   * n'y a plus rien à rejouer. Tant qu'elle n'est pas passée, rien ne se lit :
   * le cookie d'une session qu'on a quittée ouvrirait encore le compte.
   */
  async function rejouerSortie(): Promise<boolean> {
    if (lire(stockage, CLE_SORTIE) === null) return true;
    try {
      const r = await requete("POST", "/api/session/sortie", {});
      if (!r.ok) return false;
      ecrire(stockage, CLE_SORTIE, null);
      return true;
    } catch {
      return false;
    }
  }

  async function lireLaSession(): Promise<Compte | null> {
    const moi = ++generation;
    if (!(await rejouerSortie())) {
      // Sortie pas encore entendue : on se tient pour sorti.
      if (moi === generation) poser(null, false);
      return null;
    }
    let compte: Compte | null;
    try {
      const r = await requete("GET", "/api/session");
      if (!r.ok) throw new Error(`HTTP_${r.status}`);
      compte = lireCompte((await json(r)).compte);
    } catch {
      // Service injoignable : on ne sait rien de neuf, on garde ce qu'on sait.
      return courant ?? null;
    }
    // Une lecture plus récente est partie : la sienne seule conclura.
    if (moi !== generation) return courant ?? null;
    poser(compte, true);
    return compte;
  }

  async function relire(): Promise<void> {
    await lireLaSession().catch(() => {});
  }

  /**
   * Lève l'erreur que porte une réponse en échec. Une session absente fait
   * tomber l'identité affichée ; une écriture refusée pour un autre compte
   * relance la lecture de la session, pour que l'écran suive.
   */
  async function echec(r: Response): Promise<never> {
    const code = texte((await json(r)).erreur) ?? `HTTP_${r.status}`;
    if (r.status === 401) poser(null, true);
    if (r.status === 403 && code === "COMPTE") void relire();
    throw new ErreurService(code, r.status);
  }

  /** Le compte pour lequel une écriture est préparée : celui qu'on affiche. */
  function compteAffiche(): string {
    if (!courant) throw new ErreurService("AUTH", 401);
    return courant.id;
  }

  /** Écarte une réponse partie pour un autre compte que celui affiché. */
  function pourLeCompteAffiche(corps: Record<string, unknown>): void {
    if (corps.compte !== courant?.id) {
      void relire();
      throw new ErreurService("COMPTE", 409);
    }
  }

  async function lireListe<T>(chemin: string, champ: string): Promise<T[]> {
    const r = await requete("GET", chemin);
    if (!r.ok) await echec(r);
    const corps = await json(r);
    pourLeCompteAffiche(corps);
    const liste = corps[champ];
    return Array.isArray(liste) ? (liste as T[]) : [];
  }

  async function ecrireVersion(id: string, action: string, champs: Record<string, unknown>) {
    const r = await requete(
      "POST",
      `/api/versions/${encodeURIComponent(id)}/${action}`,
      { compte: compteAffiche(), ...champs },
    );
    if (!r.ok) await echec(r);
    pourLeCompteAffiche(await json(r));
  }

  return {
    lireSession: lireLaSession,

    ecouterSession(ecouteur) {
      ecouteurs.add(ecouteur);
      return () => {
        ecouteurs.delete(ecouteur);
      };
    },

    async demanderLien(email, retour, infolettre = false) {
      // Une sortie en attente passe d'abord : la session qu'on ouvrira ne doit
      // pas être fermée par elle au chargement suivant.
      if (!(await rejouerSortie())) return { ok: false };
      const chemin = cheminDeRetour(retour, origine());
      const r = await requete("POST", "/api/connexion/lien", {
        email,
        retour: chemin,
        langue: chemin === "/en" || chemin.startsWith("/en/") ? "en" : "fr",
        ...(infolettre ? { infolettre: true } : {}),
      });
      return { ok: r.ok };
    },

    async partirChezGoogle(retour, infolettre = false) {
      if (!(await rejouerSortie())) return { ok: false };
      const chemin = cheminDeRetour(retour, origine());
      naviguer(
        `${base}/api/connexion/google?retour=${encodeURIComponent(chemin)}` +
          (infolettre ? "&infolettre=1" : ""),
      );
      return { ok: true };
    },

    async sortir() {
      // D'abord ici, tout de suite, et quoi que le service réponde : sur un
      // poste partagé, c'est la sortie locale qui compte.
      ecrire(stockage, CLE_SORTIE, String(Date.now()));
      poser(null, true);
      await rejouerSortie();
    },

    async rattacherProfil() {
      // Le service tient le profil seul : rien à rattacher depuis la page.
    },

    async enregistrerOrganisation(organisation) {
      const r = await requete("POST", "/api/profil", {
        compte: compteAffiche(),
        organisation,
      });
      if (!r.ok) {
        if (r.status === 401) poser(null, true);
        return { ok: false };
      }
      const compte = lireCompte((await json(r)).compte);
      if (compte && compte.id === courant?.id) {
        poser(compte, false);
        prevenirLesAutresOnglets();
      }
      return { ok: true };
    },

    listerVersions: () => lireListe<SavedComposition>("/api/versions", "versions"),

    async creerVersion(nom: string, payload: CompositionPayload) {
      const r = await requete("POST", "/api/versions", {
        compte: compteAffiche(),
        nom,
        payload,
      });
      if (!r.ok) await echec(r);
      const corps = await json(r);
      pourLeCompteAffiche(corps);
      return corps.version as SavedComposition;
    },

    renommerVersion: (id, nom) => ecrireVersion(id, "renommer", { nom }),
    remplacerVersion: (id, payload) => ecrireVersion(id, "remplacer", { payload }),
    supprimerVersion: (id) => ecrireVersion(id, "supprimer", {}),

    async lireDeclaration(compte): Promise<DeclarationDistante | null> {
      const r = await requete(
        "GET",
        `/api/declaration?compte=${encodeURIComponent(compte)}`,
      );
      if (!r.ok) await echec(r);
      const corps = await json(r);
      if (corps.compte !== compte) {
        void relire();
        throw new ErreurService("COMPTE", 409);
      }
      const d = corps.declaration as { payload?: unknown; revision?: unknown } | null;
      if (!d || !d.payload) return null;
      return {
        payload: d.payload,
        revision: typeof d.revision === "number" ? d.revision : 0,
      };
    },

    async ecrireDeclaration(payload, revision, compte): Promise<Reponse> {
      try {
        const r = await requete("POST", "/api/declaration", {
          compte,
          payload,
          revision,
        });
        if (!r.ok) {
          if (r.status === 401) poser(null, true);
          if (r.status === 403) void relire();
          return { statut: "erreur" };
        }
        const corps = await json(r);
        if (corps.compte !== compte) return { statut: "erreur" };
        return verdict(corps);
      } catch {
        return { statut: "erreur" };
      }
    },

    async creerProposition(input: NewSubmission): Promise<AppSubmission> {
      const r = await requete("POST", "/api/propositions", {
        compte: compteAffiche(),
        ...input,
      });
      if (!r.ok) await echec(r);
      const corps = await json(r);
      pourLeCompteAffiche(corps);
      return corps.proposition as AppSubmission;
    },

    async listerMesPropositions() {
      if (!courant) return [];
      return lireListe<AppSubmission>("/api/propositions", "propositions");
    },
  };
}

/** L'adaptateur branché sur le navigateur. */
export function creerServiceHttp(): Service {
  const navigateur = typeof window !== "undefined";
  let stockage: Storage | null = null;
  try {
    stockage = navigateur ? window.localStorage : null;
  } catch {
    stockage = null;
  }
  return adaptateurHttp({
    stockage,
    document: navigateur ? document : null,
    canal: () =>
      navigateur && typeof BroadcastChannel !== "undefined"
        ? (new BroadcastChannel(CANAL_SESSION) as unknown as Canal)
        : null,
  });
}
