import type { Metadata } from "next";
import "../globals.css";
import { Tete } from "../tete";

export const metadata: Metadata = {
  metadataBase: new URL("https://constitution-composer.com"),
  title: "Constitution Holacracy à la carte · édition Sémawé",
  description:
    "Composez votre propre Constitution à partir d'un socle, à la carte. Édition Sémawé non officielle, dérivée de la Constitution Holacracy 5.0.",
  // "./" : canonical résolue par page (la racine -> /, /composer -> /composer).
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
    title: "Constitution Holacracy à la carte · édition Sémawé",
    description:
      "Composez votre propre Constitution à partir d'un socle, à la carte. Édition Sémawé non officielle, dérivée de la Constitution Holacracy 5.0.",
    locale: "fr_FR",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Constitution Holacracy à la carte · édition Sémawé",
    description:
      "Composez votre propre Constitution à partir d'un socle, à la carte. Édition Sémawé non officielle, dérivée de la Constitution Holacracy 5.0.",
  },
};

// Racine française du site. Sa jumelle anglaise est `(en)/layout.tsx` : deux
// layouts racine, parce que la langue se déclare sur `<html>`.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className="dark h-full antialiased"
    >
      <head>
        <Tete />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
