import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";
import constitutionData from "@/data/constitution.fr.json";
import { getAppMeta, appIds } from "@/data/apps-meta";
import type { ConstitutionData } from "@/lib/constitution";

const data = constitutionData as unknown as ConstitutionData;

export function generateStaticParams() {
  return appIds.map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meta = getAppMeta(id);
  const mod = data.modules.find((m) => m.id === id);
  if (!meta || !mod) return { title: "App introuvable" };
  return {
    title: `${mod.label} — App Store Constitution Holacracy`,
    description: meta.tagline,
    robots: { index: true, follow: true },
  };
}

const TIER_LABEL: Record<string, { label: string; cls: string }> = {
  extension: {
    label: "Extension constitutionnelle",
    cls: "bg-violet-50 text-violet-800 ring-violet-200",
  },
  app: {
    label: "App",
    cls: "bg-rose-50 text-rose-800 ring-rose-200",
  },
};

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meta = getAppMeta(id);
  const mod = data.modules.find((m) => m.id === id);

  if (!meta || !mod) notFound();

  const tier = TIER_LABEL[mod.tier];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-16">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-slate-400">
          <Link href="/composer" className="hover:text-slate-600">
            App Store
          </Link>
          <span>/</span>
          <span className="text-slate-600">{mod.label}</span>
        </nav>

        {/* En-tête */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1">
            <h1 className="font-serif text-4xl font-semibold text-slate-900">
              {mod.label}
            </h1>
            <p className="mt-3 text-xl leading-relaxed text-slate-600">
              {meta.tagline}
            </p>
          </div>
          {tier && (
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${tier.cls}`}
            >
              {tier.label}
            </span>
          )}
        </div>

        {/* Badge certification (prototype) */}
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
          <span className="text-slate-400">
            {meta.certified ? "✓" : "○"}
          </span>
          {meta.certified
            ? `Certifiée par ${meta.certifier ?? "un coach Holacracy"}`
            : "Non certifiée — en phase de prototype"}
        </div>

        {/* Description longue */}
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Description
          </h2>
          <p className="mt-3 leading-relaxed text-slate-700">
            {meta.longDescription}
          </p>
        </section>

        {/* Exemples */}
        {meta.examples.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Exemples concrets
            </h2>
            <ul className="mt-3 space-y-3">
              {meta.examples.map((ex, i) => (
                <li key={i} className="flex gap-3 text-slate-700">
                  <span className="mt-1 shrink-0 text-teal-500">→</span>
                  <span className="leading-relaxed">{ex}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Provenance et créateur */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Origine
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {meta.origin}
            </p>
          </section>
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Créée par
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-800">
              {meta.creator}
            </p>
            {meta.organizations.length > 0 && (
              <>
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Utilisée par
                </h3>
                <ul className="mt-1 space-y-1">
                  {meta.organizations.map((org) => (
                    <li key={org} className="text-sm text-slate-600">
                      {org}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        {/* Texte constitutionnel (premier extrait) */}
        {mod.insertions[0] && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Ce que cela ajoute à votre Constitution
            </h2>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-5 py-4 font-mono text-sm leading-relaxed text-slate-700 shadow-sm">
              <p className="line-clamp-6 whitespace-pre-wrap">
                {mod.insertions[0].text}
              </p>
              {mod.insertions[0].text.length > 400 && (
                <p className="mt-2 text-xs text-slate-400">
                  (extrait — le texte complet s&apos;affiche dans le composeur)
                </p>
              )}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={`/composer#${mod.insertions[0]?.anchor ?? ""}`}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Activer dans le composeur →
          </Link>
          <Link
            href="/composer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
          >
            Retour à l&apos;App Store
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
