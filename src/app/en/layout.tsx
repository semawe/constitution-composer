import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://constitution-composer.com"),
  alternates: {
    canonical: "./",
    languages: {
      "fr": "https://constitution-composer.com",
      "en": "https://constitution-composer.com/en",
    },
  },
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="alternate" hrefLang="fr" href="https://constitution-composer.com" />
      <link rel="alternate" hrefLang="x-default" href="https://constitution-composer.com" />
      {children}
    </>
  );
}
