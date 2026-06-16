import type { Metadata } from "next";
import App from "@/components/App";
import type { ConstitutionData } from "@/lib/constitution";
import type { PrincipesData } from "@/components/Principes";
import constitutionRaw from "@/data/constitution.en.json";
import principesRaw from "@/data/principes.en.json";

const constitution = constitutionRaw as unknown as ConstitutionData;
const principes = principesRaw as unknown as PrincipesData;

export const metadata: Metadata = {
  title: "Composer: Holacracy Constitution v6 alpha",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "https://constitution-composer.com/en/composer",
    languages: { fr: "https://constitution-composer.com/composer" },
  },
};

export default function ComposerPageEN() {
  return <App constitution={constitution} principes={principes} locale="en" />;
}
