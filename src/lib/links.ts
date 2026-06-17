import type { Locale } from "@/lib/i18n";

// Liens externes de référence, centralisés pour rester cohérents partout.

/** Repo public où Aliocha publie la Constitution v6 alpha. */
export const REPO_V6_URL = "https://github.com/semawe/Holacracy-Constitution";

export const HETEROSTASIA_URL = "https://heterostasia.com";
export const SEMAWE_URL = "https://semawe.fr";

/**
 * Version 5.0 stable et officielle de Holacracy :
 * - EN : repo public officiel de HolacracyOne (v5.0) ;
 * - FR : page Sémawé qui héberge la traduction française intégrale.
 */
export function v5Href(locale: Locale): string {
  return locale === "en"
    ? "https://github.com/holacracyone/Holacracy-Constitution"
    : "https://semawe.fr/holacracy/ressources/constitution-holacracy-5-0-en-francais";
}
