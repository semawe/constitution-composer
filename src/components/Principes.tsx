"use client";

import { type DragEvent, useEffect, useMemo, useState } from "react";
import { fontVars } from "@/lib/branding";
import { linkifyTerms } from "@/lib/glossary";
import { getSupabase } from "@/lib/supabase";

const LS_PRINCIPES = "cc_principes";

const ADOPTION_TEXT =
  "En ratifiant le présent document, les Ratificateurs adoptent l'ensemble indissociable que forment ces Principes et la Constitution comme cadre de gouvernance et d'exploitation de leur organisation. Ils transfèrent leur autorité dans ce que ces Principes et cette Constitution définissent ensemble, et s'engagent à n'exercer le pouvoir qu'à travers les processus qui en découlent. Les Partenaires signataires acceptent d'œuvrer selon ce même cadre.";

export interface Principle {
  id: string;
  n: string;
  title: string;
  text: string;
  warning: string;
}

export interface PrincipesData {
  meta: Record<string, string>;
  intro: string;
  principles: Principle[];
}

function paras(
  text: string,
  onTermClick: (key: string) => void,
  keyBase = "t",
) {
  return text.split(/\n\n/).map((p, i) => (
    <p key={i} className="mt-2 leading-relaxed">
      {linkifyTerms(p, onTermClick, `${keyBase}-${i}`)}
    </p>
  ));
}

export default function Principes({
  data,
  logo,
  font,
  titleColor,
  onTermClick,
}: {
  data: PrincipesData;
  logo: string;
  font: string;
  titleColor: string;
  onTermClick: (key: string) => void;
}) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [custom, setCustom] = useState<
    { id: string; title: string; text: string }[]
  >([]);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [raisonEtre, setRaisonEtre] = useState("");
  const [devise, setDevise] = useState("");
  const [ratifiers, setRatifiers] = useState("");
  const [signatories, setSignatories] = useState("");
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Compte (mur freemium du PDF de la Déclaration, comme la Constitution).
  const supabase = useMemo(() => getSupabase(), []);
  const [account, setAccount] = useState(false);
  const [gate, setGate] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    if (!supabase) {
      try {
        if (localStorage.getItem("cc_account") === "1") setAccount(true);
      } catch {}
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => setAccount(!!data.session?.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setAccount(!!s?.user),
    );
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

  // Restaure l'état des principes (survit au changement d'onglet et au rechargement).
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

  // Persiste à chaque changement (après le chargement initial).
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        LS_PRINCIPES,
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
      removed: [...removed],
      custom,
      order,
      raisonEtre,
      devise,
      ratifiers,
      signatories,
    }),
    [removed, custom, order, raisonEtre, devise, ratifiers, signatories],
  );

  // À la connexion : charge la Déclaration du compte si elle existe.
  useEffect(() => {
    if (!supabase || !account) return;
    let alive = true;
    supabase
      .from("declarations")
      .select("payload")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data?.payload) return;
        const p = data.payload as {
          removed?: string[];
          custom?: { id: string; title: string; text: string }[];
          order?: string[];
          raisonEtre?: string;
          devise?: string;
          ratifiers?: string;
          signatories?: string;
        };
        if (Array.isArray(p.removed)) setRemoved(new Set(p.removed));
        if (Array.isArray(p.custom)) setCustom(p.custom);
        if (Array.isArray(p.order)) setOrder(p.order);
        if (typeof p.raisonEtre === "string") setRaisonEtre(p.raisonEtre);
        if (typeof p.devise === "string") setDevise(p.devise);
        if (typeof p.ratifiers === "string") setRatifiers(p.ratifiers);
        if (typeof p.signatories === "string") setSignatories(p.signatories);
      });
    return () => {
      alive = false;
    };
  }, [supabase, account]);

  // Sauvegarde différée dans le compte à chaque changement (connecté).
  useEffect(() => {
    if (!supabase || !account || !loaded) return;
    const t = setTimeout(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("declarations").upsert({
        user_id: user.id,
        payload: declarationPayload,
        updated_at: new Date().toISOString(),
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [supabase, account, loaded, declarationPayload]);

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

  const doPdf = async () => {
    setPdfBusy(true);
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
        adoptionText: ADOPTION_TEXT,
        items,
        ratifiers: parseNames(ratifiers),
        signatories: parseNames(signatories),
        logo: logo || undefined,
        font,
        titleColor: titleColor || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "declaration-de-principes.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
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
      <header className="mb-8 border-b border-slate-200 pb-6">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt="Logo de l'organisation"
            className="mb-3 max-h-16 w-auto"
          />
        )}
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
          {data.meta.version}
        </p>
        <h1
          className="mt-1 font-serif text-3xl font-semibold text-slate-900 sm:text-4xl"
          style={titleColor ? { color: titleColor } : undefined}
        >
          {data.meta.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {activeCount} principe{activeCount > 1 ? "s" : ""} retenu
            {activeCount > 1 ? "s" : ""}
          </p>
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
            {pdfBusy ? "Génération…" : "Télécharger le PDF signable"}
          </button>
        </div>
      </header>

      <article className="doc-prose text-[1.05rem] text-slate-800">
        <p className="mb-6 italic leading-relaxed text-slate-600">{data.intro}</p>

        <div className="mb-8 space-y-3 rounded-md border border-slate-200 bg-white/70 p-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Raison d&apos;Être de l&apos;organisation
            </label>
            <textarea
              value={raisonEtre}
              onChange={(e) => setRaisonEtre(e.target.value)}
              rows={2}
              placeholder="La raison d'être que ces principes servent — quelques lignes."
              className="doc-prose mt-1 w-full resize-y rounded border border-slate-200 bg-transparent p-2.5 text-[0.98rem] leading-relaxed outline-none transition focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Devise <span className="normal-case text-slate-400">(facultatif)</span>
            </label>
            <input
              value={devise}
              onChange={(e) => setDevise(e.target.value)}
              placeholder="Une formule courte qui vous rassemble."
              className="mt-1 w-full rounded border border-slate-200 bg-transparent px-2.5 py-2 text-sm outline-none transition focus:border-slate-400"
            />
          </div>
        </div>

        <p className="mb-4 text-xs text-slate-400">
          Glissez un principe par sa poignée <span aria-hidden>⠿</span> pour le
          réordonner ; la numérotation s&apos;adapte.
        </p>

        {orderedIds.map((id) => {
          const p = builtinById.get(id);
          const c = customById.get(id);

          // Principe d'origine retiré : placeholder gardé à sa place.
          if (p && removed.has(id)) {
            return (
              <div
                key={id}
                className="mb-3 flex items-center justify-between gap-3 rounded-md border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-400"
              >
                <span>Principe retiré — « {p.title} »</span>
                <button
                  onClick={() => restore(id)}
                  className="shrink-0 underline transition hover:text-slate-600"
                >
                  Rétablir
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
          const grip = (
            <span
              className="mt-1 shrink-0 cursor-grab select-none text-slate-300 transition hover:text-slate-500"
              title="Glisser pour réordonner"
              aria-hidden
            >
              ⠿
            </span>
          );
          const accent = c ? "border-violet-300" : "border-slate-200";

          return (
            <section
              key={id}
              {...dragProps}
              className={`mb-7 flex gap-2 border-l-2 pl-4 transition ${accent} ${
                dragging ? "opacity-40" : ""
              }`}
            >
              {grip}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-serif text-lg font-semibold text-slate-900">
                    {num}. {p ? p.title : c!.title}
                  </h2>
                  <button
                    onClick={() =>
                      p
                        ? setConfirmId(id)
                        : setCustom((cs) => cs.filter((x) => x.id !== id))
                    }
                    className="shrink-0 text-xs text-slate-400 underline transition hover:text-amber-600"
                  >
                    Retirer
                  </button>
                </div>
                {p
                  ? paras(p.text, onTermClick, id)
                  : c!.text
                    ? paras(c!.text, onTermClick, id)
                    : null}
                {c && (
                  <p className="mt-1 text-[0.7rem] uppercase tracking-wide text-violet-500">
                    Principe ajouté
                  </p>
                )}
                {p && confirmId === id && (
                  <div className="mt-3 rounded-md border-l-4 border-amber-400 bg-amber-50/60 py-3 pl-4 pr-3">
                    <p className="text-sm text-amber-800">
                      <span className="font-semibold">
                        ⚠ Retirer ce principe ?
                      </span>{" "}
                      {p.warning}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => remove(id)}
                        className="rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-700"
                      >
                        Confirmer le retrait
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-500"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {adding ? (
          <div className="mt-4 rounded-md border border-slate-200 bg-white/70 p-4">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Titre du principe"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
            />
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={3}
              placeholder="Énoncé du principe (optionnel)"
              className="doc-prose mt-2 w-full resize-y rounded border border-slate-200 p-3 text-[0.98rem] outline-none transition focus:border-slate-400"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={addCustom}
                disabled={!newTitle.trim()}
                className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                Ajouter
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setNewTitle("");
                  setNewText("");
                }}
                className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-600 transition hover:border-slate-500"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-700"
          >
            <span className="text-base leading-none">+</span> Ajouter un principe
          </button>
        )}

        <section className="mt-12 border-t border-slate-200 pt-6">
          <h2 className="font-serif text-xl font-semibold text-slate-900">
            Adoption
          </h2>
          <p className="mt-2 leading-relaxed">{ADOPTION_TEXT}</p>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Ratificateurs
              </label>
              <textarea
                value={ratifiers}
                onChange={(e) => setRatifiers(e.target.value)}
                rows={4}
                placeholder="Un nom et prénom par ligne."
                className="doc-prose mt-1 w-full resize-y rounded border border-slate-200 bg-white/70 p-2.5 text-[0.95rem] outline-none transition focus:border-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Signataires
              </label>
              <textarea
                value={signatories}
                onChange={(e) => setSignatories(e.target.value)}
                rows={4}
                placeholder="Un nom et prénom par ligne."
                className="doc-prose mt-1 w-full resize-y rounded border border-slate-200 bg-white/70 p-2.5 text-[0.95rem] outline-none transition focus:border-slate-400"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Ces noms apparaîtront avec une ligne de signature dans le PDF de la
            Déclaration.
          </p>
        </section>

        <footer className="mt-12 flex items-start gap-3 border-t border-slate-200 pt-6 text-xs text-slate-400">
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
            Déclaration de Principes composée avec le Composeur de Sémawé,
            diffusée sous licence {data.meta.license}, dérivée de la Constitution
            Holacracy. {data.meta.notice}
          </span>
        </footer>
      </article>

      {gate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setGate(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <button
              onClick={() => setGate(false)}
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
                Téléchargez votre Déclaration
              </h2>
              <p className="mt-2 text-sm text-white/90">
                Le PDF signable de votre Déclaration de Principes est réservé aux
                membres — la création de compte est gratuite.
              </p>
            </div>
            <div className="px-6 py-6">
              <button
                onClick={signIn}
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
              <div className="my-3 flex items-center gap-3 text-[0.7rem] uppercase tracking-wide text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                ou par e-mail
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              {otpSent ? (
                <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
                  Lien de connexion envoyé. Ouvrez-le depuis votre boîte mail.
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.fr"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                  />
                  <button
                    onClick={signInOtp}
                    disabled={!email.trim()}
                    className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    Recevoir un lien
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
