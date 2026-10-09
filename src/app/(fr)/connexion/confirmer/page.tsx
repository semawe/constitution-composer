import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";
import ConfirmerConnexion from "@/components/compte/ConfirmerConnexion";
import { TEXTES_CONFIRMATION } from "@/components/compte/confirmer-textes";

// La page où mène le lien de connexion reçu par courriel. Elle ne connecte que
// sur un clic (voir ConfirmerConnexion) ; jamais indexée.
export const metadata: Metadata = {
  title: "Confirmer la connexion",
  robots: { index: false, follow: false },
};

export default function ConfirmerConnexionPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav locale="fr" />
      <main className="flex-1 mx-auto w-full max-w-xl px-4 pb-24 pt-16">
        <h1 className="font-serif text-3xl font-medium leading-tight text-strong">
          {TEXTES_CONFIRMATION.fr.titre}
        </h1>
        <div className="mt-8">
          <ConfirmerConnexion locale="fr" />
        </div>
      </main>
      <SiteFooter locale="fr" />
    </div>
  );
}
