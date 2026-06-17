import type { Metadata } from "next";
import VersionDoc from "@/components/VersionDoc";
import { defaultActive, type ConstitutionData } from "@/lib/constitution";
import raw from "@/data/constitution.en.json";

const data = raw as unknown as ConstitutionData;

export const metadata: Metadata = {
  title: "Holacracy Constitution v6 [Alpha] — Lite version",
  description:
    "The Lite version of the Holacracy Constitution v6 [Alpha]: the core plus all removable blocks checked by default, without extensions or apps.",
  alternates: {
    canonical: "https://constitution-composer.com/en/lite",
    languages: { fr: "https://constitution-composer.com/lite" },
  },
};

export default function LitePageEN() {
  return (
    <VersionDoc
      data={data}
      active={defaultActive(data)}
      locale="en"
      versionName="Lite version"
      tagline="The full Lite: the core, plus all removable blocks checked by default. Without extensions or apps."
      ctaLabel="Customize in the Composer →"
      ctaHref="/en/composer"
    />
  );
}
