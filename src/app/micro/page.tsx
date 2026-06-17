import type { Metadata } from "next";
import VersionDoc from "@/components/VersionDoc";
import { type ConstitutionData } from "@/lib/constitution";
import raw from "@/data/constitution.fr.json";

const data = raw as ConstitutionData;

export const metadata: Metadata = {
  title: "Constitution Holacracy v6 [Alpha] — version Micro",
  description:
    "La version Micro de la Constitution Holacracy v6 [Alpha] : le socle incompressible seul, sans bloc retirable ni extension. À lire en intégralité.",
  alternates: {
    canonical: "https://constitution-composer.com/micro",
    languages: { en: "https://constitution-composer.com/en/micro" },
  },
};

export default function MicroPage() {
  return (
    <VersionDoc
      data={data}
      active={new Set<string>()}
      locale="fr"
      versionName="Version Micro"
      tagline="Le socle incompressible seul : le strict minimum constitutionnel, sans aucun bloc retirable, extension ni application."
      ctaLabel="Personnaliser dans le Composer →"
      ctaHref="/composer"
    />
  );
}
