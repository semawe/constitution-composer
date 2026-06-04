"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  type ConstitutionData,
  type Module,
  type Tier,
  modulesForAnchor,
  requiredByActive,
  toggleModule,
} from "@/lib/constitution";

const TIER_UI: Record<
  Tier | "warning",
  { dot: string; bar: string; tag: string; tint: string; chip: string }
> = {
  core: {
    dot: "bg-slate-400",
    bar: "border-slate-200",
    tag: "bg-slate-100 text-slate-600 ring-slate-200",
    tint: "",
    chip: "hover:border-slate-400 hover:text-slate-700",
  },
  integral: {
    dot: "bg-teal-500",
    bar: "border-teal-400",
    tag: "bg-teal-50 text-teal-700 ring-teal-200",
    tint: "bg-teal-50/50",
    chip: "hover:border-teal-400 hover:text-teal-700",
  },
  periphery: {
    dot: "bg-violet-500",
    bar: "border-violet-400",
    tag: "bg-violet-50 text-violet-700 ring-violet-200",
    tint: "bg-violet-50/50",
    chip: "hover:border-violet-400 hover:text-violet-700",
  },
  warning: {
    dot: "bg-amber-500",
    bar: "border-amber-400",
    tag: "bg-amber-50 text-amber-700 ring-amber-200",
    tint: "bg-amber-50/60",
    chip: "",
  },
};

function renderInline(s: string, keyBase: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyBase}-${i}`}>{part}</span>
    ),
  );
}

function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\n/).map((para, i) => (
        <p key={i} className="mb-3 leading-relaxed last:mb-0">
          {renderInline(para, `p${i}`)}
        </p>
      ))}
    </>
  );
}

export default function Composer({ data }: { data: ConstitutionData }) {
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());
  const [showIntent, setShowIntent] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [activeId, setActiveId] = useState<string>(data.blocks[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = useReducedMotion();

  // Scrollspy : surligne dans le sommaire la section la plus haute visible.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveId((vis[0].target as HTMLElement).id);
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 },
    );
    data.blocks.forEach((b) => {
      const el = document.getElementById(b.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [data.blocks]);

  const goTo = (id: string) => {
    setActiveId(id); // retour immédiat, sans attendre le scrollspy
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setMobileOpen(false);
  };

  const handlePdf = async () => {
    setPdfBusy(true);
    try {
      const { generateComposedPdfBlob } = await import("@/lib/pdf");
      const blob = await generateComposedPdfBlob(data, active);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ma-constitution-holacracy.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setPdfBusy(false);
    }
  };

  const toggle = (id: string) =>
    setActive((prev) => toggleModule(data, prev, id));

  // Modules inactifs qui portent un remplacement obligatoire = trous comblés.
  const gaps = data.modules.filter((m) => !active.has(m.id) && m.fallback);

  const tierLabel = useMemo(
    () => Object.fromEntries(data.tiers.map((t) => [t.id, t.label])),
    [data.tiers],
  );

  const modulesByTier = (tier: Tier) =>
    data.modules.filter((m) => m.tier === tier);

  const activeInsertions = (anchor: string) =>
    data.modules
      .filter((m) => active.has(m.id))
      .flatMap((m) =>
        m.insertions
          .map((ins, i) => ({ ins, i }))
          .filter(({ ins }) => ins.anchor === anchor)
          // insertion conditionnelle : tous les modules requis doivent être actifs
          .filter(
            ({ ins }) =>
              !ins.whenActive || ins.whenActive.every((id) => active.has(id)),
          )
          .map(({ ins, i }) => ({ id: `${m.id}-${i}`, mod: m, text: ins.text })),
      );

  const fallbacks = (anchor: string) =>
    data.modules.filter(
      (m) => !active.has(m.id) && m.fallback?.anchor === anchor,
    );

  const availableChips = (anchor: string) =>
    modulesForAnchor(data, anchor).filter((m) => !active.has(m.id));

  const countLabel =
    active.size === 0
      ? "Socle seul"
      : `${active.size} module${active.size > 1 ? "s" : ""} actif${
          active.size > 1 ? "s" : ""
        }`;

  const pct = data.modules.length ? active.size / data.modules.length : 0;
  const versionLabel =
    active.size === 0
      ? "Socle — le cœur seul"
      : active.size === data.modules.length
        ? "Version intégrale"
        : "Version enrichie";

  // Sommaire + composer, partagés entre la sidebar (desktop) et le tiroir (mobile).
  const panel = (
    <div className="thin-scroll max-h-[calc(100vh-4rem)] overflow-y-auto pr-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Sommaire
      </h2>
      <nav className="mt-2 space-y-0.5">
        {data.blocks.map((b) => {
          const on = activeId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => goTo(b.id)}
              className={`block w-full border-l-2 py-1 pl-3 text-left text-[0.82rem] leading-snug transition ${
                on
                  ? "border-slate-900 font-medium text-slate-900"
                  : "border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700"
              }`}
            >
              {b.heading}
            </button>
          );
        })}
      </nav>

      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Composer
      </h2>
      <p className="mt-1 text-sm text-slate-500">{countLabel}</p>
      {gaps.length > 0 && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
          <span className="mt-px">⚠</span>
          <span>
            {gaps.length} règle{gaps.length > 1 ? "s" : ""} par défaut comble
            {gaps.length > 1 ? "nt" : ""} les modules non activés
          </span>
        </p>
      )}

      <div className="mt-4 flex gap-2 text-xs">
        <button
          onClick={() => setActive(new Set(data.modules.map((m) => m.id)))}
          className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
        >
          Tout activer
        </button>
        <button
          onClick={() => setActive(new Set())}
          className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
        >
          Réinitialiser
        </button>
      </div>

      {(["integral", "periphery"] as Tier[]).map((tier) => (
        <div key={tier} className="mt-6">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${TIER_UI[tier].dot}`} />
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {tierLabel[tier]}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {modulesByTier(tier).map((m) => (
              <ModuleToggle
                key={m.id}
                mod={m}
                on={active.has(m.id)}
                lockedBy={requiredByActive(data, active, m.id).map(
                  (x) => x.label,
                )}
                requires={m.requires.flatMap((r) => {
                  const dep = data.modules.find((d) => d.id === r);
                  return dep ? [dep.label] : [];
                })}
                onToggle={() => toggle(m.id)}
              />
            ))}
          </ul>
        </div>
      ))}

      <Legend tierLabel={tierLabel} />
    </div>
  );

  return (
    <div>
      {/* Barre mobile */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
            <path
              d="M2.5 4h11M2.5 8h11M2.5 12h11"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Sommaire &amp; modules
        </button>
        <span className="text-xs text-slate-500">
          {active.size > 0
            ? `${active.size} actif${active.size > 1 ? "s" : ""}`
            : "socle"}
        </span>
      </div>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Panneau (desktop) */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-8">{panel}</div>
        </aside>

        {/* Document */}
        <main className="min-w-0 flex-1">
        <header className="mb-8 border-b border-slate-200 pb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            {data.meta.version}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-slate-900 sm:text-4xl">
            {data.meta.title}
          </h1>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">{versionLabel}</span>
              <span className="text-slate-400">
                {active.size}/{data.modules.length} modules
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-slate-400 via-teal-400 to-violet-500 ${
                  reduce ? "" : "transition-[width] duration-500 ease-out"
                }`}
                style={{ width: `${Math.max(pct * 100, 3)}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-500">
              <input
                type="checkbox"
                checked={showIntent}
                onChange={(e) => setShowIntent(e.target.checked)}
                className="h-3.5 w-3.5 accent-slate-500"
              />
              Afficher les notes d&apos;intention
            </label>
            <button
              onClick={handlePdf}
              disabled={pdfBusy}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                <path
                  d="M8 1.5v8m0 0L5 6.5m3 3l3-3M2.5 11.5v1a2 2 0 002 2h7a2 2 0 002-2v-1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {pdfBusy ? "Génération…" : "Télécharger le PDF"}
            </button>
          </div>
        </header>

        <article className="doc-prose text-[1.05rem] text-slate-800">
          {data.blocks.map((block) => {
            return (
              <motion.section
                key={block.id}
                id={block.id}
                className="mb-10 scroll-mt-24"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <h2 className="mb-3 font-serif text-2xl font-semibold text-slate-900">
                  {block.heading}
                </h2>
                <AnimatePresence initial={false}>
                  {showIntent && block.intent && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 overflow-hidden border-l-2 border-slate-200 pl-3 text-sm italic text-slate-500"
                    >
                      {block.intent}
                    </motion.p>
                  )}
                </AnimatePresence>

                <Prose text={block.text} />

                {/* Insertions actives + remplacements obligatoires */}
                <AnimatePresence initial={false}>
                  {activeInsertions(block.anchor).map((ins) => {
                    const insUi = TIER_UI[ins.mod.tier];
                    return (
                      <motion.div
                        key={ins.id}
                        layout
                        initial={{ opacity: 0, height: 0, y: -6 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -6 }}
                        transition={{ type: "spring", stiffness: 320, damping: 30 }}
                        className={`mt-4 overflow-hidden rounded-r-md border-l-4 ${insUi.bar} ${insUi.tint} py-3 pl-4 pr-3`}
                      >
                        <span
                          className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${insUi.tag}`}
                        >
                          + {ins.mod.label}
                        </span>
                        <div className="text-[0.98rem]">
                          <Prose text={ins.text} />
                        </div>
                      </motion.div>
                    );
                  })}

                  {fallbacks(block.anchor).map((m) => (
                    <motion.div
                      key={`fb-${m.id}`}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: "spring", stiffness: 320, damping: 30 }}
                      className={`mt-4 overflow-hidden rounded-r-md border-l-4 ${TIER_UI.warning.bar} ${TIER_UI.warning.tint} py-3 pl-4 pr-3`}
                    >
                      <span
                        className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${TIER_UI.warning.tag}`}
                      >
                        ⚠ Règle par défaut — « {m.label} » non activé
                      </span>
                      <div className="text-[0.98rem]">
                        <Prose text={m.fallback!.text} />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* "+" entre paragraphes : modules activables ancrés ici */}
                <InsertDivider
                  modules={availableChips(block.anchor)}
                  onActivate={toggle}
                />
              </motion.section>
            );
          })}

          <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-400">
            {data.meta.notice} — {data.meta.license}
          </footer>
        </article>
        </main>
      </div>

      {/* Tiroir mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-slate-900/30"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="absolute left-0 top-0 h-full w-80 max-w-[85%] overflow-y-auto bg-background p-5 shadow-xl"
            >
              <div className="mb-2 flex justify-end">
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fermer"
                  className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
              {panel}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModuleToggle({
  mod,
  on,
  lockedBy,
  requires,
  onToggle,
}: {
  mod: Module;
  on: boolean;
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
              : "border-slate-300 bg-white"
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

function InsertDivider({
  modules,
  onActivate,
}: {
  modules: Module[];
  onActivate: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (modules.length === 0) return <div className="h-4" />;
  return (
    <div className="group relative mt-5">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Ajouter un module ici"
          className={`flex h-7 w-7 items-center justify-center rounded-full border bg-background transition duration-200 ${
            open
              ? "rotate-45 border-slate-500 text-slate-700"
              : "border-slate-300 text-slate-400 opacity-40 hover:border-slate-500 hover:text-slate-700 hover:opacity-100 group-hover:opacity-100"
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
                    className={`inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 transition ${ui.chip}`}
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

function Legend({ tierLabel }: { tierLabel: Record<string, string> }) {
  const rows: { key: Tier | "warning"; label: string }[] = [
    { key: "core", label: tierLabel.core ?? "Cœur" },
    { key: "integral", label: tierLabel.integral ?? "Intégral" },
    { key: "periphery", label: tierLabel.periphery ?? "Périphérie" },
    { key: "warning", label: "Règle par défaut" },
  ];
  return (
    <div className="mt-8 border-t border-slate-200 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Légende
      </p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`h-3 w-1 rounded-full ${TIER_UI[r.key].dot}`} />
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
