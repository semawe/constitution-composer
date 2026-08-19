"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import IntroBanner from "@/components/IntroBanner";
import { FONT_OPTIONS, fontVars, safeLogo } from "@/lib/branding";
import Prose from "@/components/Prose";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  type ConstitutionData,
  type RenderedItem,
  compose,
  type Module,
  type Tier,
  defaultActive,
  modulesForAnchor,
  normalizeActive,
  requiredByActive,
  toggleModule,
} from "@/lib/constitution";
import {
  type ContentRef,
  CURRENT_RELEASE,
  currentContentRef,
  isOutdated,
  releaseLabel,
  resolveContent,
} from "@/lib/releases";
import { getSupabase } from "@/lib/supabase";
import {
  type SavedComposition,
  MAX_COMPOSITIONS,
  listCompositions,
  migrateComposition,
  repinComposition,
  saveComposition,
  renameComposition,
  deleteComposition,
} from "@/lib/compositions";
import type { Session, User } from "@supabase/supabase-js";
import { COMPOSER, type Locale, UI } from "@/lib/i18n";

// Freemium par paliers : Cœur + Intégrale en accès libre ; les Extensions, les
// Apps et l'export (PDF/copie/sauvegarde) requièrent un compte.
const isGatedTier = (tier: Tier) => tier === "extension" || tier === "app";

// Coachs proposés à la réservation (pages Google Agenda, créneaux d'initiation).
// Aucune donnée nominative dans le code : la liste vient de l'environnement,
// NEXT_PUBLIC_COACHES = tableau JSON [{ "name": "...", "url": "..." }, …].
// Pour l'instance Sémawé, source de vérité = base Notion « Coachs — plannings
// Google RDV ». Liste vide → la réservation de coaching est masquée.
type Coach = { name: string; url: string };
const COACHES: Coach[] = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_COACHES;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c) => c && typeof c.name === "string" && typeof c.url === "string")
      : [];
  } catch {
    return [];
  }
})();

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
  retirable: {
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
  pedagogique: {
    dot: "bg-amber-400",
    bar: "border-amber-300",
    tag: "bg-amber-50 text-amber-700 ring-amber-200",
    tint: "bg-amber-50/40",
    chip: "hover:border-amber-400 hover:text-amber-700",
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

interface Branding {
  logo: string;
  setLogo: (v: string) => void;
  font: string;
  setFont: (v: string) => void;
  titleColor: string;
  setTitleColor: (v: string) => void;
}

export default function Composer({
  data: fondCourant,
  branding,
  onTermClick,
  locale = "fr",
}: {
  data: ConstitutionData;
  branding: Branding;
  onTermClick: (key: string) => void;
  locale?: Locale;
}) {
  // Le fond rendu n'est pas toujours celui de la page : rouvrir une version
  // figée sur une release archivée doit afficher **le texte de cette release**,
  // sinon la version n'est qu'une configuration et le document change sous les
  // pieds de qui l'a adoptée. `fondCourant` reste la référence de ce qu'on sert
  // aujourd'hui ; `data` est ce qu'on compose ici et maintenant.
  const [data, setData] = useState<ConstitutionData>(fondCourant);
  const [contentRef, setContentRef] = useState<ContentRef | null>(() =>
    currentContentRef(locale),
  );
  const [releaseMsg, setReleaseMsg] = useState<string | null>(null);
  const [aFiger, setAFiger] = useState<SavedComposition | null>(null);
  const [aRejouer, setARejouer] = useState<SavedComposition | null>(null);
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
  const [gate, setGate] = useState<
    null | "modules" | "pdf" | "save" | "account"
  >(null);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [versions, setVersions] = useState<SavedComposition[]>([]);
  const [versionMsg, setVersionMsg] = useState<string | null>(null);
  const [versionsUnread, setVersionsUnread] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [versionBusy, setVersionBusy] = useState(false);
  const { logo, setLogo, font, setFont, titleColor, setTitleColor } = branding;
  const t = COMPOSER[locale];

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
        // repli compte simulé lu dans localStorage après montage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const { data: sub } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "SIGNED_IN") track("connexion");
      apply(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Brouillon local. Il couvre deux besoins : le retour de redirection Google
  // (round-trip OAuth) et, surtout, le simple rechargement de page — sans lui,
  // le texte saisi dans « Valeurs et principes » et les modules activés étaient
  // perdus dès qu'on rafraîchissait, tant qu'aucune version n'avait été
  // sauvegardée. Le brouillon reste local, jamais envoyé au compte tout seul.
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Le brouillon est lu dans localStorage après le montage : le lire pendant le
  // rendu ferait diverger l'HTML prérendu (modules par défaut) du premier rendu
  // client (brouillon restauré).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cc_compose");
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.active)) setActive(normalizeActive(data, s.active));
        if (typeof s.title === "string" && s.title) setTitle(s.title);
        if (typeof s.values === "string") setValues(s.values);
      }
    } catch {}
    setDraftLoaded(true);
  }, [data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!draftLoaded) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "cc_compose",
          JSON.stringify({ active: [...active], title, values }),
        );
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [draftLoaded, active, title, values]);

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
    setPdfError(false);
    track("pdf_export");
    try {
      const { generateComposedPdfBlob } = await import("@/lib/pdf");
      const blob = await generateComposedPdfBlob(data, active, {
        title,
        values,
        titleColor: titleColor || undefined,
        font,
        logo: logo || undefined,
        locale,
        // Le PDF rend ce que l'écran montre : les notes d'intention suivent
        // l'interrupteur, elles ne disparaissent plus en silence à l'export.
        showIntent,
        // Le PDF dit de quel texte il est tiré : sans cela, deux exports du même
        // nom peuvent différer sans qu'on puisse le savoir après coup.
        contentRef: contentRef ?? undefined,
        date: new Date().toLocaleDateString(t.dateLocale, {
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
      if (!exportPrompted && COACHES.length > 0) {
        setExportPrompted(true);
        setBooking(true);
      }
    } catch {
      // L'export est le geste que la personne est venue faire : son échec ne
      // peut pas se résumer à un bouton qui reprend son état normal.
      setPdfError(true);
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePdf = () => {
    if (!account) {
      setGate("pdf");
      track("gate", { contexte: "pdf" });
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

  // Connexion par lien magique (sans compte Google).
  const signInOtp = async () => {
    const addr = email.trim();
    if (!addr) return;
    if (!supabase) {
      signInGoogle();
      return;
    }
    persistComposerState();
    await supabase.auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setOtpSent(true);
  };

  // Onboarding : Google ne fournit pas l'entreprise → on la collecte une fois.
  const submitCompany = async () => {
    if (!supabase || !company.trim()) return;
    await supabase.auth.updateUser({ data: { company: company.trim() } });
    setNeedsCompany(false);
  };

  // La chrome du Composer (App.tsx) peut demander l'ouverture de la connexion
  // via un événement, sans remonter tout l'état d'auth.
  useEffect(() => {
    const open = () => setGate((g) => g ?? "account");
    window.addEventListener("cc:open-signin", open);
    return () => window.removeEventListener("cc:open-signin", open);
  }, []);

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
      track("gate", { contexte: "modules", module: id });
      return;
    }
    // Cible de défilement : on amène la modification dans le champ de vision
    // pour qu'on voie ce que la bascule vient de changer dans le texte.
    if (mod) {
      const anchor = mod.insertions[0]?.anchor;
      const section = data.blocks.find((b) => b.anchor === anchor)?.id;
      const primary = activating
        ? `ins-${id}-0` // l'insertion qui vient d'apparaître
        : mod.tier === "retirable"
          ? `reins-${id}` // le marqueur « + » de réinsertion
          : mod.fallback
            ? `fb-${id}` // la règle par défaut qui reprend la place
            : section; // sinon, la section concernée
      pendingScroll.current = { primary, fallback: section };
    }
    setActive(next);
  };

  // Après que la bascule a re-rendu le document, on défile vers la modification.
  const pendingScroll = useRef<{
    primary?: string;
    fallback?: string;
  } | null>(null);
  useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    pendingScroll.current = null;
    const el =
      (target.primary && document.getElementById(target.primary)) ||
      (target.fallback && document.getElementById(target.fallback));
    if (!el) return;
    // Laisser l'insertion se monter (commit React + montage Framer) avant de
    // viser sa position.
    const timer = setTimeout(
      () =>
        el.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "center",
        }),
      60,
    );
    return () => clearTimeout(timer);
  }, [active, reduce]);

  // Mes versions (Phase B) : charge la liste dès qu'un compte est actif.
  useEffect(() => {
    if (!account) {
      // remise à zéro de la liste à la déconnexion, sur changement de
      // dépendance.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      .then((rows) => {
        setVersions(rows);
        setVersionsUnread(false);
      })
      // Sans ce message, une lecture ratée s'affichait « 0/5 » : indistinguable
      // d'un compte sans version, donc une invitation à tout resaisir.
      .catch(() => setVersionsUnread(true));

  const handleSaveVersion = async () => {
    if (!account) {
      setGate("save");
      track("gate", { contexte: "save" });
      return;
    }
    if (versions.length >= MAX_COMPOSITIONS) {
      setVersionMsg(t.limitReached(MAX_COMPOSITIONS));
      return;
    }
    setVersionBusy(true);
    setVersionMsg(null);
    try {
      await saveComposition(
        (title || t.untitled).trim(),
        {
          title,
          values,
          active: [...active],
          titleColor: titleColor || undefined,
          font,
          logo: logo || undefined,
        },
        locale,
      );
      await refreshVersions();
      setVersionMsg(t.saved);
      track("sauvegarde_version");
    } catch {
      setVersionMsg(t.saveFailed);
    } finally {
      setVersionBusy(false);
    }
  };

  const handleLoadVersion = (v: SavedComposition) => {
    // De quel texte cette version est-elle faite ? Tant que ce n'est pas
    // tranché, on n'ouvre rien : composer avec le fond courant un document
    // enregistré sur un autre texte, c'est en changer le contenu en silence.
    const resolution = resolveContent(v.payload.content);
    setAFiger(null);
    setARejouer(null);
    if (resolution.statut === "release-absente") {
      setReleaseMsg(t.releaseMissing(releaseLabel(resolution.release, locale)));
      return;
    }
    if (resolution.statut === "empreinte-divergente") {
      setReleaseMsg(t.releaseMismatch(releaseLabel(resolution.release, locale)));
      return;
    }
    const fond =
      resolution.statut === "resolue" ? resolution.data : fondCourant;
    setData(fond);
    setContentRef(v.payload.content ?? null);
    if (resolution.statut === "non-figee") {
      // Version d'avant l'archivage : on l'ouvre sur le texte du jour, on le dit,
      // et on propose de la figer — d'un clic, pas d'une manipulation.
      setReleaseMsg(t.releaseNotPinned);
      setAFiger(v);
    } else if (isOutdated(v.payload.content)) {
      setReleaseMsg(t.releasePinned(releaseLabel(resolution.release, locale)));
      // Relire son document tel qu'il a été adopté, ou en repartir sur le texte
      // du jour : ce sont deux besoins, et le second ne doit pas écraser le
      // premier. D'où une création, proposée ici, plutôt qu'une conversion.
      setARejouer(v);
    } else {
      setReleaseMsg(null);
    }
    // Le payload vient de la base : il peut être ancien (modules disparus),
    // incohérent (prérequis manquants) ou forgé. On le normalise avant de le
    // donner au moteur — contre le fond que la version désigne.
    setActive(normalizeActive(fond, v.payload.active ?? []));
    setTitle(v.payload.title ?? fond.meta.title);
    setValues(v.payload.values ?? "");
    setTitleColor(v.payload.titleColor ?? "");
    setFont(v.payload.font ?? "source-serif");
    setLogo(safeLogo(v.payload.logo));
    setVersionMsg(t.loaded(v.name));
  };

  /** Fige une version d'avant l'archivage sur le texte du jour, à la demande. */
  const handlePinVersion = async (v: SavedComposition) => {
    try {
      await repinComposition(v.id, v.payload, locale);
      await refreshVersions();
      setAFiger(null);
      setContentRef(currentContentRef(locale));
      setReleaseMsg(null);
    } catch {
      setVersionMsg(t.versionActionFailed);
    }
  };

  /** Crée une version de celle-ci sur le texte du jour. L'originale ne bouge pas. */
  const handleMigrateVersion = async (v: SavedComposition) => {
    const nom = t.releaseMigrateName(v.name, releaseLabel(CURRENT_RELEASE, locale));
    try {
      const creee = await migrateComposition(v, nom, locale);
      await refreshVersions();
      setARejouer(null);
      setReleaseMsg(t.releaseMigrated(creee.name));
      setContentRef(currentContentRef(locale));
      setData(fondCourant);
      setActive(normalizeActive(fondCourant, creee.payload.active ?? []));
    } catch (error) {
      setReleaseMsg(
        error instanceof Error && error.message === "LIMIT"
          ? t.releaseMigrateFull(MAX_COMPOSITIONS)
          : t.versionActionFailed,
      );
    }
  };

  const handleRenameVersion = async (v: SavedComposition) => {
    const name = window.prompt(t.renamePrompt, v.name);
    if (!name || !name.trim()) return;
    try {
      await renameComposition(v.id, name.trim());
      await refreshVersions();
    } catch {
      setVersionMsg(t.versionActionFailed);
    }
  };

  const handleDeleteVersion = async (v: SavedComposition) => {
    if (!window.confirm(t.confirmDelete(v.name))) return;
    try {
      await deleteComposition(v.id);
      await refreshVersions();
      setVersionMsg(null);
    } catch {
      setVersionMsg(t.versionActionFailed);
    }
  };

  // Modules inactifs qui portent un remplacement obligatoire = trous comblés.
  const gaps = data.modules.filter((m) => !active.has(m.id) && m.fallback);

  const tierLabel = useMemo(
    () => Object.fromEntries(data.tiers.map((t) => [t.id, t.label])),
    [data.tiers],
  );

  const modulesByTier = (tier: Tier) =>
    data.modules.filter((m) => m.tier === tier);

  // L'écran rend la sortie du moteur, il ne la recalcule pas. Ces deux fonctions
  // dupliquaient les règles de `compose()` — insertions ancrées, conditions
  // `whenActive`, remplacements obligatoires — et rien ne garantissait que les
  // deux implémentations restent d'accord : un changement de règle pouvait
  // modifier le PDF et les pages figées sans modifier l'aperçu, ou l'inverse
  // (revue adverse du 18/08/2026).
  const parBloc = useMemo(() => {
    const groupes = new Map<string, RenderedItem[]>();
    let courant: string | null = null;
    for (const item of compose(data, active)) {
      if (item.kind === "block") {
        courant = item.anchor;
        groupes.set(item.anchor, []);
        continue;
      }
      if (courant) groupes.get(courant)!.push(item);
    }
    return groupes;
  }, [data, active]);

  const composedFor = (anchor: string) => parBloc.get(anchor) ?? [];

  const availableChips = (anchor: string) =>
    modulesForAnchor(data, anchor).filter(
      (m) => !active.has(m.id) && m.tier !== "retirable",
    );

  // Blocs retirables (tier retirable) retirés, ancrés ici → marqueur de réinsertion.
  const removedRetirables = (anchor: string) =>
    data.modules.filter(
      (m) =>
        m.tier === "retirable" &&
        !active.has(m.id) &&
        m.insertions.some((ins) => ins.anchor === anchor),
    );

  // Modules extension/app inactifs ancrés ici : ce que ce tier ne couvre pas.
  const inactiveAdvanced = (anchor: string) =>
    data.modules.filter(
      (m) =>
        (m.tier === "extension" || m.tier === "app") &&
        !active.has(m.id) &&
        m.insertions.some((ins) => ins.anchor === anchor),
    );

  // Lite = blocs retirables (tier retirable, cochés par défaut).
  // Au-delà = modules additifs (extension / app, off par défaut).
  const retirableMods = useMemo(
    () => data.modules.filter((m) => m.tier === "retirable"),
    [data.modules],
  );
  const removed = retirableMods.filter((m) => !active.has(m.id)).length;
  const addonsOn = data.modules.filter(
    (m) =>
      m.tier !== "retirable" && m.tier !== "pedagogique" && active.has(m.id),
  ).length;

  const countLabel =
    removed === 0 && addonsOn === 0
      ? t.liteFull
      : removed > 0 && addonsOn === 0
        ? t.blocksRetirable(retirableMods.length - removed, retirableMods.length)
        : t.blocksWithAddons(retirableMods.length - removed, retirableMods.length, addonsOn);

  const pct = data.modules.length ? active.size / data.modules.length : 0;
  const versionLabel =
    removed === 0 && addonsOn === 0
      ? t.versionLite
      : active.size === data.modules.length
        ? t.versionFull
        : removed > 0 && addonsOn === 0
          ? t.versionReduced(removed)
          : t.versionCustom;

  // Sommaire + composer, partagés entre la sidebar (desktop) et le tiroir (mobile).
  const panel = (
    <div className="thin-scroll max-h-[calc(100vh-4rem)] overflow-y-auto pr-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t.toc}
      </h2>
      <nav className="mt-2 space-y-0.5">
        {data.blocks.map((b) => {
          const on = activeId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => goTo(b.id)}
              className={`block w-full border-l-2 py-1 pl-3 text-left leading-snug transition ${
                on
                  ? "border-teal-500 bg-teal-50/50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <span className={`block text-[0.82rem] ${on ? "font-medium text-teal-800" : "text-slate-500 hover:text-slate-700"}`}>
                {b.heading}
              </span>
            </button>
          );
        })}
      </nav>

      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t.composerLabel}
      </h2>
      <p className="mt-1 text-sm text-slate-500">{countLabel}</p>
      {gaps.length > 0 && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
          <span className="mt-px">⚠</span>
          <span>{t.gapWarning(gaps.length)}</span>
        </p>
      )}

      <div className="mt-4 flex gap-2 text-xs">
        <button
          onClick={() => {
            if (!account && data.modules.some((m) => isGatedTier(m.tier))) {
              setGate("modules");
              return;
            }
            setActive(normalizeActive(data, data.modules.map((m) => m.id)));
          }}
          className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
        >
          {t.activateAll}
        </button>
        <button
          onClick={() => setActive(defaultActive(data))}
          className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
          title={t.baseLiteTitle}
        >
          {t.baseLite}
        </button>
        <button
          onClick={() => setActive(new Set())}
          className="rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
          title={t.coreOnlyTitle}
        >
          {t.coreOnly}
        </button>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t.myVersions}
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
          {versionBusy ? t.saving : t.saveVersion}
        </button>
        {/* De quel texte vient ce qu'on regarde. Muet quand la version est
            figée sur le texte courant : il n'y a rien à signaler. */}
        {releaseMsg && (
          <div
            role="status"
            className="mt-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900"
          >
            <p>{releaseMsg}</p>
            {aFiger && (
              <button
                onClick={() => handlePinVersion(aFiger)}
                className="mt-1.5 rounded-full bg-amber-900 px-2.5 py-1 text-[0.7rem] font-medium text-white transition hover:bg-amber-800"
              >
                {t.releasePinAction}
              </button>
            )}
            {aRejouer && (
              <button
                onClick={() => handleMigrateVersion(aRejouer)}
                className="mt-1.5 rounded-full bg-amber-900 px-2.5 py-1 text-[0.7rem] font-medium text-white transition hover:bg-amber-800"
              >
                {t.releaseMigrateAction}
              </button>
            )}
          </div>
        )}
        {versionsUnread && (
          <p role="alert" className="mt-1.5 text-xs text-rose-700">
            {t.versionsFailed}
          </p>
        )}
        {pdfError && (
          <p role="alert" className="mt-1.5 text-xs text-rose-700">
            {t.pdfFailed}
          </p>
        )}
        {versionMsg && (
          <p className="mt-1.5 text-xs text-slate-500">{versionMsg}</p>
        )}
        {!account && (
          <p className="mt-1.5 text-xs text-slate-400">
            {t.loginToSave}
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
                  title={t.loadTitle}
                  className="min-w-0 flex-1 truncate text-left"
                >
                  <span className="block truncate text-slate-700">
                    {v.name || t.untitled}
                  </span>
                  <span className="block text-[0.7rem] text-slate-400">
                    {new Date(v.updated_at).toLocaleDateString(t.dateLocale, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </button>
                <button
                  onClick={() => handleRenameVersion(v)}
                  aria-label={t.rename}
                  title={t.rename}
                  className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition hover:text-slate-700 group-hover:opacity-100"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteVersion(v)}
                  aria-label={t.delete}
                  title={t.delete}
                  className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(["retirable", "pedagogique", "extension", "app"] as Tier[]).map((tier) => (
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

      <Legend tierLabel={tierLabel} ui={t} />
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
          {t.mobilePanel}
        </button>
        <span className="text-xs text-slate-500">
          {active.size > 0 ? t.mobileActive(active.size) : t.mobileCore}
        </span>
      </div>

      <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Panneau (desktop) */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-16">{panel}</div>
        </aside>

        {/* Document : la police choisie surcharge --font-serif/--font-sans
            pour tout ce qui est dedans (titre, intertitres, corps). */}
        <main
          className="min-w-0 flex-1"
          style={fontVars(font)}
        >
        <IntroBanner locale={locale} />
        <header className="mb-8 border-b border-slate-200 pb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
            {t.editionKicker}
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
            aria-label={t.titleAriaLabel}
            placeholder={data.meta.title}
            spellCheck={false}
            style={titleColor ? { color: titleColor } : undefined}
            className="mt-1 w-full rounded-sm border-0 border-b border-transparent bg-transparent font-serif text-3xl font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-200 focus:border-slate-400 sm:text-4xl"
          />
          {/* Sous-titre du document : de quoi ce texte est dérivé, et ce qu'il
              n'est pas. Il suit le titre même quand l'utilisateur renomme sa
              Constitution — c'est l'édition qui est qualifiée, pas le nom. */}
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500">
            {UI[locale].derivation}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>{t.titleHint}</span>
            <span className="flex items-center gap-1.5">
              {t.fontLabel}
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
                {logo ? t.logoChange : t.logoAdd}
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
                  {t.logoRemove}
                </button>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              {t.colorLabel}
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
                  {t.colorReset}
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
                    ? t.loggedIn(user.user_metadata.full_name)
                    : t.activeAccount}
                  {" · "}
                  <button
                    onClick={signOut}
                    className="underline transition hover:text-slate-600"
                  >
                    {t.signOut}
                  </button>
                </>
              ) : (
                t.freeTierMsg
              )}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-500">
                <input
                  type="checkbox"
                  checked={showIntent}
                  onChange={(e) => setShowIntent(e.target.checked)}
                  className="h-3.5 w-3.5 accent-slate-500"
                />
                {t.showIntent}
              </label>
            </div>
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
              {pdfBusy ? t.pdfGenerating : t.pdfDownload}
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

                <Prose text={block.text} onTermClick={onTermClick} locale={locale} />

                {/* Insertions actives et remplacements obligatoires, dans
                    l'ordre où le moteur les compose : une seule passe sur sa
                    sortie, pas deux filtrages du même tableau. */}
                <AnimatePresence initial={false}>
                  {composedFor(block.anchor).map((item) => {
                    const ui = item.warning ? TIER_UI.warning : TIER_UI[item.tier];
                    const domId =
                      item.kind === "fallback"
                        ? `fb-${item.moduleId}`
                        : `ins-${item.moduleId}-${item.insertionIndex}`;
                    return (
                      <motion.div
                        key={item.key}
                        id={domId}
                        layout
                        initial={{ opacity: 0, height: 0, y: -6 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -6 }}
                        transition={{ type: "spring", stiffness: 320, damping: 30 }}
                        className={`mt-4 scroll-mt-24 overflow-hidden rounded-r-md border-l-4 ${ui.bar} ${ui.tint} py-3 pl-4 pr-3`}
                      >
                        <span
                          className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${ui.tag}`}
                        >
                          {item.kind === "fallback"
                            ? `⚠ ${t.defaultRule(item.moduleLabel ?? "")}`
                            : `${item.tier === "retirable" ? "" : "+ "}${item.moduleLabel}`}
                        </span>
                        <div className="text-[0.98rem]">
                          <Prose
                            text={item.text}
                            onTermClick={onTermClick}
                            locale={locale}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Blocs retirables retirés : fin liseré + "+" pour réinsérer
                    dans le fil de lecture. */}
                {removedRetirables(block.anchor).map((m) => (
                  <button
                    key={`reins-${m.id}`}
                    id={`reins-${m.id}`}
                    onClick={() => toggle(m.id)}
                    title={t.reinsert(m.label)}
                    className="group/reins mt-3 flex w-full scroll-mt-24 items-center gap-2 text-left"
                  >
                    <span className="h-px flex-1 bg-slate-200" />
                    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[0.7rem] text-slate-400 transition group-hover/reins:border-teal-400 group-hover/reins:text-teal-600">
                      <span className="text-sm leading-none">+</span> {m.label}
                    </span>
                    <span className="h-px flex-1 bg-slate-200" />
                  </button>
                ))}

                {block.id === "preambule" && (
                  <PreambleValues values={values} setValues={setValues} />
                )}

                {/* "+" entre paragraphes : extensions / apps activables ancrées ici */}
                <InsertDivider
                  modules={availableChips(block.anchor)}
                  onActivate={toggle}
                  ui={t}
                />

                {/* Renvoi inter-tiers : ce que ce tier ne couvre pas pour cet article */}
                {inactiveAdvanced(block.anchor).length > 0 && (
                  <div className="mt-5 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-[0.85rem] text-violet-900">
                    <span className="font-semibold">Ce tier ne couvre pas :</span>{" "}
                    {inactiveAdvanced(block.anchor).map((m, i, arr) => (
                      <span key={m.id}>
                        <button
                          onClick={() => toggle(m.id)}
                          className="underline decoration-dotted underline-offset-2 hover:text-violet-700"
                          title={m.description}
                        >
                          {m.label}
                        </button>
                        <span className="ml-1 text-[0.75rem] text-violet-600">
                          [{m.tier === "extension" ? "Extension" : "App"}]
                        </span>
                        {i < arr.length - 1 && <span className="mr-1">,</span>}
                      </span>
                    ))}{" "}
                    <span className="text-violet-600">
                      Activez-les pour voir ce contenu.
                    </span>
                  </div>
                )}
              </motion.section>
            );
          })}

          {COACHES.length > 0 && (
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
                  🎁 <strong>20 minutes de découverte offertes</strong> à la
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
                🎁 Réserver mes 20 minutes offertes
              </button>
            </div>
          )}

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
            <span>{t.pdfFooter(data.meta.license, data.meta.notice)}</span>
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
                  aria-label={t.close}
                  className="rounded-full px-2 py-1 text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
              {panel}
            </motion.aside>
          </motion.div>
        )}

      {/* Mur freemium : création de compte (rendu conditionnel simple) */}
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
                aria-label={t.close}
                className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
              >
                ✕
              </button>
              <div className="bg-gradient-to-br from-teal-500 to-violet-600 px-6 py-7 text-white">
                <p className="text-xs font-medium uppercase tracking-widest text-white/80">
                  {t.createFreeAccount}
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold">
                  {gate === "pdf"
                    ? t.gateTitle.pdf
                    : gate === "save"
                      ? t.gateTitle.save
                      : gate === "account"
                        ? t.gateTitle.account
                        : t.gateTitle.modules}
                </h2>
                <p className="mt-2 text-sm text-white/90">
                  {gate === "pdf"
                    ? t.gateDesc.pdf
                    : gate === "save"
                      ? t.gateDesc.save
                      : gate === "account"
                        ? t.gateDesc.account
                        : t.gateDesc.modules}
                </p>
              </div>
              <div className="px-6 py-6">
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-3">
                  <span className="text-xl leading-none">🎁</span>
                  <p className="text-sm text-teal-900">
                    <strong>{t.coachOffer}</strong> {t.coachOfferDetail}
                    <span className="mt-0.5 block text-xs text-teal-700">
                      {t.coachOfferSub}
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
                  {t.continueGoogle}
                </button>
                <div className="my-3 flex items-center gap-3 text-[0.7rem] uppercase tracking-wide text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  {t.orByEmail}
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                {otpSent ? (
                  <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
                    {t.emailSent}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                    />
                    <button
                      onClick={signInOtp}
                      disabled={!email.trim()}
                      className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                    >
                      {t.sendLink}
                    </button>
                  </div>
                )}
                <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-slate-400">
                  {t.accountNotice}
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
              {t.welcome}
              {user?.user_metadata?.given_name
                ? `, ${user.user_metadata.given_name}`
                : ""}{" "}
              !
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t.lastStep}
            </p>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
              {t.orgName}
            </label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder={t.orgPlaceholder}
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
              {t.continue}
            </button>
            <button
              onClick={() => setNeedsCompany(false)}
              className="mt-2 w-full rounded-lg px-4 py-2 text-xs text-slate-400 transition hover:text-slate-600"
            >
              {t.later}
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
              aria-label={t.close}
              className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              ✕
            </button>
            <div className="bg-gradient-to-br from-teal-500 to-violet-600 px-6 py-6 text-white">
              <p className="text-xs font-medium uppercase tracking-widest text-white/80">
                {t.freeSession}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold">
                {t.coachTitle}
              </h2>
              <p className="mt-2 text-sm text-white/90">
                {t.coachSubtitle}
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
                    <span>{t.bookWith(c.name)}</span>
                    <span aria-hidden>→</span>
                  </a>
                ))}
              </div>
              <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-slate-400">
                {t.coachingPricing}
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

function Legend({
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
  return (
    <div className="mt-8 border-t border-slate-200 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {ui.legend}
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
