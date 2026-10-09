// Résolution d'une release du fond : de quel texte vient un document.
//
// Une composition sauvegardée ne portait que sa configuration. Rouvrir une
// « version » après une retouche éditoriale du fond produisait donc un autre
// texte, sous le même nom, sans un mot — pour un document qu'une organisation
// adopte comme sa constitution, c'est le défaut le plus grave possible.
//
// Depuis, chaque état du fond est archivé (`scripts/releases.mjs`) et une
// composition retient la release dont elle est issue. Ce module fait le lien, et
// il est **strict par construction** : une release inconnue, ou une empreinte
// qui ne correspond pas, ne retombe jamais en silence sur le fond courant. Elle
// se refuse, et l'appelant le dit à l'écran.

import { type ConstitutionData } from "./constitution";
import { type PrincipesData } from "./principes-data";
import { ARCHIVED_FILES, ARCHIVED_RELEASES } from "@/data/releases";

export type Locale = "fr" | "en";

/** Les deux fonds qu'une release archive, et que deux documents distincts servent. */
export type ContentKind = "constitution" | "principes";

/** Ce qu'un document retient du fond dont il est issu (payload v2). */
export interface ContentRef {
  locale: Locale;
  release: string;
  sha256: string;
  /** Absent = « constitution » : les premières références n'avaient qu'un fond. */
  kind?: ContentKind;
}

function fichier(kind: ContentKind, locale: Locale): string {
  return `${kind}.${locale}.json`;
}

export type ReleaseResolution<T> =
  /** Release archivée et empreinte conforme : le document de son époque. */
  | { statut: "resolue"; release: string; data: T }
  /** Version d'avant l'archivage : aucune release retenue, rien à garantir. */
  | { statut: "non-figee" }
  /** Release retenue mais absente de l'archive : on refuse de composer autre chose. */
  | { statut: "release-absente"; release: string }
  /** Release présente, empreinte différente : l'archive a bougé, on refuse. */
  | { statut: "empreinte-divergente"; release: string }
  /**
   * Release connue, mais son texte n'a pas pu descendre (réseau, fragment
   * retiré par une publication). Ce n'est pas un refus de fond : réessayer a un
   * sens, et l'appelant le dit ainsi.
   */
  | { statut: "chargement-echoue"; release: string };

const PAR_ID = new Map(ARCHIVED_RELEASES.map((r) => [r.id, r]));

/** La release la plus récente : celle que le fond servi porte aujourd'hui. */
export const CURRENT_RELEASE: string =
  ARCHIVED_RELEASES[ARCHIVED_RELEASES.length - 1]?.id ?? "";

export function releaseSha(
  release: string,
  locale: Locale,
  kind: ContentKind = "constitution",
): string | null {
  return PAR_ID.get(release)?.sha256[fichier(kind, locale)] ?? null;
}

/** La référence à inscrire dans un document sauvegardé maintenant. */
export function currentContentRef(
  locale: Locale,
  kind: ContentKind = "constitution",
): ContentRef {
  return {
    locale,
    release: CURRENT_RELEASE,
    sha256: releaseSha(CURRENT_RELEASE, locale, kind) ?? "",
    kind,
  };
}

const MOIS: Record<Locale, string[]> = {
  fr: [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
};

/**
 * Le nom lisible d'une release : « 19 août 2026 », pas « 2026-08-19 ».
 *
 * Formaté à la main plutôt que par `toLocaleDateString` : un identifiant de
 * release est une date civile, pas un instant, et la passer par `Date` la
 * décalerait d'un jour selon le fuseau de qui regarde. Un identifiant qui n'est
 * pas une date (label posé à la main) se rend tel quel.
 */
export function releaseLabel(id: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:-\d+)?$/.exec(id);
  if (!m) return id;
  const [, annee, mois, jour] = m;
  const nom = MOIS[locale][Number(mois) - 1];
  const j = String(Number(jour));
  return locale === "fr"
    ? `${j} ${nom} ${annee}`
    : `${nom} ${j}, ${annee}`;
}

/** Empreinte courte, pour le pied de page du PDF : lisible, et suffisante à comparer. */
export function shortSha(sha256: string): string {
  return sha256.slice(0, 12);
}

/**
 * La référence telle que l'archive la connaît, ou null si elle n'y correspond à
 * rien. Sert de frontière à l'écriture : on n'inscrit dans un document sauvegardé
 * qu'une référence que l'archive sait relire, empreinte comprise.
 */
export function canonicalRef(
  ref: ContentRef | null | undefined,
  kind: ContentKind = "constitution",
): ContentRef | null {
  if (!ref || !ref.release) return null;
  if ((ref.kind ?? "constitution") !== kind) return null;
  if (ref.locale !== "fr" && ref.locale !== "en") return null;
  const attendue = releaseSha(ref.release, ref.locale, kind);
  if (!attendue) return null;
  if (ref.sha256 && ref.sha256 !== attendue) return null;
  return { locale: ref.locale, release: ref.release, sha256: attendue, kind };
}

/** Vrai si la référence désigne le fond servi aujourd'hui dans cette langue. */
export function isCurrentRef(
  ref: ContentRef | null | undefined,
  locale: Locale,
  kind: ContentKind = "constitution",
): boolean {
  const canonique = canonicalRef(ref, kind);
  return (
    canonique !== null &&
    canonique.release === CURRENT_RELEASE &&
    canonique.locale === locale
  );
}

// Un fichier archivé ne descend qu'une fois : la promesse est gardée, pas son
// résultat, pour que deux ouvertures simultanées partagent la même requête. Un
// échec n'est pas gardé — sinon une coupure réseau condamnerait la release
// jusqu'au rechargement de la page.
const EN_COURS = new Map<string, Promise<unknown>>();

function charger(release: string, nom: string): Promise<unknown> | null {
  const chargeur = ARCHIVED_FILES[release]?.[nom];
  if (!chargeur) return null;
  const cle = `${release}/${nom}`;
  let promesse = EN_COURS.get(cle);
  if (!promesse) {
    promesse = chargeur();
    EN_COURS.set(cle, promesse);
    promesse.catch(() => EN_COURS.delete(cle));
  }
  return promesse;
}

/**
 * Le fond dont un document doit être rendu.
 *
 * `undefined` (payload d'avant l'archivage) donne « non-figee » : l'appelant
 * compose alors avec le fond courant, mais il doit le dire, et proposer de
 * figer. Tout le reste est ou résolu, ou refusé.
 *
 * Asynchrone depuis que les fonds archivés ne descendent qu'à la demande : la
 * décision (release connue, empreinte conforme) se prend sur le manifeste, sans
 * rien charger ; seul le texte d'une référence acceptée fait une requête.
 */
async function resolve<T>(
  ref: ContentRef | null | undefined,
  kind: ContentKind,
): Promise<ReleaseResolution<T>> {
  if (!ref || !ref.release) return { statut: "non-figee" };
  // Une référence sans `kind` vient du premier format : elle parle de la
  // Constitution. La lire comme un autre fond serait une confusion silencieuse.
  if ((ref.kind ?? "constitution") !== kind) return { statut: "non-figee" };
  const archivee = PAR_ID.get(ref.release);
  if (!archivee) return { statut: "release-absente", release: ref.release };
  const nom = fichier(kind, ref.locale);
  const attendue = archivee.sha256[nom];
  const chargement = attendue ? charger(ref.release, nom) : null;
  if (!attendue || !chargement)
    return { statut: "release-absente", release: ref.release };
  // L'empreinte est comparée telle qu'elle a été archivée : si le document en
  // porte une autre, ce n'est pas le même texte, quel qu'en soit le motif.
  if (ref.sha256 && ref.sha256 !== attendue)
    return { statut: "empreinte-divergente", release: ref.release };
  try {
    const data = (await chargement) as T;
    return { statut: "resolue", release: ref.release, data };
  } catch {
    return { statut: "chargement-echoue", release: ref.release };
  }
}

/** Le texte de la Constitution dont une composition sauvegardée est faite. */
export function resolveContent(
  ref?: ContentRef | null,
): Promise<ReleaseResolution<ConstitutionData>> {
  return resolve<ConstitutionData>(ref, "constitution");
}

/** Les Principes dont une Déclaration sauvegardée est faite. */
export function resolvePrincipes(
  ref?: ContentRef | null,
): Promise<ReleaseResolution<PrincipesData>> {
  return resolve<PrincipesData>(ref, "principes");
}

/** Vrai si ce document est figé sur une release plus ancienne que la courante. */
export function isOutdated(ref?: ContentRef | null): boolean {
  return Boolean(ref?.release) && ref!.release !== CURRENT_RELEASE;
}
