import type { Metadata } from "next";
import "../globals.css";
import { Tete } from "../tete";

// Racine anglaise du site. Les pages `/en` héritaient du layout français : le
// document s'annonçait `lang="fr"` — un lecteur d'écran prononçait l'anglais
// avec la phonétique française — et leur description par défaut était en
// français (audit du 04/10/2026, F15). La langue se déclare sur `<html>`, donc
// dans un layout racine : il en faut un par langue.
export const metadata: Metadata = {
  metadataBase: new URL("https://constitution-composer.com"),
  title: "Holacracy Constitution, modular · Sémawé edition",
  description:
    "Compose your own Constitution from a proven core, one module at a time. Unofficial Sémawé edition, derived from the Holacracy Constitution 5.0.",
  alternates: {
    canonical: "./",
    languages: {
      fr: "https://constitution-composer.com",
      en: "https://constitution-composer.com/en",
    },
  },
  openGraph: {
    type: "website",
    url: "./",
    siteName: "Constitution Composer",
    title: "Holacracy Constitution, modular · Sémawé edition",
    description:
      "Compose your own Constitution from a proven core, one module at a time. Unofficial Sémawé edition, derived from the Holacracy Constitution 5.0.",
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Holacracy Constitution, modular · Sémawé edition",
    description:
      "Compose your own Constitution from a proven core, one module at a time. Unofficial Sémawé edition, derived from the Holacracy Constitution 5.0.",
  },
};

export default function RootLayoutEN({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="dark h-full antialiased"
    >
      <head>
        <Tete />
        <link rel="alternate" hrefLang="fr" href="https://constitution-composer.com" />
        <link rel="alternate" hrefLang="x-default" href="https://constitution-composer.com" />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
