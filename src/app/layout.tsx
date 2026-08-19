import type { Metadata } from "next";
import "./globals.css";

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
        {/* Applique avant le paint le thème choisi (dark par défaut) et le
            masquage du bandeau d'introduction s'il a été fermé. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('cc-theme')==='light')document.documentElement.classList.remove('dark');if(localStorage.getItem('cc-intro-dismissed')==='1')document.documentElement.classList.add('intro-off')}catch(e){}",
          }}
        />
        {/* Umami Cloud (mesure sans cookie) : actif seulement si l'id est fourni au build. */}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          />
        )}
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
