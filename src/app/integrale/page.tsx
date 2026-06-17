import type { Metadata } from "next";
import VersionDoc from "@/components/VersionDoc";
import { type ConstitutionData } from "@/lib/constitution";
import raw from "@/data/constitution.fr.json";

const data = raw as ConstitutionData;

export const metadata: Metadata = {
  title: "Constitution Holacracy v6 [Alpha] — version Intégrale",
  description:
    "La version Intégrale de la Constitution Holacracy v6 [Alpha] : le socle, tous les blocs retirables et l'ensemble des extensions et applications.",
  alternates: {
    canonical: "https://constitution-composer.com/integrale",
    languages: { en: "https://constitution-composer.com/en/integrale" },
  },
};

export default function IntegralePage() {
  return (
    <VersionDoc
      data={data}
      active={new Set(data.modules.map((m) => m.id))}
      locale="fr"
      versionName="Version Intégrale"
      tagline="Tout activé : le socle, tous les blocs retirables, et l'ensemble des extensions et applications disponibles."
      ctaLabel="Personnaliser dans le Composer →"
      ctaHref="/composer"
    />
  );
}
