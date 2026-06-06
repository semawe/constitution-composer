"use client";

import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { FONT_OPTIONS, fontVars } from "@/lib/branding";
import { linkifyTerms } from "@/lib/glossary";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  type ConstitutionData,
  type Module,
  type Tier,
  defaultActive,
  modulesForAnchor,
  requiredByActive,
  toggleModule,
} from "@/lib/constitution";
import { getSupabase } from "@/lib/supabase";
import {
  type SavedComposition,
  MAX_COMPOSITIONS,
  listCompositions,
  saveComposition,
  renameComposition,
  deleteComposition,
} from "@/lib/compositions";
import type { Session, User } from "@supabase/supabase-js";

// Freemium par paliers : Cœur + Intégrale en accès libre ; les Extensions, les
// Apps et l'export (PDF/copie/sauvegarde) requièrent un compte.
const isGatedTier = (tier: Tier) => tier === "extension" || tier === "app";

// Coachs — pages de réservation Google Agenda (créneaux 30 min de découverte).
const COACHES = [
  { name: "Coach 1", url: "https://calendar.example.com/booking" },
  { name: "Coach 2", url: "https://calendar.example.com/booking" },
];

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
  extension: {
    dot: "bg-violet-500",
    bar: "border-violet-400",
    tag: "bg-violet-50 text-violet-700 ring-violet-200",
    tint: "bg-violet-50/50",
    chip: "hover:border-violet-400 hover:text-violet-700",
  },
  app: {
    dot: "bg-rose-500",
    bar: "border-rose-400",
    tag: "bg-rose-50 text-rose-700 ring-rose-200",
    tint: "bg-rose-50/50",
    chip: "hover:border-rose-400 hover:text-rose-700",
  },
  warning: {
    dot: "bg-amber-500",
    bar: "border-amber-400",
    tag: "bg-amber-50 text-amber-700 ring-amber-200",
    tint: "bg-amber-50/60",
    chip: "",
  },
};

type TermClick = (key: string) => void;

function renderInline(s: string, keyBase: string, onTermClick: TermClick) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyBase}-${i}`} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${keyBase}-${i}`}>
        {linkifyTerms(part, onTermClick, `${keyBase}-${i}`)}
      </span>
    ),
  );
}

function Prose({
  text,
  onTermClick,
}: {
  text: string;
  onTermClick: TermClick;
}) {
  return (
    <>
      {text.split(/\n\n/).map((chunk, i) => {
        const lines = chunk.split("\n");
        // Liste à puces : toutes les lignes commencent par "- ".
        if (lines.length > 1 && lines.every((l) => /^- /.test(l.trim()))) {
          return (
            <ul key={i} className="mb-3 ml-5 list-disc space-y-1 last:mb-0">
              {lines.map((l, j) => (
                <li key={j} className="leading-relaxed">
                  {renderInline(l.trim().replace(/^- /, ""), `p${i}-${j}`, onTermClick)}
                </li>
              ))}
            </ul>
          );
        }
        // Liste numérotée : toutes les lignes commencent par "1. ", "2. "…
        if (lines.length > 1 && lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
          return (
            <ol key={i} className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">
              {lines.map((l, j) => (
                <li key={j} className="leading-relaxed">
                  {renderInline(l.trim().replace(/^\d+\.\s/, ""), `p${i}-${j}`, onTermClick)}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="mb-3 leading-relaxed last:mb-0">
            {renderInline(chunk, `p${i}`, onTermClick)}
          </p>
        );
      })}
    </>
  );
}

interface Branding {
  logo: string;
  setLogo: (v: string) => void;
  font: string;
  setFont: (v: string) => void;
  titleColor: string;
  setTitleColor: (v: string) => void;
}

export default function Composer({
  data,
  branding,
  onTermClick,
}: {
  data: ConstitutionData;
  branding: Branding;
  onTermClick: (key: string) => void;
}) {
  // Au départ : la Lite complète = tous les blocs retirables cochés.
  const [active, setActive] = useState<ReadonlySet<string>>(() =>
    defaultActive(data),
  );
  const [showIntent, setShowIntent] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [title, setTitle] = useState(data.meta.title);
  const [values, setValues] = useState("");
  const [account, setAccount] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [needsCompany, setNeedsCompany] = useState(false);
  const [company, setCompany] = useState("");
  const [gate, setGate] = useState<null | "modules" | "pdf" | "save">(null);
  const [versions, setVersions] = useState<SavedComposition[]>([]);
  const [versionMsg, setVersionMsg] = useState<string | null>(null);
  const [versionBusy, setVersionBusy] = useState(false);
  const { logo, setLogo, font, setFont, titleColor, setTitleColor } = branding;

  // Charge un logo : redimensionné (max 400 px) côté client pour garder un
  // data URL léger, stocké tel quel dans la composition.
  const onLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 400;
        let { width, height } = img;
        if (width > max || height > max) {
          const r = Math.min(max / width, max / height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        setLogo(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };
  const [booking, setBooking] = useState(false);
  const [exportPrompted, setExportPrompted] = useState(false);
  const [activeId, setActiveId] = useState<string>(data.blocks[0]?.id ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = useReducedMotion();
  const supabase = useMemo(() => getSupabase(), []);

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

  // Session Supabase (Lot 3). Sans clés Supabase → repli sur le compte simulé.
  useEffect(() => {
    if (!supabase) {
      try {
        if (localStorage.getItem("cc_account") === "1") setAccount(true);
      } catch {}
      return;
    }
    const apply = (session: Session | null) => {
      const u = session?.user ?? null;
      setUser(u);
      setAccount(!!u);
      setNeedsCompany(!!u && !u.user_metadata?.company);
      // Miroir des infos utilisateur dans `profiles` (pour l'écran admin).
      if (u) {
        supabase
          .from("profiles")
          .upsert({
            id: u.id,
            email: u.email,
            full_name: u.user_metadata?.full_name ?? null,
            company: u.user_metadata?.company ?? null,
            updated_at: new Date().toISOString(),
          })
          .then(() => {});
      }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      apply(session),
    );
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Restaure la composition après le retour de redirection Google (round-trip OAuth).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cc_compose");
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Array.isArray(s.active)) setActive(new Set(s.active));
      if (typeof s.title === "string" && s.title) setTitle(s.title);
      if (typeof s.values === "string") setValues(s.values);
      localStorage.removeItem("cc_compose");
    } catch {}
  }, []);

  const goTo = (id: string) => {
    setActiveId(id); // retour immédiat, sans attendre le scrollspy
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setMobileOpen(false);
  };

  const doGeneratePdf = async () => {
    setPdfBusy(true);
    try {
      const { generateComposedPdfBlob } = await import("@/lib/pdf");
      const blob = await generateComposedPdfBlob(data, active, {
        title,
        values,
        titleColor: titleColor || undefined,
        font,
        logo: logo || undefined,
        date: new Date().toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug =
        (title || "constitution")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "constitution";
      a.download = `${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // Moment de haute intention : on propose la session offerte (une fois).
      if (!exportPrompted) {
        setExportPrompted(true);
        setBooking(true);
      }
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePdf = () => {
    if (!account) {
      setGate("pdf");
      return;
    }
    doGeneratePdf();
  };

  // Sauvegarde la composition avant la redirection Google (restaurée au retour).
  const persistComposerState = () => {
    try {
      localStorage.setItem(
        "cc_compose",
        JSON.stringify({ active: [...active], title, values }),
      );
    } catch {}
  };

  // Connexion Google réelle (Supabase). Sans Supabase → compte simulé (repli).
  const signInGoogle = async () => {
    if (!supabase) {
      setAccount(true);
      try {
        localStorage.setItem("cc_account", "1");
      } catch {}
      const reason = gate;
      setGate(null);
      if (reason === "pdf") doGeneratePdf();
      return;
    }
    persistComposerState();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  };

  // Onboarding : Google ne fournit pas l'entreprise → on la collecte une fois.
  const submitCompany = async () => {
    if (!supabase || !company.trim()) return;
    await supabase.auth.updateUser({ data: { company: company.trim() } });
    setNeedsCompany(false);
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      setAccount(false);
      setNeedsCompany(false);
    } else {
      setAccount(false);
      try {
        localStorage.removeItem("cc_account");
      } catch {}
    }
  };

  const toggle = (id: string) => {
    const mod = data.modules.find((m) => m.id === id);
    const next = toggleModule(data, active, id);
    const activating = next.size > active.size;
    // Paliers : activer une Extension ou une App requiert un compte.
    if (!account && activating && mod && isGatedTier(mod.tier)) {
      setGate("modules");
      return;
    }
    setActive(next);
  };

  // Mes versions (Phase B) : charge la liste dès qu'un compte est actif.
  useEffect(() => {
    if (!account) {
      setVersions([]);
      return;
    }
    let alive = true;
    listCompositions()
      .then((rows) => alive && setVersions(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [account]);

  const refreshVersions = () =>
    listCompositions()
      .then(setVersions)
      .catch(() => {});

  const handleSaveVersion = async () => {
    if (!account) {
      setGate("save");
      return;
    }
    if (versions.length >= MAX_COMPOSITIONS) {
      setVersionMsg(
        `Limite de ${MAX_COMPOSITIONS} versions atteinte — supprimez-en une pour enregistrer.`,
      );
      return;
    }
    setVersionBusy(true);
    setVersionMsg(null);
    try {
      await saveComposition((title || "Sans titre").trim(), {
        title,
        values,
        active: [...active],
        titleColor: titleColor || undefined,
        font,
        logo: logo || undefined,
      });
      await refreshVersions();
      setVersionMsg("Version enregistrée.");
    } catch {
      setVersionMsg("Échec de l'enregistrement.");
    } finally {
      setVersionBusy(false);
    }
  };

  const handleLoadVersion = (v: SavedComposition) => {
    setActive(new Set(v.payload.active ?? []));
    setTitle(v.payload.title ?? data.meta.title);
    setValues(v.payload.values ?? "");
    setTitleColor(v.payload.titleColor ?? "");
    setFont(v.payload.font ?? "source-serif");
    setLogo(v.payload.logo ?? "");
    setVersionMsg(`« ${v.name} » chargée.`);
  };

  const handleRenameVersion = async (v: SavedComposition) => {
    const name = window.prompt("Nouveau nom de la version", v.name);
    if (!name || !name.trim()) return;
    await renameComposition(v.id, name.trim());
    await refreshVersions();
  };

  const handleDeleteVersion = async (v: SavedComposition) => {
    if (!window.confirm(`Supprimer la version « ${v.name} » ?`)) return;
    await deleteComposition(v.id);
    await refreshVersions();
    setVersionMsg(null);
  };

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

  // Lite = blocs retirables (tier integral, cochés par défaut).
  // Au-delà = modules additifs (extension / app, off par défaut).
  const integralMods = useMemo(
    () => data.modules.filter((m) => m.tier === "integral"),
    [data.modules],
  );
  const removed = integralMods.filter((m) => !active.has(m.id)).length;
  const addonsOn = data.modules.filter(
    (m) => m.tier !== "integral" && active.has(m.id),
  ).length;

  const countLabel =
    removed === 0 && addonsOn === 0
      ? "Lite complète"
      : removed > 0 && addonsOn === 0
        ? `${integralMods.length - removed}/${integralMods.length} blocs retirables`
        : `${integralMods.length - removed}/${integralMods.length} blocs · ${addonsOn} ajout${addonsOn > 1 ? "s" : ""}`;

  const pct = data.modules.length ? active.size / data.modules.length : 0;
  const versionLabel =
    removed === 0 && addonsOn === 0
      ? "Version Lite — complète"
      : active.size === data.modules.length
        ? "Version intégrale"
        : removed > 0 && addonsOn === 0
          ? `Version allégée — ${removed} bloc${removed > 1 ? "s" : ""} retiré${removed > 1 ? "s" : ""}`
          : "Version sur-mesure";

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
          onClick={() => {
            if (!account && data.modules.some((m) => isGatedTier(m.tier))) {
              setGate("modules");
              return;
            }
            setActive(new Set(data.modules.map((m) => m.id)));
          }}
          className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
        >
          Tout activer
        </button>
        <button
          onClick={() => setActive(defaultActive(data))}
          className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
          title="Revenir à la Lite complète : tous les blocs retirables cochés, sans extension ni app."
        >
          Base Lite
        </button>
        <button
          onClick={() => setActive(new Set())}
          className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
          title="Ne garder que le socle incompressible."
        >
          Socle seul
        </button>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Mes versions
          </h2>
          <span className="text-xs text-slate-400">
            {versions.length}/{MAX_COMPOSITIONS}
          </span>
        </div>
        <button
          onClick={handleSaveVersion}
          disabled={versionBusy}
          className="mt-2 w-full rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {versionBusy ? "Enregistrement…" : "Enregistrer cette version"}
        </button>
        {versionMsg && (
          <p className="mt-1.5 text-xs text-slate-500">{versionMsg}</p>
        )}
        {!account && (
          <p className="mt-1.5 text-xs text-slate-400">
            Connexion requise pour sauvegarder vos versions.
          </p>
        )}
        {versions.length > 0 && (
          <ul className="mt-2 space-y-1">
            {versions.map((v) => (
              <li
                key={v.id}
                className="group flex items-center gap-1 rounded-md px-1.5 py-1 text-sm hover:bg-slate-100"
              >
                <button
                  onClick={() => handleLoadVersion(v)}
                  title="Charger cette version"
                  className="min-w-0 flex-1 truncate text-left"
                >
                  <span className="block truncate text-slate-700">
                    {v.name || "Sans titre"}
                  </span>
                  <span className="block text-[0.7rem] text-slate-400">
                    {new Date(v.updated_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </button>
                <button
                  onClick={() => handleRenameVersion(v)}
                  aria-label="Renommer"
                  title="Renommer"
                  className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition hover:text-slate-700 group-hover:opacity-100"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteVersion(v)}
                  aria-label="Supprimer"
                  title="Supprimer"
                  className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(["integral", "extension", "app"] as Tier[]).map((tier) => (
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
                premium={!account && isGatedTier(m.tier)}
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
      <div className="sticky top-11 z-20 flex items-center justify-between border-b border-slate-200 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
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
          <div className="sticky top-16">{panel}</div>
        </aside>

        {/* Document — la police choisie surcharge --font-serif/--font-sans
            pour tout ce qui est dedans (titre, intertitres, corps). */}
        <main
          className="min-w-0 flex-1"
          style={fontVars(font)}
        >
        <header className="mb-8 border-b border-slate-200 pb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            {data.meta.version}
          </p>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt="Logo de l'organisation"
              className="mb-3 mt-1 max-h-16 w-auto"
            />
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Titre de votre Constitution"
            placeholder={data.meta.title}
            spellCheck={false}
            style={titleColor ? { color: titleColor } : undefined}
            className="mt-1 w-full rounded-sm border-0 border-b border-transparent bg-transparent font-serif text-3xl font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-200 focus:border-slate-400 sm:text-4xl"
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>Titre modifiable — donnez un nom à votre Constitution.</span>
            <span className="flex items-center gap-1.5">
              Police
              <select
                value={font}
                onChange={(e) => setFont(e.target.value)}
                aria-label="Police du document"
                className="rounded border border-slate-200 bg-transparent px-1.5 py-0.5 outline-none focus:border-slate-400"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </span>
            <span className="flex items-center gap-1.5">
              Logo
              <label className="cursor-pointer underline transition hover:text-slate-600">
                {logo ? "changer" : "ajouter"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onLogoChange}
                  className="hidden"
                />
              </label>
              {logo && (
                <button
                  onClick={() => setLogo("")}
                  className="underline transition hover:text-slate-600"
                >
                  retirer
                </button>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              Couleur
              <input
                type="color"
                value={titleColor || "#0f172a"}
                onChange={(e) => setTitleColor(e.target.value)}
                aria-label="Couleur du titre"
                className="h-5 w-6 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
              />
              <input
                type="text"
                value={titleColor}
                onChange={(e) => setTitleColor(e.target.value)}
                placeholder="#0f172a"
                spellCheck={false}
                className="w-20 rounded border border-slate-200 bg-transparent px-1.5 py-0.5 font-mono outline-none focus:border-slate-400"
              />
              {titleColor && (
                <button
                  onClick={() => setTitleColor("")}
                  className="underline transition hover:text-slate-600"
                >
                  défaut
                </button>
              )}
            </span>
          </div>

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
            <p className="mt-1.5 text-xs text-slate-400">
              {account ? (
                <>
                  {user?.user_metadata?.full_name
                    ? `Connecté : ${user.user_metadata.full_name}`
                    : "Compte actif"}
                  {" · "}
                  <button
                    onClick={signOut}
                    className="underline transition hover:text-slate-600"
                  >
                    se déconnecter
                  </button>
                </>
              ) : (
                "Cœur et Intégrale en accès libre. Compte requis pour les Extensions, les Apps et le PDF."
              )}
            </p>
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

                <Prose text={block.text} onTermClick={onTermClick} />

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
                          {ins.mod.tier === "integral" ? "" : "+ "}
                          {ins.mod.label}
                        </span>
                        <div className="text-[0.98rem]">
                          <Prose text={ins.text} onTermClick={onTermClick} />
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
                        <Prose text={m.fallback!.text} onTermClick={onTermClick} />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {block.id === "preambule" && (
                  <PreambleValues values={values} setValues={setValues} />
                )}

                {/* "+" entre paragraphes : modules activables ancrés ici */}
                <InsertDivider
                  modules={availableChips(block.anchor)}
                  onActivate={toggle}
                />
              </motion.section>
            );
          })}

          <div className="mt-12 rounded-2xl border border-slate-200 bg-gradient-to-br from-teal-50 to-violet-50 p-6">
            <h2 className="font-serif text-xl font-semibold text-slate-900">
              Aller plus loin avec un coach
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Composer, c&apos;est un début. Faites relire et co-construire votre
              Constitution avec un coach certifié en Holacracy.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
              <li>
                🎁 <strong>30 minutes de découverte offertes</strong> à la
                création de votre compte.
              </li>
              <li>
                Supervision par un coach senior :{" "}
                <strong>500 €/h</strong> ou <strong>3000 €/jour</strong>.
              </li>
            </ul>
            <button
              onClick={() => setBooking(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              🎁 Réserver mes 30 minutes offertes
            </button>
          </div>

          <footer className="mt-10 flex items-start gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-semawe-light.png"
              alt="Sémawé"
              className="h-10 w-auto shrink-0 dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-semawe-dark.png"
              alt="Sémawé"
              className="hidden h-10 w-auto shrink-0 dark:block"
            />
            <span>
              Composé avec le Composeur de Constitution de Sémawé, diffusé sous
              licence {data.meta.license}, dérivé de la Constitution Holacracy.{" "}
              {data.meta.notice}
            </span>
          </footer>
        </article>
        </main>
      </div>

      {/* Tiroir mobile (rendu conditionnel simple) */}
      {mobileOpen && (
          <motion.div key="drawer" className="fixed inset-0 z-40 lg:hidden">
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
          </motion.div>
        )}

      {/* Mur freemium — création de compte (rendu conditionnel simple) */}
      {gate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              onClick={() => setGate(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <button
                onClick={() => setGate(null)}
                aria-label="Fermer"
                className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
              >
                ✕
              </button>
              <div className="bg-gradient-to-br from-teal-500 to-violet-600 px-6 py-7 text-white">
                <p className="text-xs font-medium uppercase tracking-widest text-white/80">
                  Créez votre compte gratuit
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">
                  {gate === "pdf"
                    ? "Téléchargez votre Constitution"
                    : gate === "save"
                      ? "Sauvegardez vos versions"
                      : "Débloquez les modules avancés"}
                </h2>
                <p className="mt-2 text-sm text-white/90">
                  {gate === "pdf"
                    ? "Le PDF de votre Constitution composée est réservé aux membres — la création de compte est gratuite."
                    : gate === "save"
                      ? "Enregistrez jusqu'à cinq versions de votre Constitution et retrouvez-les à chaque visite. La création de compte est gratuite."
                      : "Les Extensions constitutionnelles et les Apps sont réservées aux membres. La création de compte est gratuite."}
                </p>
              </div>
              <div className="px-6 py-6">
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3">
                  <span className="text-xl leading-none">🎁</span>
                  <p className="text-sm text-teal-900">
                    <strong>30 minutes de coaching offertes</strong> avec un coach
                    certifié en Holacracy à la création de votre compte.
                    <span className="mt-0.5 block text-xs text-teal-700">
                      Coaching premium ensuite à 500 €/h.
                    </span>
                  </p>
                </div>
                <button
                  onClick={signInGoogle}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
                    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                    <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                  </svg>
                  Continuer avec Google
                </button>
                <button
                  onClick={signInGoogle}
                  className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-slate-500 transition hover:text-slate-700"
                >
                  J&apos;ai déjà un compte
                </button>
                <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-slate-400">
                  À la création de compte : nom, prénom, e-mail et entreprise.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}

      {/* Onboarding : entreprise (non fournie par Google) */}
      {needsCompany && account && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 className="font-serif text-xl font-semibold text-slate-900">
              Bienvenue
              {user?.user_metadata?.given_name
                ? `, ${user.user_metadata.given_name}`
                : ""}{" "}
              !
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Dernière étape : votre organisation. Cela nous permet de préparer
              votre session de coaching offerte.
            </p>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Nom de l&apos;entreprise / organisation
            </label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Ex. Sémawé"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCompany();
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-500"
            />
            <button
              onClick={submitCompany}
              disabled={!company.trim()}
              className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              Continuer
            </button>
            <button
              onClick={() => setNeedsCompany(false)}
              className="mt-2 w-full rounded-lg px-4 py-2 text-xs text-slate-400 transition hover:text-slate-600"
            >
              Plus tard
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Réservation coaching (pages Google Agenda) */}
      {booking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={() => setBooking(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <button
              onClick={() => setBooking(false)}
              aria-label="Fermer"
              className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              ✕
            </button>
            <div className="bg-gradient-to-br from-teal-500 to-violet-600 px-6 py-6 text-white">
              <p className="text-xs font-medium uppercase tracking-widest text-white/80">
                Votre session offerte
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold">
                30 minutes avec un coach Holacracy
              </h2>
              <p className="mt-2 text-sm text-white/90">
                Choisissez votre coach et réservez un créneau de 30 minutes —
                offert.
              </p>
            </div>
            <div className="px-6 py-6">
              <div className="space-y-2">
                {COACHES.map((c) => (
                  <a
                    key={c.name}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setBooking(false)}
                    className="flex items-center justify-between rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-50"
                  >
                    <span>Réserver avec {c.name}</span>
                    <span aria-hidden>→</span>
                  </a>
                ))}
              </div>
              <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-slate-400">
                Au-delà de la découverte : supervision par un coach senior,
                500 €/h ou 3000 €/jour.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

function ModuleToggle({
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

function PreambleValues({
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
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 transition hover:border-slate-500 hover:text-slate-700"
      >
        <span className="text-base leading-none">+</span>
        Ajouter vos valeurs et principes
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white/70 p-4">
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
        className="doc-prose w-full resize-y rounded border border-slate-200 bg-white p-3 text-[0.98rem] leading-relaxed text-slate-800 outline-none transition focus:border-slate-400"
      />
      {paraCount > 4 && (
        <p className="mt-1 text-xs text-amber-600">
          Conseil : restez sous 4 paragraphes pour garder le préambule lisible.
        </p>
      )}
    </div>
  );
}

function Legend({ tierLabel }: { tierLabel: Record<string, string> }) {
  const rows: { key: Tier | "warning"; label: string }[] = [
    { key: "core", label: tierLabel.core ?? "Cœur" },
    { key: "integral", label: tierLabel.integral ?? "Intégrale" },
    { key: "extension", label: tierLabel.extension ?? "Extension constitutionnelle" },
    { key: "app", label: tierLabel.app ?? "App" },
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
