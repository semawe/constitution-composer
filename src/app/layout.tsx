import type { Metadata } from "next";
import { Geist, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://constitution-composer.com"),
  title: "Composer sa Constitution : Holacracy v6",
  description:
    "Composez votre propre Constitution à partir d'un socle, à la carte.",
  // "./" : canonical résolue par page (la racine -> /, /admin -> /admin).
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
    title: "Composer sa Constitution : Holacracy v6",
    description:
      "Composez votre propre Constitution à partir d'un socle, à la carte.",
    locale: "fr_FR",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Composer sa Constitution : Holacracy v6",
    description:
      "Composez votre propre Constitution à partir d'un socle, à la carte.",
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
      className={`${geistSans.variable} ${sourceSerif.variable} dark h-full antialiased`}
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
