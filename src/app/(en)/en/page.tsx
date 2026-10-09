import type { Metadata } from "next";
import SplashEN from "@/components/SplashEN";

export const metadata: Metadata = {
  title: "Holacracy Constitution, modular · Sémawé edition",
  description:
    "Start from a proven core. Activate the modules that fit your organization. Export a ratification-ready PDF. Unofficial Sémawé edition, derived from the Holacracy Constitution 5.0.",
  openGraph: {
    type: "website",
    url: "https://constitution-composer.com/en",
    siteName: "Constitution Composer",
    title: "Holacracy Constitution, modular · Sémawé edition",
    description:
      "Start from a proven core. Activate the modules that fit your organization. Export a ratification-ready PDF. Unofficial Sémawé edition, derived from the Holacracy Constitution 5.0.",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  alternates: {
    canonical: "https://constitution-composer.com/en",
    languages: { fr: "https://constitution-composer.com" },
  },
};

export default function HomeEN() {
  return <SplashEN />;
}
