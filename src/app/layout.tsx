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
  title: "Composer sa Constitution — Holacracy v6",
  description:
    "Composez votre propre Constitution à partir d'un socle, à la carte.",
  // "./" : canonical résolue par page (la racine -> /, /admin -> /admin).
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    url: "./",
    siteName: "Constitution Composer",
    title: "Composer sa Constitution — Holacracy v6",
    description:
      "Composez votre propre Constitution à partir d'un socle, à la carte.",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary",
    title: "Composer sa Constitution — Holacracy v6",
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
        {/* Applique le thème choisi avant le paint (dark par défaut). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('cc-theme')==='light')document.documentElement.classList.remove('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
