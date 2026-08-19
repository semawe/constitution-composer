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
import { ARCHIVED_RELEASES } from "@/data/releases";

export type Locale = "fr" | "en";

/** Ce qu'une composition retient du fond dont elle est issue (payload v2). */
export interface ContentRef {
  locale: Locale;
  release: string;
  sha256: string;
}

export type ReleaseResolution =
  /** Release archivée et empreinte conforme : le document de son époque. */
  | { statut: "resolue"; release: string; data: ConstitutionData }
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

export function releaseSha(release: string, locale: Locale): string | null {
  return PAR_ID.get(release)?.sha256[locale] ?? null;
}

/** La référence à inscrire dans une composition sauvegardée maintenant. */
export function currentContentRef(locale: Locale): ContentRef {
  return {
    locale,
    release: CURRENT_RELEASE,
    sha256: releaseSha(CURRENT_RELEASE, locale) ?? "",
  };
}

/** Empreinte courte, pour le pied de page du PDF : lisible, et suffisante à comparer. */
export function shortSha(sha256: string): string {
  return sha256.slice(0, 12);
}

/**
 * Le fond dont une composition doit être rendue.
 *
 * `undefined` (payload d'avant l'archivage) donne « non-figee » : l'appelant
 * compose alors avec le fond courant, mais il doit le dire, et proposer de
 * figer. Tout le reste est ou résolu, ou refusé.
 */
export function resolveContent(ref?: ContentRef | null): ReleaseResolution {
  if (!ref || !ref.release) return { statut: "non-figee" };
  const archivee = PAR_ID.get(ref.release);
  if (!archivee) return { statut: "release-absente", release: ref.release };
  const attendue = archivee.sha256[ref.locale];
  const data = archivee.data[ref.locale];
  if (!attendue || !data)
    return { statut: "release-absente", release: ref.release };
  // L'empreinte est comparée telle qu'elle a été archivée : si la composition
  // en porte une autre, ce n'est pas le même texte, quel qu'en soit le motif.
  if (ref.sha256 && ref.sha256 !== attendue)
    return { statut: "empreinte-divergente", release: ref.release };
  return { statut: "resolue", release: ref.release, data };
}

/** Vrai si cette composition est figée sur une release plus ancienne que la courante. */
export function isOutdated(ref?: ContentRef | null): boolean {
  return Boolean(ref?.release) && ref!.release !== CURRENT_RELEASE;
}
