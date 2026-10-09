import type { Metadata } from "next";
import VersionDoc from "@/components/VersionDoc";
import { defaultActive, type ConstitutionData } from "@/lib/constitution";
import raw from "@/data/constitution.en.json";

const data = raw as unknown as ConstitutionData;

export const metadata: Metadata = {
  title: "Lite Constitution · Sémawé edition",
  description:
    "The Lite version of the Sémawé edition: the core plus all removable blocks checked by default, without extensions or apps. Unofficial version, derived from the Holacracy Constitution 5.0.",
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
