"use client";

import Link from "next/link";
import type { ConstitutionData, Module, Tier } from "@/lib/constitution";
import { getAppMeta } from "@/data/apps-meta";
import { MARKETPLACE, type Locale } from "@/lib/i18n";
import { submissionsAvailable } from "@/lib/submissions";
import AppSubmissions from "@/components/AppSubmissions";

const TIER_BADGE: Partial<Record<Tier, { label: string; cls: string }>> = {
  extension: {
    label: "Extension",
    cls: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  app: { label: "App", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
};

export default function Marketplace({
  data,
  onOpen,
  locale = "fr",
  signedIn = false,
  onRequestSignIn = () => {},
}: {
  data: ConstitutionData;
  onOpen: (anchor: string) => void;
  locale?: Locale;
  signedIn?: boolean;
  onRequestSignIn?: () => void;
}) {
  const t = MARKETPLACE[locale];
  const extensions = data.modules.filter((m) => m.tier === "extension");
  const apps = data.modules.filter((m) => m.tier === "app");
  const labelOf = (id: string) =>
    data.modules.find((m) => m.id === id)?.label ?? id;

  const proposeMailto = `mailto:contact@semawe.fr?subject=${encodeURIComponent(
    t.proposeSubject,
  )}&body=${encodeURIComponent(t.proposeBody)}`;

  const renderCard = (m: Module) => {
    const badge = TIER_BADGE[m.tier];
    const anchor = m.insertions[0]?.anchor ?? "";
    return (
      <div
        key={m.id}
        className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-lg font-semibold text-slate-900">
            {m.label}
          </h2>
          {badge && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${badge.cls}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        {getAppMeta(m.id) && (
          <p className="mt-1 text-xs italic text-slate-400">
            {getAppMeta(m.id)!.tagline}
          </p>
        )}
        <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
          {m.description}
        </p>
        {m.requires.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            {t.requires} {m.requires.map(labelOf).join(", ")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/apps/${m.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            {t.discover}
          </Link>
          <button
            onClick={() => onOpen(anchor)}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            {t.activate}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          {t.beyond}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-slate-900 sm:text-4xl">
          {t.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t.subtitle}
        </p>
      </header>

      {extensions.length > 0 && (
        <section className="mb-10">
          <h2 className="font-serif text-xl font-semibold text-slate-900">
            {t.sectionExtensions}
          </h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">
            {t.sectionExtensionsDesc}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {extensions.map(renderCard)}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-serif text-xl font-semibold text-slate-900">
          {t.sectionApps}
        </h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          {t.sectionAppsDesc}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">{apps.map(renderCard)}</div>
      </section>

      {submissionsAvailable ? (
        <AppSubmissions
          signedIn={signedIn}
          onRequestSignIn={onRequestSignIn}
          locale={locale}
        />
      ) : (
        <section className="mt-10 border-t border-slate-200 pt-8">
          <a
            href={proposeMailto}
            className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-5 text-center transition hover:border-teal-400 hover:bg-teal-50/40"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-3xl font-light leading-none text-slate-500 transition group-hover:bg-teal-600 group-hover:text-white">
              +
            </span>
            <h2 className="mt-3 font-serif text-lg font-semibold text-slate-900">
              {t.proposeTitle}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {t.proposeDesc}
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition group-hover:bg-teal-600">
              {t.proposeCta}
            </span>
          </a>
        </section>
      )}
    </div>
  );
}
