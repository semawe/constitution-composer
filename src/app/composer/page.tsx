import type { Metadata } from "next";
import App from "@/components/App";
import type { ConstitutionData } from "@/lib/constitution";
import type { PrincipesData } from "@/components/Principes";
import constitutionRaw from "@/data/constitution.fr.json";
import principesRaw from "@/data/principes.fr.json";

const constitution = constitutionRaw as ConstitutionData;
const principes = principesRaw as PrincipesData;

// L'outil lui-même : pas du contenu indexable. La splash (/) porte le SEO.
export const metadata: Metadata = {
  title: "Composer : Constitution Holacracy v6",
  robots: { index: false, follow: true },
};

export default function ComposerPage() {
  return <App constitution={constitution} principes={principes} />;
}
