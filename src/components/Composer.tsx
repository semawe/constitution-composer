"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import IntroBanner from "@/components/IntroBanner";
import { FONT_OPTIONS, fontVars, safeLogo } from "@/lib/branding";
import { ComposerModales } from "@/components/composer/ComposerModales";
import { ComposerDocument } from "@/components/composer/ComposerDocument";
import { ComposerPanel } from "@/components/composer/ComposerPanel";
import {
  isGatedTier,
} from "@/components/composer/pieces";
import { motion, useReducedMotion } from "framer-motion";
import {
  type ConstitutionData,
  type RenderedItem,
  compose,
  type Tier,
  defaultActive,
  modulesForAnchor,
  normalizeActive,
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
  MAX_COMPOSITIONS,
  type SavedComposition,
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

  const pct = data.modules.length ? active.size / data.modules.length : 0;
  // Le nom de la version composée, affiché dans l'en-tête du document.
  const retirables = data.modules.filter((m) => m.tier === "retirable");
  const removed = retirables.filter((m) => !active.has(m.id)).length;
  const addonsOn = data.modules.filter(
    (m) =>
      m.tier !== "retirable" && m.tier !== "pedagogique" && active.has(m.id),
  ).length;
  const versionLabel =
    removed === 0 && addonsOn === 0
      ? t.versionLite
      : active.size === data.modules.length
        ? t.versionFull
        : removed > 0 && addonsOn === 0
          ? t.versionReduced(removed)
          : t.versionCustom;

  // Sommaire + composer, partagés entre la sidebar (desktop) et le tiroir (mobile).
  // Le panneau de commandes vit dans son propre fichier (#1057) : il ne compose
  // pas le document, il le pilote. Les propriétés sont groupées par sujet —
  // le document, les versions, le compte — pour qu'on voie ce qu'il lit.
  const panel = (
    <ComposerPanel
      data={data}
      t={t}
      doc={{
        active,
        activeId,
        toggle,
        setActive,
        goTo,
        gaps,
        tierLabel,
        modulesByTier,
      }}
      versions={{
        liste: versions,
        message: versionMsg,
        illisible: versionsUnread,
        occupe: versionBusy,
        pdfEnEchec: pdfError,
        releaseMsg,
        aFiger,
        aRejouer,
        onSave: handleSaveVersion,
        onLoad: handleLoadVersion,
        onRename: handleRenameVersion,
        onDelete: handleDeleteVersion,
        onPin: handlePinVersion,
        onMigrate: handleMigrateVersion,
      }}
      compte={{ account, onGate: setGate }}
    />
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
            className="mt-1 w-full rounded-sm border-0 border-b border-transparent bg-transparent font-serif text-xl font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-200 focus:border-slate-400 sm:text-4xl"
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
              className="inline-flex items-center gap-2 rounded-full btn-ink px-4 py-2 text-sm font-medium transition disabled:opacity-60"
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

        <ComposerDocument
          data={data}
          t={t}
          locale={locale}
          composedFor={composedFor}
          showIntent={showIntent}
          onTermClick={onTermClick}
          values={values}
          setValues={setValues}
          toggle={toggle}
          availableChips={availableChips}
          removedRetirables={removedRetirables}
          inactiveAdvanced={inactiveAdvanced}
          coaches={COACHES}
          onBook={() => setBooking(true)}
        />
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

      <ComposerModales
        t={t}
        gate={gate}
        setGate={setGate}
        user={user}
        email={email}
        setEmail={setEmail}
        otpSent={otpSent}
        signInGoogle={signInGoogle}
        signInOtp={signInOtp}
        needsCompany={needsCompany}
        setNeedsCompany={setNeedsCompany}
        account={account}
        company={company}
        setCompany={setCompany}
        submitCompany={submitCompany}
        booking={booking}
        setBooking={setBooking}
        coaches={COACHES}
      />
    </div>
  );
}
