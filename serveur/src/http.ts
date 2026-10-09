// Outils HTTP sur les objets Request et Response standard : réponses JSON
// jamais mises en cache, cookies, garde d'origine, lecture des corps.

export const ENTETES_JSON: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function json(statut: number, corps: unknown, cookies: string[] = []): Response {
  const entetes = new Headers(ENTETES_JSON);
  for (const c of cookies) entetes.append("set-cookie", c);
  return new Response(JSON.stringify(corps), { status: statut, headers: entetes });
}

/** Codes d'erreur lus par le client (LIMIT, REFERENCE et AUTH reprennent ses erreurs). */
export type CodeErreur =
  | "AUTH"
  | "COMPTE"
  | "ORIGINE"
  | "INVALIDE"
  | "INTROUVABLE"
  | "LIMIT"
  | "QUOTA"
  | "REFERENCE"
  | "LOGO"
  | "TROP_GROS"
  | "FREIN"
  | "LIEN_INVALIDE"
  | "NAVIGATEUR"
  | "ENVOI"
  | "INDISPONIBLE"
  | "INTERNE";

export function erreur(statut: number, code: CodeErreur, cookies: string[] = []): Response {
  return json(statut, { erreur: code }, cookies);
}

export function redirection(cible: string, cookies: string[] = []): Response {
  const entetes = new Headers({ location: cible, "cache-control": "no-store" });
  for (const c of cookies) entetes.append("set-cookie", c);
  return new Response(null, { status: 303, headers: entetes });
}

/** `__Host-` en HTTPS : Secure, Path=/, aucun Domain, donc ni posable ni lisible ailleurs. */
export function nomCookie(base: string, origine: string): string {
  return origine.startsWith("https://") ? `__Host-${base}` : base;
}

export function cookie(
  nom: string,
  valeur: string,
  maxAgeSecondes: number,
  origine: string,
): string {
  const morceaux = [
    `${nom}=${valeur}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSecondes}`,
  ];
  if (origine.startsWith("https://")) morceaux.push("Secure");
  return morceaux.join("; ");
}

export function effacerCookie(nom: string, origine: string): string {
  return cookie(nom, "", 0, origine);
}

export function lireCookie(requete: Request, nom: string): string | null {
  const brut = requete.headers.get("cookie");
  if (!brut) return null;
  for (const morceau of brut.split(";")) {
    const i = morceau.indexOf("=");
    if (i < 0) continue;
    if (morceau.slice(0, i).trim() === nom) return morceau.slice(i + 1).trim() || null;
  }
  return null;
}

/**
 * Garde d'origine des écritures (modèle : app-deroules, requireSameOrigin).
 * Une écriture sans en-tête Origin, ou venue d'une autre origine, est refusée.
 */
export function gardeOrigine(requete: Request, origine: string): Response | null {
  const recue = requete.headers.get("origin");
  if (!recue) return erreur(403, "ORIGINE");
  try {
    if (new URL(recue).origin !== origine) return erreur(403, "ORIGINE");
  } catch {
    return erreur(403, "ORIGINE");
  }
  return null;
}

/** Corps JSON objet, ou null s'il est absent, mal typé ou mal formé. */
export async function lireJson(requete: Request): Promise<Record<string, unknown> | null> {
  const type = requete.headers.get("content-type")?.toLowerCase() ?? "";
  if (!type.startsWith("application/json")) return null;
  try {
    const valeur: unknown = JSON.parse(await requete.text());
    if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return null;
    return valeur as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Corps de formulaire (page de confirmation du lien), ou null. */
export async function lireFormulaire(requete: Request): Promise<URLSearchParams | null> {
  const type = requete.headers.get("content-type")?.toLowerCase() ?? "";
  if (!type.startsWith("application/x-www-form-urlencoded")) return null;
  return new URLSearchParams(await requete.text());
}

/** Seuls les chemins locaux sont admis comme retour. */
export function cheminLocal(valeur: unknown): string | null {
  if (typeof valeur !== "string" || valeur.length > 512) return null;
  if (!valeur.startsWith("/") || valeur.startsWith("//") || valeur.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(valeur)) return null;
  return valeur;
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function estUuid(valeur: unknown): valeur is string {
  return typeof valeur === "string" && RE_UUID.test(valeur);
}
