// La référence de contenu d'un document, validée côté serveur (audit du
// 04/10/2026, F01 : jusque-là, seul le navigateur la contrôlait).
//
// Le serveur lit le manifeste que produit scripts/releases.mjs
// (src/data/releases/manifest.json) et applique la règle de `canonicalRef()`
// (src/lib/releases.ts) : release connue, langue fr ou en, fond attendu, et
// empreinte du fichier archivé. Une différence assumée : le navigateur complète
// une référence sans empreinte, le serveur l'exige. Le client à jour l'envoie
// toujours, puisqu'il passe par `canonicalRef()` avant d'écrire.

import { readFileSync } from "node:fs";

export interface Manifeste {
  releases: { id: string; sha256: Record<string, string> }[];
}

export type Fond = "constitution" | "principes";

export function chargerManifeste(chemin: string): Manifeste {
  const brut = JSON.parse(readFileSync(chemin, "utf8")) as unknown;
  const releases = (brut as { releases?: unknown })?.releases;
  if (
    !Array.isArray(releases) ||
    !releases.length ||
    releases.some(
      (r) =>
        !r ||
        typeof r.id !== "string" ||
        !r.sha256 ||
        typeof r.sha256 !== "object" ||
        Object.values(r.sha256).some((v) => typeof v !== "string" || !/^[0-9a-f]{64}$/.test(v)),
    )
  )
    throw new Error(`Manifeste des releases illisible : ${chemin}`);
  return { releases };
}

/** Vrai si `ref` désigne une release archivée, avec la bonne empreinte. */
export function referenceConnue(
  manifeste: Manifeste,
  ref: unknown,
  fond: Fond = "constitution",
): boolean {
  if (!ref || typeof ref !== "object") return false;
  const r = ref as Record<string, unknown>;
  if (typeof r.release !== "string" || !r.release) return false;
  if ((r.kind ?? "constitution") !== fond) return false;
  if (r.locale !== "fr" && r.locale !== "en") return false;
  const release = manifeste.releases.find((x) => x.id === r.release);
  const attendue = release?.sha256[`${fond}.${r.locale}.json`];
  return Boolean(attendue) && r.sha256 === attendue;
}
