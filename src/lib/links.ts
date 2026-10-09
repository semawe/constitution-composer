import type { Locale } from "@/lib/i18n";

// Liens externes de référence, centralisés pour rester cohérents partout.

/** Repo public où Sémawé publie la Constitution v6 alpha. */
export const REPO_CONSTITUTION_URL = "https://github.com/semawe/Holacracy-Constitution";

// La carte des organisations en Holacratie vit sur semawe.fr depuis le
// 04/10/2026, tenue depuis un tableau de l'ERP (tâche ERP 3031) : le Composer
// n'en garde aucune copie, ses anciennes adresses y renvoient.
export const CARTE_ORGANISATIONS_URL =
  "https://semawe.fr/holacracy/carte-des-organisations";

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
