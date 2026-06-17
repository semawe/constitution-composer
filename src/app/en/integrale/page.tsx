import type { Metadata } from "next";
import VersionDoc from "@/components/VersionDoc";
import { type ConstitutionData } from "@/lib/constitution";
import raw from "@/data/constitution.en.json";

const data = raw as unknown as ConstitutionData;

export const metadata: Metadata = {
  title: "Holacracy Constitution v6 [Alpha] — Full version",
  description:
    "The Full version of the Holacracy Constitution v6 [Alpha]: the core, all removable blocks, and every extension and application.",
  alternates: {
    canonical: "https://constitution-composer.com/en/integrale",
    languages: { fr: "https://constitution-composer.com/integrale" },
  },
};

export default function IntegralePageEN() {
  return (
    <VersionDoc
      data={data}
      active={new Set(data.modules.map((m) => m.id))}
      locale="en"
      versionName="Full version"
      tagline="Everything on: the core, all removable blocks, and every extension and application available."
      ctaLabel="Customize in the Composer →"
      ctaHref="/en/composer"
    />
  );
}
