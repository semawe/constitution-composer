// Fichier généré par `npm run release:new`. Ne pas éditer à la main :
// `npm run release:check` compare son contenu à l'archive et rougit sinon.
//
// Les imports sont statiques par nécessité : un bundle ne résout pas un
// chemin calculé à l'exécution. Chaque release archivée est donc nommée ici.

import type { ConstitutionData } from "@/lib/constitution";

import r_2026_08_19_fr from "@/data/releases/2026-08-19/constitution.fr.json";
import r_2026_08_19_en from "@/data/releases/2026-08-19/constitution.en.json";

export interface ArchivedRelease {
  id: string;
  /** Empreinte du fichier archivé, par langue. */
  sha256: Record<string, string>;
  data: Record<string, ConstitutionData>;
}

/** Les releases du fond, de la plus ancienne à la plus récente. */
export const ARCHIVED_RELEASES: ArchivedRelease[] = [
  {
    id: "2026-08-19",
    sha256: {"fr":"69c7be54ae9a01dc7f759202c347725b736573e0fb6dcd860cb1ba86fcf3702e","en":"0568a101bdcc967e301691566183b2b2333cca69c598fe7b8d8dfd0db0b899cd"},
    data: {
      fr: r_2026_08_19_fr as unknown as ConstitutionData,
      en: r_2026_08_19_en as unknown as ConstitutionData,
    },
  },
];
