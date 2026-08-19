"use client";

import { useMemo, useState } from "react";
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
  onBack,
}: {
  font: string;
  locale?: Locale;
  onBack?: () => void;
}) {
  const data = locale === "en" ? glossaireEn : glossaireFr;
  const terms = data.terms as GlossaryTerm[];
  const meta = data.meta as { title: string; intro: string };
  const ui = GLOSSAIRE_UI[locale];
  const [query, setQuery] = useState("");
  const normalizedQuery = query
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase(locale);
  const filteredTerms = useMemo(
    () =>
      terms.filter((term) =>
        `${term.term} ${term.definition}`
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLocaleLowerCase(locale)
          .includes(normalizedQuery),
      ),
    [terms, normalizedQuery, locale],
  );

  return (
    <div
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8"
      style={fontVars(font)}
    >
      <header className="mb-8 border-b border-rule pb-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-5 text-sm font-medium text-body transition hover:text-strong"
          >
            ← {ui.back}
          </button>
        )}
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          {ui.definedTerms}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-strong sm:text-4xl">
          {meta.title}
        </h1>
        <p className="mt-2 text-sm text-muted">{meta.intro}</p>
        <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-muted">
          {ui.search}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ui.searchPlaceholder}
            className="mt-1 block w-full rounded-lg border border-field bg-surface px-3 py-2 text-sm font-normal normal-case tracking-normal text-body outline-none transition placeholder:text-muted focus:border-field-accent"
          />
        </label>
      </header>

      <dl className="doc-prose space-y-5 text-[1.05rem] text-body">
        {filteredTerms.map((t) => (
          <div
            key={t.key}
            id={`glossaire-${t.key}`}
            className="scroll-mt-20 border-l-2 border-rule pl-4"
          >
            <dt className="font-serif text-lg font-semibold text-strong">
              {t.term}
            </dt>
            <dd className="mt-1 leading-relaxed">{t.definition}</dd>
          </div>
        ))}
      </dl>
      {filteredTerms.length === 0 && (
        <p className="text-sm text-muted" role="status">
          {ui.noResult}
        </p>
      )}
    </div>
  );
}
