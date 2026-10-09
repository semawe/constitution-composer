// Le logo d'une version, validé par le serveur.
//
// Le logo d'une organisation voyage dans la charge d'une version
// (`payload.logo`), en data: URL produite par le lecteur de fichier du
// navigateur. Le client ne l'affiche qu'après `safeLogo()`
// (src/lib/branding.ts) ; le serveur applique la même règle à l'écriture, pour
// deux raisons :
//
//   * le pare-feu applicatif de l'instance sort ce seul champ de l'inspection
//     du CRS sur les routes des versions (un million de caractères base64
//     aléatoires y déclenchaient des faux positifs à chaque charge) : la seule
//     inspection qui lui reste est celle-ci ;
//   * une charge insérée sans passer par le site (requête forgée) ne doit pas
//     pouvoir placer en base une URL externe ou un SVG, qui feraient sortir une
//     requête, ou exécuter un script, chez qui rouvrirait la version.
//
// Règle reprise de safeLogo() : absent ou vide, ou bien une image PNG, JPEG,
// WebP ou GIF en data: URL base64, 1 500 000 caractères au plus. Pas de SVG.

/** Même borne que LOGO_MAX_CHARS du client (src/lib/branding.ts). */
export const LOGO_MAX_CARACTERES = 1_500_000;

const RE_LOGO = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Vrai si `valeur` est un logo admissible dans une charge de version. */
export function logoAdmis(valeur: unknown): boolean {
  if (valeur === undefined || valeur === null || valeur === "") return true;
  if (typeof valeur !== "string" || valeur.length > LOGO_MAX_CARACTERES) return false;
  return RE_LOGO.test(valeur);
}
