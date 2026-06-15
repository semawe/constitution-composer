"use client";

import type { ConstitutionData, Module, Tier } from "@/lib/constitution";

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
}: {
  data: ConstitutionData;
  // Ouvre le composeur à l'ancre où l'app s'insère.
  onOpen: (anchor: string) => void;
}) {
  const apps = data.modules.filter(
    (m) => m.tier === "extension" || m.tier === "app",
  );
  const labelOf = (id: string) =>
    data.modules.find((m) => m.id === id)?.label ?? id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          Au-delà de la Lite
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-slate-900 sm:text-4xl">
          App Store
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Des extensions constitutionnelles et des apps à brancher sur votre
          Constitution. Catalogue en construction, d&apos;autres arrivent.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {apps.map((m: Module) => {
          const badge = TIER_BADGE[m.tier];
          const anchor = m.insertions[0]?.anchor ?? "";
          return (
            <div
              key={m.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5"
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
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                {m.description}
              </p>
              {m.requires.length > 0 && (
                <p className="mt-2 text-xs text-slate-400">
                  Nécessite : {m.requires.map(labelOf).join(", ")}
                </p>
              )}
              <button
                onClick={() => onOpen(anchor)}
                className="mt-4 inline-flex items-center justify-center gap-1.5 self-start rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Ouvrir dans le composeur
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
