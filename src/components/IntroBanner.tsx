"use client";

import { INTRO_BANNER, type Locale } from "@/lib/i18n";

const LS_KEY = "cc-intro-dismissed";

/** Bandeau d'introduction : proposition de valeur + "comment ça marche".
 *  Rendu statiquement (présent dans le HTML exporté) ; une fois fermé, masqué
 *  sans flash par la classe `intro-off` posée sur <html> avant le paint. */
export default function IntroBanner({ locale = "fr" }: { locale?: Locale }) {
  const t = INTRO_BANNER[locale];

  const dismiss = () => {
    document.documentElement.classList.add("intro-off");
    try {
      localStorage.setItem(LS_KEY, "1");
    } catch {}
  };

  return (
    <section
      data-intro
      aria-label={t.ariaLabel}
      className="relative mb-8 rounded-lg border border-teal-200/60 bg-teal-50/50 p-5 dark:border-teal-800/40 dark:bg-teal-950/20"
    >
      <button
        onClick={dismiss}
        aria-label={t.ariaClose}
        className="absolute right-3 top-3 rounded px-1.5 text-sm text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
      >
        ✕
      </button>
      <h2 className="pr-8 font-serif text-lg font-semibold text-slate-900">
        {t.title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        {t.body}
      </p>
      <details className="mt-3 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700 transition hover:text-slate-900">
          {t.howTitle}
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {t.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
