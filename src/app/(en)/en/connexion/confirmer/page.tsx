import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";
import ConfirmerConnexion from "@/components/compte/ConfirmerConnexion";
import { TEXTES_CONFIRMATION } from "@/components/compte/confirmer-textes";

// The page the emailed sign-in link leads to. It only signs in on a click (see
// ConfirmerConnexion); never indexed.
export const metadata: Metadata = {
  title: "Confirm sign-in",
  robots: { index: false, follow: false },
};

export default function ConfirmSignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav locale="en" />
      <main className="flex-1 mx-auto w-full max-w-xl px-4 pb-24 pt-16">
        <h1 className="font-serif text-3xl font-medium leading-tight text-strong">
          {TEXTES_CONFIRMATION.en.titre}
        </h1>
        <div className="mt-8">
          <ConfirmerConnexion locale="en" />
        </div>
      </main>
      <SiteFooter locale="en" />
    </div>
  );
}
