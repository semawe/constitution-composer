import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Tete } from "./tete";

// La page 404 de tout le site. Avec deux layouts racine (un par langue), il n'y
// a plus de layout unique dont la composer : sans ce fichier, Next sert une
// page nue, sans langue déclarée ni feuille de style. Une adresse inconnue ne
// dit pas dans quelle langue on la cherchait, donc la page parle les deux.
export const metadata: Metadata = {
  title: "Page introuvable · Page not found",
  robots: { index: false, follow: true },
};

export default function GlobalNotFound() {
  return (
    <html lang="fr" suppressHydrationWarning className="dark h-full antialiased">
      <head>
        <Tete />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            404
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-strong">
            Cette page n&apos;existe pas.
          </h1>
          <p className="mt-3 text-body">
            L&apos;adresse est peut-être incomplète, ou la page a changé de
            place.
          </p>
          <p className="mt-6">
            <Link
              href="/"
              className="font-medium text-body underline decoration-rule-strong underline-offset-4 transition hover:text-strong"
            >
              Revenir à l&apos;accueil
            </Link>
          </p>
          <div lang="en" className="mt-10 border-t border-rule pt-8">
            <h2 className="font-serif text-xl font-semibold text-strong">
              This page does not exist.
            </h2>
            <p className="mt-3 text-body">
              The address may be incomplete, or the page may have moved.
            </p>
            <p className="mt-6">
              <Link
                href="/en"
                className="font-medium text-body underline decoration-rule-strong underline-offset-4 transition hover:text-strong"
              >
                Back to the home page
              </Link>
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
