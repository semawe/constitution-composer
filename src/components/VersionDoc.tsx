import { type ReactNode } from "react";
import Link from "next/link";
import { compose, type ConstitutionData } from "@/lib/constitution";
import { fontVars } from "@/lib/branding";
import { SiteNav, SiteFooter } from "@/components/SiteChrome";
import type { Locale } from "@/lib/i18n";
import { REPO_V6_URL, v5Href } from "@/lib/links";

// Rendu Markdown léger (gras + listes), identique au visualiseur /admin/view.
function inline(s: string, kb: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${kb}-${i}`} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${kb}-${i}`}>{part}</span>
    ),
  );
}
function prose(text: string, kb: string): ReactNode[] {
  return text.split(/\n\n/).map((chunk, i) => {
    const lines = chunk.split("\n");
    if (lines.length > 1 && lines.every((l) => /^- /.test(l.trim()))) {
      return (
        <ul key={i} className="mb-3 ml-5 list-disc space-y-1">
          {lines.map((l, j) => (
            <li key={j}>{inline(l.trim().replace(/^- /, ""), `${kb}-${i}-${j}`)}</li>
          ))}
        </ul>
      );
    }
    if (lines.length > 1 && lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
      return (
        <ol key={i} className="mb-3 ml-5 list-decimal space-y-1">
          {lines.map((l, j) => (
            <li key={j}>
              {inline(l.trim().replace(/^\d+\.\s/, ""), `${kb}-${i}-${j}`)}
            </li>
          ))}
        </ol>
      );
    }
    return (
      <p key={i} className="mb-3 leading-relaxed">
        {inline(chunk, `${kb}-${i}`)}
      </p>
    );
  });
}

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
          source: "Source (v6 alpha) on GitHub",
          v5: "For the official, stable 5.0 version of Holacracy",
        }
      : {
          source: "Code source (v6 alpha) sur GitHub",
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
                {prose(it.text, it.key)}
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
