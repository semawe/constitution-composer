"use client";

import {
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fontVars } from "@/lib/branding";
import Modale from "@/components/Modale";
import Prose from "@/components/Prose";
import type { PrincipesData } from "@/lib/principes-data";
import {
  type ContentRef,
  currentContentRef,
  isOutdated,
  releaseLabel,
  resolvePrincipes,
} from "@/lib/releases";
import { normalizeDeclaration } from "@/lib/declaration";
import {
  type Ecrire,
  type EtatSauvegarde,
  type FileDeclaration,
  creerFileDeclaration,
  verdict,
} from "@/lib/declaration-sync";
import { getSupabase } from "@/lib/supabase";
import { COMPOSER, PRINCIPES_UI, type Locale, UI } from "@/lib/i18n";

const LS_PRINCIPES = "cc_principes";

// Les types vivent dans `@/lib/principes-data` : l'index des releases doit
// pouvoir les importer sans dépendre de ce composant.
export type { Principle, PrincipesData } from "@/lib/principes-data";

export default function Principes({
  data: fondCourant,
  logo,
  font,
  titleColor,
  onTermClick,
  locale = "fr",
}: {
  data: PrincipesData;
  logo: string;
  font: string;
  titleColor: string;
  onTermClick: (key: string) => void;
  locale?: Locale;
}) {
  const t = PRINCIPES_UI[locale];
  // Le modal de connexion partage ses libellés avec la Constitution.
  const c = COMPOSER[locale];
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [custom, setCustom] = useState<
    { id: string; title: string; text: string }[]
  >([]);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [raisonEtre, setRaisonEtre] = useState("");
  const [devise, setDevise] = useState("");
  const [ratifiers, setRatifiers] = useState("");
  const [signatories, setSignatories] = useState("");
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // Cycle de vie de la Déclaration du compte : tant qu'on n'a pas fini de lire
  // celle du serveur, on n'écrit RIEN dessus (sinon le brouillon affiché — qui
  // peut être celui de la personne précédente sur un poste partagé — écrase ou
  // remplit le compte qui vient de se connecter).
  // « error » est un état à part entière : confondre une lecture ratée avec un
  // compte sans Déclaration, c'est autoriser l'écrasement du document distant
  // par un brouillon vide (revue adverse du 18/08/2026).
  const [remote, setRemote] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  // « perimee » est le refus de la base : le compte porte un état plus récent
  // que celui affiché (un autre onglet, un autre appareil). Écrire par-dessus
  // écraserait ce travail-là, donc on s'arrête et on le dit.
  const [saveState, setSaveState] = useState<EtatSauvegarde>("idle");
  // La révision que porte la Déclaration du compte, lue avec elle. 0 = compte
  // sans Déclaration, ou Déclaration écrite avant la migration 0009.
  const [revisionCompte, setRevisionCompte] = useState(0);
  // Brouillon anonyme non vide face à un compte sans Déclaration : on demande
  // avant de rattacher, on ne recopie pas d'office.
  const [offerAttach, setOfferAttach] = useState(false);

  const clearDeclaration = () => {
    setRemoved(new Set());
    setCustom([]);
    setOrder([]);
    setRaisonEtre("");
    setDevise("");
    setRatifiers("");
    setSignatories("");
    setOfferAttach(false);
    try {
      localStorage.removeItem(LS_PRINCIPES);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith(`${LS_PRINCIPES}:`)) localStorage.removeItem(k);
      }
    } catch {}
  };

  // Compte (mur freemium du PDF de la Déclaration, comme la Constitution).
  // Comme pour la Constitution : le fond rendu est celui que la Déclaration
  // désigne, pas toujours celui de la page. Une Déclaration signée doit se relire
  // telle qu'elle a été signée.
  const [data, setData] = useState<PrincipesData>(fondCourant);
  const [contentRef, setContentRef] = useState<ContentRef | null>(() =>
    currentContentRef(locale, "principes"),
  );
  const [releaseMsg, setReleaseMsg] = useState<string | null>(null);
  const [aFiger, setAFiger] = useState(false);

  const supabase = useMemo(() => getSupabase(), []);
  const [account, setAccount] = useState(false);
  const [gate, setGate] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!supabase) {
      try {
        // repli compte simulé lu dans localStorage après montage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (localStorage.getItem("cc_account") === "1") setAccount(true);
      } catch {}
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setAccount(!!data.session?.user);
      setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      setAccount(!!s?.user);
      setUserId(s?.user?.id ?? null);
      // Déconnexion : on ne laisse pas la Déclaration de la personne précédente
      // à l'écran — elle serait recopiée dans le compte suivant.
      if (e === "SIGNED_OUT") clearDeclaration();
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const signIn = async () => {
    if (!supabase) {
      setAccount(true);
      try {
        localStorage.setItem("cc_account", "1");
      } catch {}
      setGate(false);
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
  };

  const signInOtp = async () => {
    const addr = email.trim();
    if (!addr) return;
    if (!supabase) {
      signIn();
      return;
    }
    await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    setOtpSent(true);
  };

  // Restaure l'état des principes (survit au changement d'onglet et au
  // rechargement). Lecture d'un store externe après le montage, pour la même
  // raison que le brouillon du composer.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_PRINCIPES);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.removed)) setRemoved(new Set(s.removed));
        if (Array.isArray(s.custom)) setCustom(s.custom);
        if (typeof s.raisonEtre === "string") setRaisonEtre(s.raisonEtre);
        if (typeof s.devise === "string") setDevise(s.devise);
        if (typeof s.ratifiers === "string") setRatifiers(s.ratifiers);
        if (typeof s.signatories === "string") setSignatories(s.signatories);
        if (Array.isArray(s.order)) setOrder(s.order);
      }
    } catch {}
    setLoaded(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persiste à chaque changement (après le chargement initial). Une fois
  // connecté, le miroir local est nominatif : le brouillon d'une personne ne
  // réapparaît pas sous le compte de la suivante sur un poste partagé.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        userId ? `${LS_PRINCIPES}:${userId}` : LS_PRINCIPES,
        JSON.stringify({
          removed: [...removed],
          custom,
          raisonEtre,
          devise,
          ratifiers,
          signatories,
          order,
        }),
      );
    } catch {}
  }, [
    loaded,
    userId,
    removed,
    custom,
    raisonEtre,
    devise,
    ratifiers,
    signatories,
    order,
  ]);

  // Rattachement au compte : la Déclaration est aussi stockée dans Supabase
  // (visible côté admin) dès que l'utilisateur est connecté.
  const declarationPayload = useMemo(
    () => ({
      // La référence suit le document : ce qui est sauvegardé dit de quels
      // Principes il est fait, sinon la garantie ne survit pas à l'écriture.
      schemaVersion: 2 as const,
      content: contentRef ?? currentContentRef(locale, "principes"),
      removed: [...removed],
      custom,
      order,
      raisonEtre,
      devise,
      ratifiers,
      signatories,
    }),
    [
      contentRef,
      locale,
      removed,
      custom,
      order,
      raisonEtre,
      devise,
      ratifiers,
      signatories,
    ],
  );

  // Y a-t-il quelque chose à perdre dans le brouillon local ?
  const draftIsEmpty =
    removed.size === 0 &&
    custom.length === 0 &&
    !raisonEtre.trim() &&
    !devise.trim() &&
    !ratifiers.trim() &&
    !signatories.trim();

  // À la connexion : charge la Déclaration du compte si elle existe.
  useEffect(() => {
    if (!supabase || !userId) {
      // remise à zéro du cycle de lecture distante quand la session tombe.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemote("idle");
      return;
    }
    let alive = true;
    // Capturé avant l'appel : dans la réponse Supabase, `data` désigne la ligne
    // lue et masquerait la propriété `data` du composant.
    const builtinIds = fondCourant.principles.map((x) => x.id);
    setRemote("loading");
    setOfferAttach(false);
    supabase
      .from("declarations")
      // La révision arrive avec le document : c'est elle qui dit à la file
      // d'écriture d'où partir (voir 0009_revision_declarations.sql).
      .select("payload,revision")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          // Ni lecture ni écriture : on ne sait pas ce que le compte contient,
          // donc on n'y touche pas. L'autosauvegarde reste bloquée.
          setRemote("error");
          return;
        }
        if (!data?.payload) {
          // Compte sans Déclaration. Si un brouillon anonyme est à l'écran, on
          // ne le verse pas d'office dans ce compte : on propose.
          setRevisionCompte(0);
          setOfferAttach(!draftIsEmpty);
          setRemote("ready");
          return;
        }
        setRevisionCompte(
          typeof data.revision === "number" ? data.revision : 0,
        );
        const brut = normalizeDeclaration(data.payload, builtinIds);
        const resolution = resolvePrincipes(brut.content);
        if (resolution.statut === "release-absente") {
          setRemote("error");
          setReleaseMsg(
            c.releaseMissing(releaseLabel(resolution.release, locale)),
          );
          return;
        }
        if (resolution.statut === "empreinte-divergente") {
          setRemote("error");
          setReleaseMsg(
            c.releaseMismatch(releaseLabel(resolution.release, locale)),
          );
          return;
        }
        if (resolution.statut === "resolue") {
          setData(resolution.data);
          setContentRef(brut.content ?? null);
          setReleaseMsg(
            isOutdated(brut.content)
              ? c.releasePinned(releaseLabel(resolution.release, locale))
              : null,
          );
          setAFiger(false);
        } else {
          // Déclaration d'avant l'archivage : ouverte sur les Principes du jour,
          // et on le dit plutôt que de laisser croire à une garantie.
          setData(fondCourant);
          setContentRef(null);
          setReleaseMsg(c.releaseNotPinned);
          setAFiger(true);
        }
        const p = brut;
        setRemoved(new Set(p.removed));
        setCustom(p.custom);
        setOrder(p.order);
        setRaisonEtre(p.raisonEtre);
        setDevise(p.devise);
        setRatifiers(p.ratifiers);
        setSignatories(p.signatories);
        setRemote("ready");
      });
    return () => {
      alive = false;
    };
    // draftIsEmpty n'est lu qu'au moment de la réponse : le relire en dépendance
    // relancerait la requête à chaque frappe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId]);

  // L'écriture elle-même : `save_declaration()` n'accepte qu'une révision
  // strictement supérieure à celle en base, et dit ce qu'elle a fait.
  const ecrire = useCallback<Ecrire>(
    async (payload, revision) => {
      if (!supabase || !userId) return { statut: "erreur" };
      const { data, error } = await supabase.rpc("save_declaration", {
        p_payload: payload,
        p_revision: revision,
      });
      if (error) return { statut: "erreur" };
      return verdict(data);
    },
    [supabase, userId],
  );

  // File d'écriture de la Déclaration : une requête en vol au plus, la dernière
  // valeur en attente, et la révision qui refuse de reculer. L'état est rendu
  // visible (`saveState`) — une sauvegarde qui échoue en silence laisse croire
  // que le compte porte le document.
  //
  // Un ref réarmé par effet, et non un `useMemo` : la révision avance dans
  // l'instance à chaque écriture acceptée, et une instance reconstruite
  // repartirait de la valeur lue au chargement, donc se ferait refuser à tort.
  // Les seuls moments où elle doit repartir sont ceux où la révision de départ
  // change vraiment : changement de compte, ou relecture de la Déclaration.
  const file = useRef<FileDeclaration | null>(null);
  useEffect(() => {
    file.current = creerFileDeclaration({
      revision: revisionCompte,
      ecrire,
      etat: setSaveState,
    });
  }, [userId, revisionCompte, ecrire]);

  // Sauvegarde différée dans le compte à chaque changement (connecté).
  // Trois verrous avant d'écrire : le chargement local est fini, la Déclaration
  // du compte a été lue (`remote === "ready"`), et aucun rattachement n'est en
  // attente de décision. Le quatrième est dans la file : après un refus, elle
  // n'écrit plus rien.
  useEffect(() => {
    if (!supabase || !userId || !loaded) return;
    if (remote !== "ready" || offerAttach) return;
    const t = setTimeout(() => file.current?.enfiler(declarationPayload), 1500);
    return () => clearTimeout(t);
  }, [supabase, userId, loaded, remote, offerAttach, declarationPayload]);

  const remove = (id: string) => {
    setRemoved((s) => new Set([...s, id]));
    setConfirmId(null);
  };
  const restore = (id: string) =>
    setRemoved((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  const addCustom = () => {
    const title = newTitle.trim();
    if (!title) return;
    const id = `custom-${Date.now()}`;
    setCustom((c) => [...c, { id, title, text: newText.trim() }]);
    setOrder((o) => [...o, id]);
    setNewTitle("");
    setNewText("");
    setAdding(false);
  };
  const startEdit = (c: { id: string; title: string; text: string }) => {
    setEditingId(c.id);
    setEditTitle(c.title);
    setEditText(c.text);
  };
  const saveEdit = () => {
    const t = editTitle.trim();
    if (!t || !editingId) return;
    setCustom((cs) =>
      cs.map((x) =>
        x.id === editingId ? { ...x, title: t, text: editText.trim() } : x,
      ),
    );
    setEditingId(null);
  };

  const activeCount =
    data.principles.filter((p) => !removed.has(p.id)).length + custom.length;

  // Ordre d'affichage unifié (principes d'origine + ajoutés), réordonnable.
  const builtinById = new Map(data.principles.map((p) => [p.id, p]));
  const customById = new Map(custom.map((c) => [c.id, c]));
  const allIds = [
    ...data.principles.map((p) => p.id),
    ...custom.map((c) => c.id),
  ];
  const orderedIds = [
    ...order.filter((id) => allIds.includes(id)),
    ...allIds.filter((id) => !order.includes(id)),
  ];
  // Numérotation adaptative : compte uniquement les principes non retirés.
  const numberById = new Map<string, number>();
  let runningNo = 0;
  for (const id of orderedIds) {
    if (builtinById.has(id) && removed.has(id)) continue;
    runningNo += 1;
    numberById.set(id, runningNo);
  }

  /**
   * Déplace un principe d'un rang. C'est la voie clavier : le glisser-déposer
   * HTML n'en offre aucune, et l'ordre des principes était donc inatteignable
   * sans souris (revue adverse du 18/08/2026).
   */
  const decaler = (id: string, sens: -1 | 1) => {
    const arr = [...orderedIds];
    const from = arr.indexOf(id);
    const to = from + sens;
    if (from < 0 || to < 0 || to >= arr.length) return;
    arr.splice(from, 1);
    arr.splice(to, 0, id);
    setOrder(arr);
  };

  const moveTo = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const arr = [...orderedIds];
    const from = arr.indexOf(dragId);
    const to = arr.indexOf(targetId);
    if (from < 0 || to < 0) return;
    arr.splice(from, 1);
    arr.splice(to, 0, dragId);
    setOrder(arr);
    setDragId(null);
  };

  const parseNames = (s: string) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

  /** Rattache une Déclaration d'avant l'archivage aux Principes du jour. */
  const figerDeclaration = () => {
    setContentRef(currentContentRef(locale, "principes"));
    setAFiger(false);
    setReleaseMsg(null);
    // L'autosauvegarde suit : le payload dérive de l'état, la référence y entre.
  };

  /** Fait descendre le moteur PDF avant le clic (voir useComposerExport). */
  const precharger = () => {
    void import("@/lib/pdf").catch(() => {});
  };

  const doPdf = async () => {
    setPdfBusy(true);
    setPdfError(false);
    try {
      const items = orderedIds
        .filter((id) => !(builtinById.has(id) && removed.has(id)))
        .map((id, i) => {
          const p = builtinById.get(id);
          const c = customById.get(id);
          return {
            n: i + 1,
            title: p ? p.title : (c?.title ?? ""),
            text: p ? p.text : (c?.text ?? ""),
          };
        });
      const { generatePrincipesPdfBlob } = await import("@/lib/pdf");
      const blob = await generatePrincipesPdfBlob({
        meta: data.meta,
        intro: data.intro,
        raisonEtre: raisonEtre.trim() || undefined,
        devise: devise.trim() || undefined,
        adoptionText: t.adoptionText,
        items,
        ratifiers: parseNames(ratifiers),
        signatories: parseNames(signatories),
        logo: logo || undefined,
        font,
        titleColor: titleColor || undefined,
        locale,
        contentRef: contentRef ?? undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        locale === "en"
          ? "declaration-of-principles.pdf"
          : "declaration-de-principes.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Sans ce catch, le bouton reprenait son état normal et rien n'arrivait :
      // c'est ainsi que l'export de la Déclaration a échoué en silence pendant
      // des semaines (police italique non résoluble).
      setPdfError(true);
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePdf = () => {
    if (!account) {
      setGate(true);
      return;
    }
    doPdf();
  };

  return (
    <div
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8"
      style={fontVars(font)}
    >
      {/* Ce que le compte fait de la Déclaration ne reste pas muet : lecture
          ratée, écriture ratée et export raté se disent, chacun avec la
          conséquence exacte pour la personne. */}
      {releaseMsg && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-warning-border bg-warning-soft p-3 text-sm text-warning-strong"
        >
          <p>{releaseMsg}</p>
          {aFiger && (
            <button
              onClick={figerDeclaration}
              className="mt-2 rounded-full bg-amber-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-800"
            >
              {c.releasePinAction}
            </button>
          )}
        </div>
      )}
      {remote === "error" && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-app-border bg-danger-soft p-3 text-sm text-danger-strong"
        >
          {t.loadFailed}
        </p>
      )}
      {saveState === "error" && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-app-border bg-danger-soft p-3 text-sm text-danger-strong"
        >
          {t.saveFailed}
        </p>
      )}
      {saveState === "perimee" && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-warning-border bg-warning-soft p-3 text-sm text-warning-strong"
        >
          {t.saveStale}
        </p>
      )}
      {pdfError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-app-border bg-danger-soft p-3 text-sm text-danger-strong"
        >
          {t.pdfFailed}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {saveState === "saving" ? t.saving : saveState === "saved" ? t.saved : ""}
      </p>
      {offerAttach && (
        <div className="mb-6 rounded-lg border border-warning-border bg-warning-soft p-4 text-sm text-warning-strong">
          <p className="font-medium">
            {t.attachTitle}
          </p>
          <p className="mt-1">
            {t.attachBody}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setOfferAttach(false)}
              className="rounded-full bg-amber-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-800"
            >
              {t.attachKeep}
            </button>
            <button
              onClick={clearDeclaration}
              className="rounded-full border border-amber-400 px-3 py-1.5 text-xs font-medium transition hover:bg-amber-100"
            >
              {t.attachReset}
            </button>
          </div>
        </div>
      )}
      <header className="mb-8 border-b border-rule pb-6">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={t.logoAlt}
            className="mb-3 max-h-16 w-auto"
          />
        )}
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          {t.editionKicker}
        </p>
        <h1
          className="mt-1 font-serif text-3xl font-semibold text-strong sm:text-4xl"
          style={titleColor ? { color: titleColor } : undefined}
        >
          {data.meta.title}
        </h1>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
          {UI[locale].derivation}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {t.kept(activeCount)}
          </p>
          <button
            onClick={handlePdf}
            onPointerEnter={precharger}
            onFocus={precharger}
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
            {pdfBusy ? t.generating : t.downloadPdf}
          </button>
        </div>
      </header>

      <article className="doc-prose text-[1.05rem] text-body">
        <p className="mb-6 italic leading-relaxed text-body">{data.intro}</p>

        <div className="mb-8 space-y-3 rounded-md border border-rule bg-surface/70 p-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-muted">
              {t.purposeLabel}
            </label>
            <textarea
              value={raisonEtre}
              onChange={(e) => setRaisonEtre(e.target.value)}
              rows={2}
              placeholder={t.purposePlaceholder}
              className="doc-prose mt-1 w-full resize-y rounded border border-field bg-transparent p-2.5 text-[0.98rem] leading-relaxed outline-none transition focus:border-field-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-muted">
              {t.mottoLabel}{" "}
              <span className="normal-case text-muted">
                ({locale === "en" ? "optional" : "facultatif"})
              </span>
            </label>
            <input
              value={devise}
              onChange={(e) => setDevise(e.target.value)}
              placeholder={t.mottoPlaceholder}
              className="mt-1 w-full rounded border border-field bg-transparent px-2.5 py-2 text-sm outline-none transition focus:border-field-accent"
            />
          </div>
        </div>

        <p className="mb-4 text-xs text-muted">
          {t.dragHintPre} <span aria-hidden>⠿</span> {t.dragHint}
          <span className="mt-0.5 block">{t.keyboardHint}</span>
        </p>

        {orderedIds.map((id) => {
          const p = builtinById.get(id);
          const c = customById.get(id);

          // Principe d'origine retiré : placeholder gardé à sa place.
          if (p && removed.has(id)) {
            return (
              <div
                key={id}
                className="mb-3 flex items-center justify-between gap-3 rounded-md border border-dashed border-rule-strong px-3 py-2 text-sm text-muted"
              >
                <span>{t.removedPrinciple(p.title)}</span>
                <button
                  onClick={() => restore(id)}
                  className="shrink-0 underline transition hover:text-body"
                >
                  {t.restore}
                </button>
              </div>
            );
          }

          const num = numberById.get(id);
          const dragging = dragId === id;
          const dragProps = {
            draggable: true,
            onDragStart: () => setDragId(id),
            onDragOver: (e: DragEvent) => e.preventDefault(),
            onDrop: () => moveTo(id),
            onDragEnd: () => setDragId(null),
          };
          const rang = orderedIds.indexOf(id);
          const titreLisible = p ? p.title : (c?.title ?? "");
          const grip = (
            <span className="mt-1 flex shrink-0 flex-col items-center">
              <span
                className="cursor-grab select-none text-muted transition hover:text-muted"
                title={t.dragTitle}
                aria-hidden
              >
                ⠿
              </span>
              {/* Deux boutons plutôt qu'une poignée inerte : sans eux, l'ordre
                  des principes ne s'atteint qu'à la souris. */}
              <button
                type="button"
                onClick={() => decaler(id, -1)}
                disabled={rang <= 0}
                aria-label={t.moveUp(titreLisible)}
                title={t.moveUp(titreLisible)}
                className="rounded px-1 text-[0.65rem] leading-none text-muted transition hover:text-body disabled:opacity-0"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => decaler(id, 1)}
                disabled={rang >= orderedIds.length - 1}
                aria-label={t.moveDown(titreLisible)}
                title={t.moveDown(titreLisible)}
                className="rounded px-1 text-[0.65rem] leading-none text-muted transition hover:text-body disabled:opacity-0"
              >
                ▼
              </button>
            </span>
          );
          const accent = c ? "border-violet-300" : "border-rule";

          return (
            <section
              key={id}
              {...dragProps}
              className={`group mb-7 flex gap-2 border-l-2 pl-4 transition ${accent} ${
                dragging ? "opacity-40" : ""
              }`}
            >
              {grip}
              <div className="min-w-0 flex-1">
                {c && editingId === id ? (
                  <div>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder={t.titlePlaceholder}
                      className="w-full rounded border border-field px-3 py-2 text-sm outline-none transition focus:border-field-accent"
                    />
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      placeholder={t.textPlaceholder}
                      className="doc-prose mt-2 w-full resize-y rounded border border-field p-3 text-[0.98rem] outline-none transition focus:border-field-accent"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={!editTitle.trim()}
                        className="rounded-full btn-ink px-4 py-1.5 text-sm font-medium transition disabled:opacity-50"
                      >
                        {t.save}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-full border border-field px-4 py-1.5 text-sm text-body transition hover:border-field-accent"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-serif text-lg font-semibold text-strong">
                        {num}. {p ? p.title : c!.title}
                      </h2>
                      <div className="flex shrink-0 gap-3 text-xs text-muted transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        {c && (
                          <button
                            onClick={() => startEdit(c)}
                            className="underline transition hover:text-body"
                          >
                            {t.edit}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            p
                              ? setConfirmId(id)
                              : setCustom((cs) => cs.filter((x) => x.id !== id))
                          }
                          className="underline transition hover:text-warning-muted"
                        >
                          {t.remove}
                        </button>
                      </div>
                    </div>
                    {p
                      ? <Prose text={p.text} onTermClick={onTermClick} locale={locale} keyBase={id} />
                      : c!.text
                        ? <Prose text={c!.text} onTermClick={onTermClick} locale={locale} keyBase={id} />
                        : null}
                    {c && (
                      <p className="mt-1 text-[0.7rem] uppercase tracking-wide text-violet-500">
                        {t.added}
                      </p>
                    )}
                  </>
                )}
                {p && confirmId === id && (
                  <div className="mt-3 rounded-md border-l-4 border-amber-400 bg-warning-faint py-3 pl-4 pr-3">
                    <p className="text-sm text-amber-800">
                      <span className="font-semibold">
                        {t.confirmRemove}
                      </span>{" "}
                      {p.warning}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => remove(id)}
                        className="rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-700"
                      >
                        {t.confirmRemoveBtn}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded-full border border-field px-3 py-1 text-xs text-body transition hover:border-field-accent"
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {adding ? (
          <div className="mt-4 rounded-md border border-rule bg-surface/70 p-4">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t.titlePlaceholder}
              className="w-full rounded border border-field px-3 py-2 text-sm outline-none transition focus:border-field-accent"
            />
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={3}
              placeholder={t.textPlaceholder}
              className="doc-prose mt-2 w-full resize-y rounded border border-field p-3 text-[0.98rem] outline-none transition focus:border-field-accent"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={addCustom}
                disabled={!newTitle.trim()}
                className="rounded-full btn-ink px-4 py-1.5 text-sm font-medium transition disabled:opacity-50"
              >
                {t.add}
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setNewTitle("");
                  setNewText("");
                }}
                className="rounded-full border border-field px-4 py-1.5 text-sm text-body transition hover:border-field-accent"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-dashed border-field px-3 py-1.5 text-sm text-muted transition hover:border-field-accent hover:text-body"
          >
            <span className="text-base leading-none">+</span> {t.addPrinciple}
          </button>
        )}

        <section className="mt-12 border-t border-rule pt-6">
          <h2 className="font-serif text-xl font-semibold text-strong">
            {t.adoption}
          </h2>
          <p className="mt-2 leading-relaxed">{t.adoptionText}</p>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-muted">
                {t.ratifiers}
              </label>
              <textarea
                value={ratifiers}
                onChange={(e) => setRatifiers(e.target.value)}
                rows={4}
                placeholder={t.namesPlaceholder}
                className="doc-prose mt-1 w-full resize-y rounded border border-field bg-surface/70 p-2.5 text-[0.95rem] outline-none transition focus:border-field-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-muted">
                {t.signatories}
              </label>
              <textarea
                value={signatories}
                onChange={(e) => setSignatories(e.target.value)}
                rows={4}
                placeholder={t.namesPlaceholder}
                className="doc-prose mt-1 w-full resize-y rounded border border-field bg-surface/70 p-2.5 text-[0.95rem] outline-none transition focus:border-field-accent"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            {t.namesHint}
          </p>
        </section>

        <footer className="mt-12 flex items-start gap-3 border-t border-rule pt-6 text-xs text-muted">
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
            {t.footer(data.meta.license, data.meta.notice)}
          </span>
        </footer>
      </article>

      {gate && (
        <Modale onClose={() => setGate(false)} labelledBy="titre-mur-principes">
            <button
              onClick={() => setGate(false)}
              aria-label={c.close}
              className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition hover:bg-surface/20 hover:text-white"
            >
              ✕
            </button>
            <div className="bg-gradient-to-br from-teal-500 to-violet-600 px-6 py-7 text-white">
              <p className="text-xs font-medium uppercase tracking-widest text-white/80">
                {c.createFreeAccount}
              </p>
              <h2
                id="titre-mur-principes"
                className="mt-1 font-serif text-2xl font-semibold"
              >
                {t.gateTitle}
              </h2>
              <p className="mt-2 text-sm text-white/90">
                {t.gateDesc}
              </p>
            </div>
            <div className="px-6 py-6">
              <button
                onClick={signIn}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-field bg-surface px-4 py-2.5 text-sm font-medium text-body shadow-sm transition hover:bg-surface-subtle"
              >
                <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
                  <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                  <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
                </svg>
                {c.continueGoogle}
              </button>
              <div className="my-3 flex items-center gap-3 text-[0.7rem] uppercase tracking-wide text-muted">
                <span className="h-px flex-1 bg-surface-strong" />
                {c.orByEmail}
                <span className="h-px flex-1 bg-surface-strong" />
              </div>
              {otpSent ? (
                <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-teal-800">
                  {c.emailSent}
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={c.emailPlaceholder}
                    className="min-w-0 flex-1 rounded-lg border border-field px-3 py-2 text-sm outline-none transition focus:border-field-accent"
                  />
                  <button
                    onClick={signInOtp}
                    disabled={!email.trim()}
                    className="shrink-0 rounded-lg btn-ink px-3 py-2 text-sm font-medium transition disabled:opacity-50"
                  >
                    {c.sendLink}
                  </button>
                </div>
              )}
            </div>
        </Modale>
      )}
    </div>
  );
}
