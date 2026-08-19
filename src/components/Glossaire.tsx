"use client";

import { fontVars } from "@/lib/branding";
import type { Locale } from "@/lib/i18n";
import { GLOSSAIRE_UI } from "@/lib/i18n";
import glossaireFr from "@/data/glossaire.fr.json";
import glossaireEn from "@/data/glossaire.en.json";

interface GlossaryTerm {
  key: string;
  term: string;
  definition: string;
}

export default function Glossaire({
  font,
  locale = "fr",
}: {
  font: string;
  locale?: Locale;
}) {
  const data = locale === "en" ? glossaireEn : glossaireFr;
  const terms = data.terms as GlossaryTerm[];
  const meta = data.meta as { title: string; intro: string };
  const ui = GLOSSAIRE_UI[locale];

  return (
    <div
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8"
      style={fontVars(font)}
    >
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          {ui.definedTerms}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-slate-900 sm:text-4xl">
          {meta.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{meta.intro}</p>
      </header>

      <dl className="doc-prose space-y-5 text-[1.05rem] text-slate-800">
        {terms.map((t) => (
          <div
            key={t.key}
            id={`glossaire-${t.key}`}
            className="scroll-mt-20 border-l-2 border-slate-200 pl-4"
          >
            <dt className="font-serif text-lg font-semibold text-slate-900">
              {t.term}
            </dt>
            <dd className="mt-1 leading-relaxed">{t.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
