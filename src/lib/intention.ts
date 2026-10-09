// Le geste qui a motivé une connexion, retenu le temps de l'aller-retour.
//
// Une connexion quitte la page (redirection Google) ou la rouvre ailleurs (lien
// reçu par e-mail). Au retour, la personne retrouvait le Composer à son état
// d'accueil : l'export, l'enregistrement ou le module qu'elle venait de demander
// n'avait pas lieu, et rien ne le lui disait (audit du 04/10/2026, F13 et F14).
//
// Ce qui est retenu est un nom de geste, jamais une donnée du document : il vit
// dans le navigateur, pas dans l'URL, et s'efface de lui-même. Il n'est repris
// qu'une fois la session confirmée, par le composant qui sait l'accomplir.

const CLE = "cc_intention";
/** Au-delà, la personne est passée à autre chose : on ne rejoue rien. */
const DUREE_MS = 30 * 60 * 1000;

/**
 * Retient le geste, et l'onglet d'où il part : l'adresse de retour d'une
 * connexion reste la page nue (c'est elle que le service d'authentification
 * connaît), donc l'onglet ne peut pas voyager dans l'URL.
 */
export function retenirIntention(geste: string): void {
  try {
    const vue = new URLSearchParams(window.location.search).get("vue");
    localStorage.setItem(
      CLE,
      JSON.stringify({ geste, quand: Date.now(), ...(vue ? { vue } : {}) }),
    );
  } catch {}
}

/**
 * L'onglet à rouvrir au retour d'une connexion, rendu une seule fois : le geste
 * reste retenu pour qui saura l'accomplir, l'onglet ne se rejoue pas à chaque
 * rechargement.
 */
export function reprendreVue(): string | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const lu = JSON.parse(brut) as {
      geste?: unknown;
      quand?: unknown;
      vue?: unknown;
    };
    if (typeof lu.quand !== "number" || Date.now() - lu.quand > DUREE_MS) {
      localStorage.removeItem(CLE);
      return null;
    }
    if (typeof lu.vue !== "string") return null;
    localStorage.setItem(
      CLE,
      JSON.stringify({ geste: lu.geste, quand: lu.quand }),
    );
    return lu.vue;
  } catch {
    return null;
  }
}

export function oublierIntention(): void {
  try {
    localStorage.removeItem(CLE);
  } catch {}
}

/**
 * Rend le geste retenu si `accepte` le reconnaît, et l'efface : il ne sera
 * repris qu'une fois, par un seul onglet. Un geste que l'appelant ne reconnaît
 * pas reste en place pour celui qui saura le reprendre.
 */
export function reprendreIntention(
  accepte: (geste: string) => boolean,
): string | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const lu = JSON.parse(brut) as { geste?: unknown; quand?: unknown };
    if (
      typeof lu.geste !== "string" ||
      typeof lu.quand !== "number" ||
      Date.now() - lu.quand > DUREE_MS
    ) {
      localStorage.removeItem(CLE);
      return null;
    }
    if (!accepte(lu.geste)) return null;
    localStorage.removeItem(CLE);
    return lu.geste;
  } catch {
    return null;
  }
}
