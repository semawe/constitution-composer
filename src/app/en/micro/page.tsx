import type { Metadata } from "next";
import VersionDoc from "@/components/VersionDoc";
import { type ConstitutionData } from "@/lib/constitution";
import raw from "@/data/constitution.en.json";

const data = raw as unknown as ConstitutionData;

export const metadata: Metadata = {
  title: "Holacracy Constitution v6 [Alpha] — Micro version",
  description:
    "The Micro version of the Holacracy Constitution v6 [Alpha]: the irreducible core only, with no removable block, extension, or app.",
  alternates: {
    canonical: "https://constitution-composer.com/en/micro",
    languages: { fr: "https://constitution-composer.com/micro" },
  },
};

export default function MicroPageEN() {
  return (
    <VersionDoc
      data={data}
      active={new Set<string>()}
      locale="en"
      versionName="Micro version"
      tagline="The irreducible core only: the bare constitutional minimum, with no removable block, extension, or app."
      ctaLabel="Customize in the Composer →"
      ctaHref="/en/composer"
    />
  );
}
