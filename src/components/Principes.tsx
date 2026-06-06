"use client";

import { useEffect, useState } from "react";
import { fontVars } from "@/lib/branding";

const LS_PRINCIPES = "cc_principes";

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

function paras(text: string) {
  return text.split(/\n\n/).map((p, i) => (
    <p key={i} className="mt-2 leading-relaxed">
      {p}
    </p>
  ));
}

export default function Principes({
  data,
  logo,
  font,
  titleColor,
}: {
  data: PrincipesData;
  logo: string;
  font: string;
  titleColor: string;
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
  const [loaded, setLoaded] = useState(false);

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
        JSON.stringify({ removed: [...removed], custom, raisonEtre, devise }),
      );
    } catch {}
  }, [loaded, removed, custom, raisonEtre, devise]);

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
    setCustom((c) => [
      ...c,
      { id: `custom-${c.length}`, title, text: newText.trim() },
    ]);
    setNewTitle("");
    setNewText("");
    setAdding(false);
  };

  const activeCount =
    data.principles.filter((p) => !removed.has(p.id)).length + custom.length;

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
        <p className="mt-2 text-sm text-slate-500">
          {activeCount} principe{activeCount > 1 ? "s" : ""} retenu
          {activeCount > 1 ? "s" : ""}
        </p>
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

        {data.principles.map((p) =>
          removed.has(p.id) ? (
            <div
              key={p.id}
              className="mb-3 flex items-center justify-between gap-3 rounded-md border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-400"
            >
              <span>
                Principe {p.n} retiré — « {p.title} »
              </span>
              <button
                onClick={() => restore(p.id)}
                className="shrink-0 underline transition hover:text-slate-600"
              >
                Rétablir
              </button>
            </div>
          ) : (
            <section key={p.id} className="mb-7 border-l-2 border-slate-200 pl-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-lg font-semibold text-slate-900">
                  {p.n}. {p.title}
                </h2>
                <button
                  onClick={() => setConfirmId(p.id)}
                  className="shrink-0 text-xs text-slate-400 underline transition hover:text-amber-600"
                >
                  Retirer
                </button>
              </div>
              {paras(p.text)}
              {confirmId === p.id && (
                <div className="mt-3 rounded-md border-l-4 border-amber-400 bg-amber-50/60 py-3 pl-4 pr-3">
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">⚠ Retirer ce principe ?</span>{" "}
                    {p.warning}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => remove(p.id)}
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
            </section>
          ),
        )}

        {custom.map((c) => (
          <section key={c.id} className="mb-7 border-l-2 border-violet-300 pl-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold text-slate-900">
                {c.title}
              </h2>
              <button
                onClick={() => setCustom((cs) => cs.filter((x) => x.id !== c.id))}
                className="shrink-0 text-xs text-slate-400 underline transition hover:text-amber-600"
              >
                Retirer
              </button>
            </div>
            {c.text ? paras(c.text) : null}
            <p className="mt-1 text-[0.7rem] uppercase tracking-wide text-violet-500">
              Principe ajouté
            </p>
          </section>
        ))}

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
    </div>
  );
}
