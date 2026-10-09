// Le backend des comptes que ce build embarque, choisi au build.
//
// Trois possibilités, jusqu'à l'extinction de Supabase (tâche ERP 3054) :
//
//   * `serveur`  : le service des comptes de l'instance Sémawé, sous le chemin
//                  « api » de la même origine (adaptateur `./service-http.ts`).
//                  Se demande par NEXT_PUBLIC_BACKEND=serveur.
//   * `supabase` : l'ancien backend, tant que la production en dépend
//                  (adaptateur `./supabase.ts`). C'est le choix par défaut quand
//                  les clés publiques du projet sont fournies, pour que la
//                  commande de build de la production actuelle reste valable.
//   * `demo`     : aucun backend, compte simulé dans le navigateur.
//
// Les variables sont lues par leur nom complet, sans détour : Next ne remplace
// au build que `process.env.NEXT_PUBLIC_…` écrit tel quel.

export type Backend =
  | { type: "serveur" }
  | { type: "supabase"; url: string; cle: string; hote: string }
  | { type: "demo" };

export interface EnvBackend {
  NEXT_PUBLIC_BACKEND?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}

/** Le backend désigné par un environnement de build. Jette sur un choix illisible. */
export function choisirBackend(env: EnvBackend): Backend {
  const demande = (env.NEXT_PUBLIC_BACKEND ?? "").trim();
  if (demande === "serveur") return { type: "serveur" };
  if (demande === "demo") return { type: "demo" };
  if (demande !== "" && demande !== "supabase")
    throw new Error(
      `NEXT_PUBLIC_BACKEND vaut « ${demande} » : attendu serveur, supabase ou demo.`,
    );
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && cle) {
    try {
      return { type: "supabase", url, cle, hote: new URL(url).host };
    } catch {
      // URL illisible : traitée comme absente, la garde ci-dessous s'en charge.
    }
  }
  if (demande === "supabase")
    throw new Error(
      "NEXT_PUBLIC_BACKEND=supabase demande NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  return { type: "demo" };
}

/**
 * La marque `cc-backend` posée dans chaque page, lue par la garde de
 * déploiement : `serveur`, `supabase:<hôte du projet>` ou `demo`.
 */
export function marqueBackend(backend: Backend): string {
  if (backend.type === "supabase") return `supabase:${backend.hote}`;
  return backend.type;
}

/** Le backend de ce build. */
export const BACKEND_CHOISI: Backend = choisirBackend({
  NEXT_PUBLIC_BACKEND: process.env.NEXT_PUBLIC_BACKEND,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/**
 * Un build de production sans backend basculait en silence sur le compte
 * simulé : le site paraissait marcher, annonçait des sauvegardes, et les
 * données ne suivaient pas le compte. Le repli reste possible, mais il se
 * demande (NEXT_PUBLIC_ALLOW_DEMO_MODE=true) ; il ne s'obtient plus par
 * l'absence d'un secret.
 */
export function exigerBackendEnProduction(
  backend: Backend,
  env: { NODE_ENV?: string; NEXT_PUBLIC_ALLOW_DEMO_MODE?: string },
): void {
  if (
    backend.type === "demo" &&
    env.NODE_ENV === "production" &&
    env.NEXT_PUBLIC_ALLOW_DEMO_MODE !== "true"
  )
    throw new Error(
      "Aucun backend de comptes n'est configuré. Un build de production en " +
        "demande un : NEXT_PUBLIC_BACKEND=serveur (service de l'instance), ou " +
        "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase). " +
        "Un build sans compte réel se demande : NEXT_PUBLIC_ALLOW_DEMO_MODE=true.",
    );
}
