// Les politiques de sécurité du contenu du site, une par backend.
//
// Écrites une fois ici, recopiées mot pour mot là où un serveur les sert :
// `public/.htaccess` (mutualisé, build Supabase), `deploy/nginx/*.conf`
// (instance, build « serveur »). `scripts/deploiement.test.mjs` vérifie que les
// recopies n'ont pas divergé. `scripts/serve-out.mjs` choisit la politique
// d'après la marque du build qu'il sert.
//
// `unsafe-inline` sur script-src reste nécessaire : Next sème des scripts
// inline de sérialisation (self.__next_f) dont le contenu varie à chaque build,
// ce qui exclut une liste de hachages tenable en export statique.

const COMMUN_AVANT = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cloud.umami.is; ";
const COMMUN_APRES =
  "img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; " +
  "frame-ancestors 'self'";

/**
 * Build « serveur » : le service des comptes est sur la même origine. Ne
 * restent joignables que le site lui-même et Umami (tâche ERP 3045, § 5).
 */
export const CSP_SERVEUR =
  COMMUN_AVANT +
  "connect-src 'self' https://cloud.umami.is https://gateway.umami.is; " +
  COMMUN_APRES;

/** Build Supabase : la politique du mutualisé, tant que la production en dépend. */
export const CSP_SUPABASE =
  COMMUN_AVANT +
  "connect-src 'self' https://zzebhtyvbzfnfrjhqiia.supabase.co wss://zzebhtyvbzfnfrjhqiia.supabase.co " +
  "https://cloud.umami.is https://gateway.umami.is; " +
  COMMUN_APRES;

/** La politique qui convient à un build, d'après sa marque `cc-backend`. */
export function cspPourMarque(marque) {
  return typeof marque === 'string' && marque.startsWith('supabase:') ? CSP_SUPABASE : CSP_SERVEUR;
}
