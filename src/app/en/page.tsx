import type { Metadata } from "next";
import SplashEN from "@/components/SplashEN";

export const metadata: Metadata = {
  title: "Compose your Holacracy Constitution",
  description:
    "Start from a proven core. Activate the modules that fit your organization. Export a ratification-ready PDF.",
  openGraph: {
    type: "website",
    url: "https://constitution-composer.com/en",
    siteName: "Constitution Composer",
    title: "Compose your Holacracy Constitution",
    description:
      "Start from a proven core. Activate the modules that fit your organization. Export a ratification-ready PDF.",
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
