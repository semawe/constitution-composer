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
    cls: "bg-extension-soft text-extension-strong ring-extension-border",
  },
  app: {
    label: "App",
    cls: "bg-app-soft text-app-strong ring-app-border",
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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav />
      <main className="flex-1 mx-auto max-w-3xl px-4 pb-24 pt-16">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-muted">
          <Link href="/composer" className="hover:text-body">
            App Store
          </Link>
          <span>/</span>
          <span className="text-body">{mod.label}</span>
        </nav>

        {/* En-tête */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1">
            <h1 className="font-serif text-4xl font-semibold text-strong">
              {mod.label}
            </h1>
            <p className="mt-3 text-xl leading-relaxed text-body">
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
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-rule bg-surface-subtle px-3 py-1.5 text-xs text-muted">
          <span className="text-muted">
            {meta.certified ? "✓" : "○"}
          </span>
          {meta.certified
            ? `Certifiée par ${meta.certifier ?? "un coach Holacracy"}`
            : "Non certifiée — en phase de prototype"}
        </div>

        {/* Description longue */}
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Description
          </h2>
          <p className="mt-3 leading-relaxed text-body">
            {meta.longDescription}
          </p>
        </section>

        {/* Questions de préparation */}
        {meta.preparationQuestions && meta.preparationQuestions.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Préparation (auto-observation)
            </h2>
            <ul className="mt-3 space-y-2">
              {meta.preparationQuestions.map((q, i) => (
                <li key={i} className="flex gap-3 text-body">
                  <span className="mt-1 shrink-0 text-[0.7rem] font-mono text-muted">{i + 1}.</span>
                  <span className="leading-relaxed italic">{q}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Étapes du processus */}
        {meta.steps && meta.steps.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Déroulé du processus — 60 minutes
            </h2>
            <ol className="mt-4 space-y-4">
              {meta.steps.map((step, i) => (
                <li key={i} className="rounded-lg border border-rule-soft bg-surface p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium text-body">
                      <span className="mr-2 font-mono text-sm text-muted">{i + 1}.</span>
                      {step.title}
                    </h3>
                    {step.duration && (
                      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">
                        {step.duration}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-body">{step.description}</p>
                  {step.questions && step.questions.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {step.questions.map((q, j) => (
                        <li key={j} className="flex gap-2 text-sm text-muted">
                          <span className="shrink-0 text-teal-400">›</span>
                          <span className="italic">{q}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Exemples */}
        {meta.examples.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Exemples concrets
            </h2>
            <ul className="mt-3 space-y-3">
              {meta.examples.map((ex, i) => (
                <li key={i} className="flex gap-3 text-body">
                  <span className="mt-1 shrink-0 text-teal-500">→</span>
                  <span className="leading-relaxed">{ex}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Provenance et créateur */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-rule bg-surface-subtle p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Origine
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-body">
              {meta.origin}
            </p>
          </section>
          <section className="rounded-xl border border-rule bg-surface-subtle p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Créée par
            </h2>
            <p className="mt-2 text-sm font-medium text-body">
              {meta.creator}
            </p>
            {meta.organizations.length > 0 && (
              <>
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">
                  Utilisée par
                </h3>
                <ul className="mt-1 space-y-1">
                  {meta.organizations.map((org) => (
                    <li key={org} className="text-sm text-body">
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
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Ce que cela ajoute à votre Constitution
            </h2>
            <div className="mt-3 rounded-xl border border-rule bg-surface px-5 py-4 font-mono text-sm leading-relaxed text-body shadow-sm">
              <p className="line-clamp-6 whitespace-pre-wrap">
                {mod.insertions[0].text}
              </p>
              {mod.insertions[0].text.length > 400 && (
                <p className="mt-2 text-xs text-muted">
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
            className="inline-flex items-center gap-2 rounded-full btn-ink px-5 py-2.5 text-sm font-medium transition"
          >
            Activer dans le composeur →
          </Link>
          <Link
            href="/composer"
            className="inline-flex items-center gap-2 rounded-full border border-field px-5 py-2.5 text-sm font-medium text-body transition hover:border-field-accent hover:text-body"
          >
            Retour à l&apos;App Store
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
