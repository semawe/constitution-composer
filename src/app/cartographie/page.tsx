import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Cartographie — Constitution Holacracy v6",
  description:
    "La cartographie de la Constitution Holacracy v6 : structure, modules et articulations.",
};

export default function CartographiePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-16">
        <h1 className="font-serif text-4xl font-medium leading-tight text-slate-900">
          Cartographie
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          La cartographie de la Constitution v6 trouvera ici sa place native,
          en remplacement de la page Notion publique actuelle.
        </p>
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white/40 p-10 text-center text-sm text-slate-500">
          Contenu de la cartographie à intégrer (chantier en cours).
        </div>
        <Link
          href="/composer"
          className="mt-10 inline-block rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          Composer ma Constitution →
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
