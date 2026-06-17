import type { Metadata } from "next";
import VersionDoc from "@/components/VersionDoc";
import { defaultActive, type ConstitutionData } from "@/lib/constitution";
import raw from "@/data/constitution.fr.json";

const data = raw as ConstitutionData;

export const metadata: Metadata = {
  title: "Constitution Holacracy v6 [Alpha] — version Lite",
  description:
    "La version Lite de la Constitution Holacracy v6 [Alpha] : le socle plus tous les blocs retirables cochés par défaut, sans extension ni application.",
  alternates: {
    canonical: "https://constitution-composer.com/lite",
    languages: { en: "https://constitution-composer.com/en/lite" },
  },
};

export default function LitePage() {
  return (
    <VersionDoc
      data={data}
      active={defaultActive(data)}
      locale="fr"
      versionName="Version Lite"
      tagline="La Lite complète : le socle, plus tous les blocs retirables cochés par défaut. Sans extension ni application."
      ctaLabel="Personnaliser dans le Composer →"
      ctaHref="/composer"
    />
  );
}
