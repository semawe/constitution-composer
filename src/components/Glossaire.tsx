"use client";

import { fontVars } from "@/lib/branding";
import { GLOSSARY, GLOSSARY_META } from "@/lib/glossary";

export default function Glossaire({ font }: { font: string }) {
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8"
      style={fontVars(font)}
    >
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          Termes définis
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-slate-900 sm:text-4xl">
          {GLOSSARY_META.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{GLOSSARY_META.intro}</p>
      </header>

      <dl className="doc-prose space-y-5 text-[1.05rem] text-slate-800">
        {GLOSSARY.map((t) => (
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
