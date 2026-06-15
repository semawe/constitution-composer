import type { Metadata } from "next";
import App from "@/components/App";
import type { ConstitutionData } from "@/lib/constitution";
import type { PrincipesData } from "@/components/Principes";
import constitutionRaw from "@/data/constitution.en.json";

const constitution = constitutionRaw as unknown as ConstitutionData;

// Minimal EN principes: no official HC5 Principles Declaration exists.
// Users can author their own from scratch in the tool.
const principes: PrincipesData = {
  meta: {
    title: "Declaration of Principles",
    version: "5.0",
    source: "",
    notice: "Holacracy® is a trademark of HolacracyOne LLC.",
    license: "CC BY-SA 4.0",
  },
  intro:
    "In adopting this Constitution, we do not merely sign a set of rules. We choose a way of being together in service of a purpose that is greater than ourselves. The principles below state what we commit to: what guides our interpretation of the rules when they are silent, and what remains true as they evolve.",
  principles: [],
};

export const metadata: Metadata = {
  title: "Composer: Holacracy Constitution 5.0",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "https://constitution-composer.com/en/composer",
    languages: { fr: "https://constitution-composer.com/composer" },
  },
};

export default function ComposerPageEN() {
  return <App constitution={constitution} principes={principes} />;
}
