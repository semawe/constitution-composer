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
