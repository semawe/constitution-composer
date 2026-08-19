// Les pièces d'interface du Composer, sorties du fichier qui les portait.
//
// `Composer.tsx` faisait 1 796 lignes (tâche #1057) : le panneau, le document,
// les modales, l'état et ces quatre pièces y cohabitaient. Elles vivent ici
// parce qu'elles ne dépendent que de leurs propriétés — aucune ne lit l'état du
// Composer, ce qui en fait le premier découpage sans risque.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { type Module, type Tier } from "@/lib/constitution";
import { COMPOSER, type Locale } from "@/lib/i18n";

/** Extensions et apps sont derrière le mur du compte ; le socle et les blocs retirables non. */
export const isGatedTier = (tier: Tier) =>
  tier === "extension" || tier === "app";

/** Couleurs et libellés par tier, partagés par le panneau et le document. */
export const TIER_UI: Record<
  Tier | "warning",
  { dot: string; bar: string; tag: string; tint: string; chip: string; label: string }
> = {
  core: {
    dot: "bg-slate-400",
    bar: "border-rule",
    tag: "bg-slate-100 text-slate-600 ring-slate-200",
    tint: "",
    chip: "hover:border-field-accent hover:text-slate-700",
    label: "text-slate-500",
  },
  retirable: {
    dot: "bg-teal-500",
    bar: "border-teal-400",
    tag: "bg-teal-50 text-teal-700 ring-teal-200",
    tint: "bg-teal-50/50",
    chip: "hover:border-teal-400 hover:text-teal-700",
    label: "text-teal-700",
  },
  extension: {
    dot: "bg-violet-500",
    bar: "border-violet-400",
    tag: "bg-violet-50 text-violet-700 ring-violet-200",
    tint: "bg-violet-50/50",
    chip: "hover:border-violet-400 hover:text-violet-700",
    label: "text-violet-700",
  },
  pedagogique: {
    dot: "bg-amber-400",
    bar: "border-amber-300",
    tag: "bg-amber-50 text-amber-700 ring-amber-200",
    tint: "bg-amber-50/40",
    chip: "hover:border-amber-400 hover:text-amber-700",
    label: "text-amber-700",
  },
  app: {
    dot: "bg-rose-500",
    bar: "border-rose-400",
    tag: "bg-rose-50 text-rose-700 ring-rose-200",
    tint: "bg-rose-50/50",
    chip: "hover:border-rose-400 hover:text-rose-700",
    label: "text-rose-700",
  },
  warning: {
    dot: "bg-amber-500",
    bar: "border-amber-400",
    tag: "bg-amber-50 text-amber-700 ring-amber-200",
    tint: "bg-amber-50/60",
    chip: "",
    label: "text-amber-700",
  },
};

export function ModuleToggle({
  mod,
  on,
  premium,
  lockedBy,
  requires,
  onToggle,
}: {
  mod: Module;
  on: boolean;
  premium: boolean;
  lockedBy: string[];
  requires: string[];
  onToggle: () => void;
}) {
  const ui = TIER_UI[mod.tier];
  const locked = on && lockedBy.length > 0;
  const title = locked
    ? `Requis par : ${lockedBy.join(", ")}`
    : requires.length
      ? `${mod.description}\n\nActive aussi : ${requires.join(", ")}`
      : mod.description;
  return (
    <li>
      <button
        onClick={onToggle}
        disabled={locked}
        data-mod={mod.id}
        title={title}
        className={`group flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition ${
          on
            ? `${ui.bar} ${ui.tint} text-slate-800`
            : "border-transparent text-slate-600 hover:bg-slate-100"
        } ${locked ? "cursor-not-allowed opacity-90" : ""}`}
      >
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
            on
              ? `${ui.dot} border-transparent text-white`
              : "border-field bg-white"
          }`}
        >
          {on &&
            (locked ? (
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
                <path d="M3.5 5V3.8a2.5 2.5 0 015 0V5h.4A.6.6 0 019.5 5.6v4A.6.6 0 018.9 10.2H3.1A.6.6 0 012.5 9.6v-4A.6.6 0 013.1 5h.4zm1 0h3V3.8a1.5 1.5 0 00-3 0V5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                <path
                  d="M2.5 6.5l2.5 2.5 4.5-5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ))}
        </span>
        <span className="min-w-0 leading-snug">
          {mod.label}
          {premium && !on && (
            <span className="ml-1.5 inline-block align-middle rounded-full bg-slate-100 px-1.5 py-px text-[0.62rem] font-medium text-slate-500">
              compte
            </span>
          )}
          {locked && (
            <span className="mt-0.5 block text-[0.7rem] font-normal text-slate-400">
              requis par {lockedBy.join(", ")}
            </span>
          )}
          {!on && requires.length > 0 && (
            <span className="mt-0.5 block text-[0.7rem] font-normal text-slate-400">
              + active {requires.join(", ")}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export function InsertDivider({
  modules,
  onActivate,
  ui,
}: {
  modules: Module[];
  onActivate: (id: string) => void;
  ui: (typeof COMPOSER)[Locale];
}) {
  const [open, setOpen] = useState(false);
  if (modules.length === 0) return <div className="h-4" />;
  return (
    <div className="group relative mt-5">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={ui.addModuleHere}
          className={`flex h-7 w-7 items-center justify-center rounded-full border bg-background transition duration-200 ${
            open
              ? "rotate-45 border-slate-500 text-slate-700"
              : "border-field text-slate-400 opacity-40 hover:border-field-accent hover:text-slate-700 hover:opacity-100 group-hover:opacity-100"
          }`}
        >
          <span className="text-lg leading-none">+</span>
        </button>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {modules.map((m) => {
                const ui = TIER_UI[m.tier];
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      onActivate(m.id);
                      setOpen(false);
                    }}
                    data-add={m.id}
                    title={m.description}
                    className={`inline-flex items-center gap-1.5 rounded-full border border-dashed border-field px-3 py-1 text-xs text-slate-500 transition ${ui.chip}`}
                  >
                    <span className="text-base leading-none">+</span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PreambleValues({
  values,
  setValues,
}: {
  values: string;
  setValues: (v: string) => void;
}) {
  const [editing, setEditing] = useState(values.trim().length > 0);
  const paraCount = values
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-dashed border-field px-3 py-1 text-xs text-slate-500 transition hover:border-field-accent hover:text-slate-700"
      >
        <span className="text-base leading-none">+</span>
        Ajouter vos valeurs et principes
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-rule bg-white/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Valeurs et principes
        </span>
        <span
          className={`text-xs ${
            paraCount > 4 ? "text-amber-600" : "text-slate-400"
          }`}
        >
          {paraCount}/4 paragraphes
        </span>
      </div>
      <textarea
        value={values}
        onChange={(e) => setValues(e.target.value)}
        rows={6}
        placeholder="Exprimez les valeurs et principes propres à votre organisation. Restez bref : 4 paragraphes maximum. Séparez les paragraphes par une ligne vide."
        className="doc-prose w-full resize-y rounded border border-field bg-white p-3 text-[0.98rem] leading-relaxed text-slate-800 outline-none transition focus:border-field-accent"
      />
      {paraCount > 4 && (
        <p className="mt-1 text-xs text-amber-600">
          Conseil : restez sous 4 paragraphes pour garder le préambule lisible.
        </p>
      )}
    </div>
  );
}

export function Legend({
  tierLabel,
  ui,
}: {
  tierLabel: Record<string, string>;
  ui: (typeof COMPOSER)[Locale];
}) {
  const rows: { key: Tier | "warning"; label: string }[] = [
    { key: "core", label: tierLabel.core ?? "Cœur" },
    { key: "retirable", label: tierLabel.retirable ?? "Retirable" },
    { key: "pedagogique", label: tierLabel.pedagogique ?? "Piste pedagogique" },
    { key: "extension", label: tierLabel.extension ?? "Extension constitutionnelle" },
    { key: "app", label: tierLabel.app ?? "App" },
    { key: "warning", label: ui.legendDefaultRule },
  ];
  // En volet, replié par défaut : six lignes de pure référence qu'on consulte
  // une fois et qui, dépliées en permanence, poussaient le reste du rail sous le
  // pli. `<details>` plutôt qu'un état React — clavier et rendu serveur gratuits.
  return (
    <details className="group/leg mt-8 border-t border-rule pt-4">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        {ui.legend}
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3 transition group-open/leg:rotate-90"
          fill="none"
          aria-hidden
        >
          <path
            d="M6 3.5L10.5 8L6 12.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`h-3 w-1 rounded-full ${TIER_UI[r.key].dot}`} />
            {r.label}
          </li>
        ))}
      </ul>
    </details>
  );
}
