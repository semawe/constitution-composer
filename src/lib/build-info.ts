import { BACKEND_CHOISI, marqueBackend } from "./backend";

// Tampon de build, alimenté par next.config.ts (env bakées au build).
// Permet de savoir d'un coup d'œil quelle version tourne en ligne — utile
// avec le déploiement FTP manuel.

export const BUILD = {
  version: process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev",
  commit: process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "dev",
  date: process.env.NEXT_PUBLIC_BUILD_DATE ?? "",
};

/** Ex. "v1.0.0 · 2026-06-17 · a36c0ed" */
export const buildLabel = [
  `v${BUILD.version}`,
  BUILD.date,
  BUILD.commit,
]
  .filter(Boolean)
  .join(" · ");

/**
 * Le backend que ce build embarque : `serveur` (le service des comptes de
 * l'instance, même origine), `supabase:<hôte du projet>`, ou `demo` quand rien
 * n'est configuré (compte simulé, sauvegardes dans le navigateur).
 *
 * Posée dans l'HTML de chaque page (`src/app/tete.tsx`), cette marque est ce que
 * le déploiement lit pour refuser un build qui ne convient pas à sa cible. Elle
 * dit ce que le build *embarque* ; elle ne prouve pas que le backend répond.
 */
export const BACKEND = marqueBackend(BACKEND_CHOISI);
