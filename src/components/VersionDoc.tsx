import Link from "next/link";
import { compose, type ConstitutionData } from "@/lib/constitution";
import { fontVars } from "@/lib/branding";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";
import Prose from "@/components/Prose";
import { type Locale, UI } from "@/lib/i18n";
import { REPO_V6_URL, v5Href } from "@/lib/links";

// Rendu Markdown léger (gras + listes), identique au visualiseur /admin/view.
export interface VersionDocProps {
  data: ConstitutionData;
  active: Set<string>;
  locale: Locale;
  /** « Micro » / « Lite » / « Intégrale ». */
  versionName: string;
  /** Une phrase sous le titre, décrit ce que contient cette version. */
  tagline: string;
  ctaLabel: string;
  ctaHref: string;
}

/**
 * Page publiée en lecture seule d'une version figée de la Constitution.
 * Indexable (SEO) : c'est du contenu, pas l'outil. Le Composer reste l'endroit
 * pour personnaliser.
 */
export default function VersionDoc({
  data,
  active,
  locale,
  versionName,
  tagline,
  ctaLabel,
  ctaHref,
}: VersionDocProps) {
  const items = compose(data, active);
  const branding = fontVars("source-serif");

  const L =
    locale === "en"
      ? {
          source: "The source text on GitHub",
          v5: "For the official, stable 5.0 version of Holacracy",
        }
      : {
          source: "Le texte source sur GitHub",
          v5: "Pour la version stable et officielle 5.0 de Holacracy",
        };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav locale={locale} />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-16" style={branding}>
        <p className="text-xs font-medium uppercase tracking-widest text-teal-600">
          {versionName}
        </p>
        <h1 className="mt-2 font-serif text-4xl font-medium leading-tight text-slate-900">
          {data.meta.title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-600">{tagline}</p>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-slate-500">
          {UI[locale].derivation}
        </p>

        <Link
          href={ctaHref}
          className="mt-6 inline-block rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          {ctaLabel}
        </Link>

        <article className="doc-prose mt-12 border-t border-slate-200 pt-10 text-[1.05rem] text-slate-800">
          {items.map((it) => (
            <section key={it.key} className="mb-8">
              {it.heading && (
                <h2 className="mb-2 font-serif text-2xl font-semibold text-slate-900">
                  {it.heading}
                </h2>
              )}
              <div
                className={
                  it.kind === "block"
                    ? ""
                    : "rounded-r-md border-l-4 border-slate-200 py-2 pl-4"
                }
              >
                {it.kind !== "block" && it.moduleLabel && (
                  <p className="mb-1 text-[0.7rem] uppercase tracking-wide text-slate-400">
                    {it.warning
                      ? `Règle par défaut : ${it.moduleLabel}`
                      : it.moduleLabel}
                  </p>
                )}
                <Prose text={it.text} keyBase={it.key} />
              </div>
            </section>
          ))}
        </article>

        <Link
          href={ctaHref}
          className="mt-8 inline-block rounded-lg bg-teal-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          {ctaLabel}
        </Link>

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <a
            href={REPO_V6_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-slate-800"
          >
            {L.source} ↗
          </a>
          <a
            href={v5Href(locale)}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-slate-800"
          >
            {L.v5} ↗
          </a>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
