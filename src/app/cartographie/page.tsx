import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Cartographie des organisations en Holacratie",
  description:
    "Carte des organisations qui pratiquent l'Holacratie, la sociocratie, l'entreprise libérée ou d'autres modes de gouvernance distribuée. Une ressource proposée par Sémawé.",
};

const GOUVERNANCES = [
  { label: "Holacracy 5.0", color: "bg-blue-100 text-blue-700" },
  { label: "Gouvernance partagée", color: "bg-slate-100 text-slate-600" },
  { label: "Sociocratie", color: "bg-yellow-100 text-yellow-700" },
  { label: "Opale", color: "bg-amber-100 text-amber-700" },
  { label: "Entreprise libérée", color: "bg-green-100 text-green-700" },
  { label: "Holacracy 4.1", color: "bg-red-100 text-red-700" },
];

export default function CartographiePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-16">
        {/* En-tête */}
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Ressource Sémawé
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold text-slate-900">
            Cartographie des organisations
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            Des organisations qui expérimentent des modes de gouvernance
            alternatifs : Holacratie, sociocratie, modèle opale, entreprises
            libérées. Toutes ont en commun l&apos;envie d&apos;explorer des
            fonctionnements plus collaboratifs.
          </p>
        </div>

        {/* Légende des types de gouvernance */}
        <div className="mt-8 flex flex-wrap gap-2">
          {GOUVERNANCES.map((g) => (
            <span
              key={g.label}
              className={`rounded-full px-3 py-1 text-xs font-medium ${g.color}`}
            >
              {g.label}
            </span>
          ))}
        </div>

        {/* Carte Notion intégrée */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3 text-xs font-medium text-slate-500">
            Carte interactive — source Sémawé
          </div>
          <iframe
            src="https://semawe.notion.site/29c9776be461805bab12d1c04b81045b"
            className="h-[640px] w-full"
            frameBorder="0"
            allowFullScreen
            title="Cartographie des organisations en Holacratie"
          />
        </div>

        {/* Fallback / lien direct */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>La carte ne s&apos;affiche pas ?</span>
          <a
            href="https://app.notion.com/p/29c9776be461805bab12d1c04b81045b"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-teal-600 hover:text-teal-700 hover:underline"
          >
            Ouvrir dans Notion →
          </a>
        </div>

        {/* Contribuer */}
        <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="font-medium text-slate-800">
            Contribuer à la carte
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Vous connaissez une organisation qui expérimente ces pratiques ?
            Les données de votre organisation ne sont plus à jour ?
          </p>
          <a
            href="mailto:contact@semawe.fr"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Contacter Sémawé
          </a>
        </section>

        <div className="mt-10">
          <Link
            href="/composer"
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            ← Retour au Composer
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
