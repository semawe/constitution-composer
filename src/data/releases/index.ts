// Fichier généré par `npm run release:new`. Ne pas éditer à la main :
// `npm run release:check` compare son contenu à l'archive et rougit sinon.
//
// Les imports sont statiques par nécessité : un bundle ne résout pas un
// chemin calculé à l'exécution. Chaque release archivée est donc nommée ici.

import type { ConstitutionData } from "@/lib/constitution";
import type { PrincipesData } from "@/lib/principes-data";

import r_2026_08_19_constitution_fr_json from "@/data/releases/2026-08-19/constitution.fr.json";
import r_2026_08_19_principes_fr_json from "@/data/releases/2026-08-19/principes.fr.json";
import r_2026_08_19_constitution_en_json from "@/data/releases/2026-08-19/constitution.en.json";
import r_2026_08_19_principes_en_json from "@/data/releases/2026-08-19/principes.en.json";
import r_2026_08_19_2_constitution_fr_json from "@/data/releases/2026-08-19-2/constitution.fr.json";
import r_2026_08_19_2_principes_fr_json from "@/data/releases/2026-08-19-2/principes.fr.json";
import r_2026_08_19_2_constitution_en_json from "@/data/releases/2026-08-19-2/constitution.en.json";
import r_2026_08_19_2_principes_en_json from "@/data/releases/2026-08-19-2/principes.en.json";
import r_2026_08_19_3_constitution_fr_json from "@/data/releases/2026-08-19-3/constitution.fr.json";
import r_2026_08_19_3_principes_fr_json from "@/data/releases/2026-08-19-3/principes.fr.json";
import r_2026_08_19_3_constitution_en_json from "@/data/releases/2026-08-19-3/constitution.en.json";
import r_2026_08_19_3_principes_en_json from "@/data/releases/2026-08-19-3/principes.en.json";

export interface ArchivedRelease {
  id: string;
  /** Empreinte de chaque fichier archivé, par nom de fichier. */
  sha256: Record<string, string>;
  constitution: Record<string, ConstitutionData>;
  principes: Record<string, PrincipesData>;
}

/** Les releases du fond, de la plus ancienne à la plus récente. */
export const ARCHIVED_RELEASES: ArchivedRelease[] = [
  {
    id: "2026-08-19",
    sha256: {"constitution.fr.json":"69c7be54ae9a01dc7f759202c347725b736573e0fb6dcd860cb1ba86fcf3702e","principes.fr.json":"45cce694d32d78cce732cdce423b8c92c84d0eff643ef04132870155e944822e","constitution.en.json":"0568a101bdcc967e301691566183b2b2333cca69c598fe7b8d8dfd0db0b899cd","principes.en.json":"60b846fd9bc80ebdc02bca064396c8acd65ac8e69fd9932fb44ff1b752f34339"},
    constitution: {
      fr: r_2026_08_19_constitution_fr_json as unknown as ConstitutionData,
      en: r_2026_08_19_constitution_en_json as unknown as ConstitutionData,
    },
    principes: {
      fr: r_2026_08_19_principes_fr_json as unknown as PrincipesData,
      en: r_2026_08_19_principes_en_json as unknown as PrincipesData,
    },
  },
  {
    id: "2026-08-19-2",
    sha256: {"constitution.fr.json":"95b6c816060b803f3e84bc5a49547c4d8e8aef9fad6c128e1eab99198bcfe2dd","principes.fr.json":"39eb3aa974b582c3ce616efdb65cd9ff23f157282969c4f8e4fd5e42aa5cd243","constitution.en.json":"b37cbca7c52ad1ebbab40c3263d0d9fb5e02ed0f5604d969b99f18982a108b7d","principes.en.json":"0af3a34b7075a6b7b00e088dfb4b4a8429b1a7ee9838ccf34b591fdd60fae0e2"},
    constitution: {
      fr: r_2026_08_19_2_constitution_fr_json as unknown as ConstitutionData,
      en: r_2026_08_19_2_constitution_en_json as unknown as ConstitutionData,
    },
    principes: {
      fr: r_2026_08_19_2_principes_fr_json as unknown as PrincipesData,
      en: r_2026_08_19_2_principes_en_json as unknown as PrincipesData,
    },
  },
  {
    id: "2026-08-19-3",
    sha256: {"constitution.fr.json":"58a49af1098112245d0e99bf52955b514aa006a80a7f76f7a276331bc719acc8","principes.fr.json":"39eb3aa974b582c3ce616efdb65cd9ff23f157282969c4f8e4fd5e42aa5cd243","constitution.en.json":"b37cbca7c52ad1ebbab40c3263d0d9fb5e02ed0f5604d969b99f18982a108b7d","principes.en.json":"0af3a34b7075a6b7b00e088dfb4b4a8429b1a7ee9838ccf34b591fdd60fae0e2"},
    constitution: {
      fr: r_2026_08_19_3_constitution_fr_json as unknown as ConstitutionData,
      en: r_2026_08_19_3_constitution_en_json as unknown as ConstitutionData,
    },
    principes: {
      fr: r_2026_08_19_3_principes_fr_json as unknown as PrincipesData,
      en: r_2026_08_19_3_principes_en_json as unknown as PrincipesData,
    },
  },
];
