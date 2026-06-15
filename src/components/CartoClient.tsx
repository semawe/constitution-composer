"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";
import { ORGS } from "@/data/orgs-carto";

const GOUVERNANCE_COLORS: Record<string, string> = {
  "Holacracy 5.0": "bg-blue-100 text-blue-700",
  "Holacracy 4.1": "bg-red-100 text-red-700",
  "Gouvernance partagée": "bg-slate-100 text-slate-600",
  "Sociocratie": "bg-yellow-100 text-yellow-700",
  "Opale": "bg-amber-100 text-amber-700",
  "Entreprise libérée": "bg-green-100 text-green-700",
};

const ALL_GOUVERNANCES = Array.from(
  new Set(ORGS.flatMap((o) => o.gouvernance))
).sort();

const ALL_PAYS = Array.from(
  new Set(ORGS.map((o) => o.pays).filter(Boolean))
).sort((a, b) => a.localeCompare(b, "fr"));

export default function CartoClient() {
  const [search, setSearch] = useState("");
  const [filtreGouv, setFiltreGouv] = useState<string | null>(null);
  const [filtrePays, setFiltrePays] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ORGS.filter((o) => {
      if (filtreGouv && !o.gouvernance.includes(filtreGouv)) return false;
      if (filtrePays && o.pays !== filtrePays) return false;
      if (q && !o.nom.toLowerCase().includes(q) && !o.ville.toLowerCase().includes(q) && !o.pays.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, filtreGouv, filtrePays]);

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
            {ORGS.length}{" "}organisations qui pratiquent l&apos;Holacratie, la
            gouvernance partagée ou des modes voisins, recensées par Sémawé.
          </p>
        </div>

        {/* Filtres */}
        <div className="mt-8 flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Chercher une organisation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-400 focus:outline-none sm:w-72"
          />
          <select
            value={filtreGouv ?? ""}
            onChange={(e) => setFiltreGouv(e.target.value || null)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
          >
            <option value="">Toutes les gouvernances</option>
            {ALL_GOUVERNANCES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select
            value={filtrePays ?? ""}
            onChange={(e) => setFiltrePays(e.target.value || null)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
          >
            <option value="">Tous les pays</option>
            {ALL_PAYS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Compteur */}
        <p className="mt-4 text-sm text-slate-400">
          {filtered.length === ORGS.length
            ? `${ORGS.length} organisations`
            : `${filtered.length} sur ${ORGS.length}`}
        </p>

        {/* Grille */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((org) => (
            <div
              key={org.nom}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
            >
              <div className="flex-1">
                {org.site ? (
                  <a
                    href={org.site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-slate-900 hover:text-teal-700 hover:underline"
                  >
                    {org.nom}
                  </a>
                ) : (
                  <span className="font-medium text-slate-900">{org.nom}</span>
                )}
                {(org.ville || org.pays) && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {[org.ville, org.pays].filter(Boolean).join(", ")}
                  </p>
                )}
                {org.effectif && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {org.effectif} personnes
                  </p>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {org.gouvernance.map((g) => (
                  <span
                    key={g}
                    className={`rounded-full px-2 py-0.5 text-[0.67rem] font-medium ${GOUVERNANCE_COLORS[g] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-12 text-center text-sm text-slate-400">
            Aucune organisation ne correspond à ces critères.
          </p>
        )}

        {/* Contribuer */}
        <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="font-medium text-slate-800">Contribuer à la carte</h2>
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
