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
import { ARCHIVED_RELEASES } from "@/data/releases";

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
  | { statut: "empreinte-divergente"; release: string };

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
 * Le fond dont un document doit être rendu.
 *
 * `undefined` (payload d'avant l'archivage) donne « non-figee » : l'appelant
 * compose alors avec le fond courant, mais il doit le dire, et proposer de
 * figer. Tout le reste est ou résolu, ou refusé.
 */
function resolve<T>(
  ref: ContentRef | null | undefined,
  kind: ContentKind,
  extraire: (r: (typeof ARCHIVED_RELEASES)[number]) => Record<string, T>,
): ReleaseResolution<T> {
  if (!ref || !ref.release) return { statut: "non-figee" };
  // Une référence sans `kind` vient du premier format : elle parle de la
  // Constitution. La lire comme un autre fond serait une confusion silencieuse.
  if ((ref.kind ?? "constitution") !== kind) return { statut: "non-figee" };
  const archivee = PAR_ID.get(ref.release);
  if (!archivee) return { statut: "release-absente", release: ref.release };
  const attendue = archivee.sha256[fichier(kind, ref.locale)];
  const data = extraire(archivee)[ref.locale];
  if (!attendue || !data)
    return { statut: "release-absente", release: ref.release };
  // L'empreinte est comparée telle qu'elle a été archivée : si le document en
  // porte une autre, ce n'est pas le même texte, quel qu'en soit le motif.
  if (ref.sha256 && ref.sha256 !== attendue)
    return { statut: "empreinte-divergente", release: ref.release };
  return { statut: "resolue", release: ref.release, data };
}

/** Le texte de la Constitution dont une composition sauvegardée est faite. */
export function resolveContent(
  ref?: ContentRef | null,
): ReleaseResolution<ConstitutionData> {
  return resolve(ref, "constitution", (r) => r.constitution);
}

/** Les Principes dont une Déclaration sauvegardée est faite. */
export function resolvePrincipes(
  ref?: ContentRef | null,
): ReleaseResolution<PrincipesData> {
  return resolve(ref, "principes", (r) => r.principes);
}

/** Vrai si ce document est figé sur une release plus ancienne que la courante. */
export function isOutdated(ref?: ContentRef | null): boolean {
  return Boolean(ref?.release) && ref!.release !== CURRENT_RELEASE;
}
