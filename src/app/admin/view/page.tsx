"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import { compose, type ConstitutionData } from "@/lib/constitution";
import { fontVars } from "@/lib/branding";
import constitutionRaw from "@/data/constitution.fr.json";
import principesRaw from "@/data/principes.fr.json";

const constitution = constitutionRaw as ConstitutionData;
const principes = principesRaw as {
  meta: Record<string, string>;
  intro: string;
  principles: { id: string; title: string; text: string }[];
};

const ADOPTION_TEXT =
  "En ratifiant le présent document, les Ratificateurs adoptent l'ensemble indissociable que forment ces Principes et la Constitution comme cadre de gouvernance et d'exploitation de leur organisation. Ils transfèrent leur autorité dans ce que ces Principes et cette Constitution définissent ensemble, et s'engagent à n'exercer le pouvoir qu'à travers les processus qui en découlent. Les Partenaires signataires acceptent d'œuvrer selon ce même cadre.";

interface CompPayload {
  title?: string;
  values?: string;
  active?: string[];
  titleColor?: string;
  font?: string;
  logo?: string;
}
interface DeclPayload {
  removed?: string[];
  custom?: { id: string; title: string; text: string }[];
  order?: string[];
  raisonEtre?: string;
  devise?: string;
  ratifiers?: string;
  signatories?: string;
}

function inline(s: string, kb: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${kb}-${i}`} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={`${kb}-${i}`}>{part}</span>
    ),
  );
}
function prose(text: string, kb: string): ReactNode[] {
  return text.split(/\n\n/).map((chunk, i) => {
    const lines = chunk.split("\n");
    if (lines.length > 1 && lines.every((l) => /^- /.test(l.trim()))) {
      return (
        <ul key={i} className="mb-3 ml-5 list-disc space-y-1">
          {lines.map((l, j) => (
            <li key={j}>{inline(l.trim().replace(/^- /, ""), `${kb}-${i}-${j}`)}</li>
          ))}
        </ul>
      );
    }
    if (lines.length > 1 && lines.every((l) => /^\d+\.\s/.test(l.trim()))) {
      return (
        <ol key={i} className="mb-3 ml-5 list-decimal space-y-1">
          {lines.map((l, j) => (
            <li key={j}>
              {inline(l.trim().replace(/^\d+\.\s/, ""), `${kb}-${i}-${j}`)}
            </li>
          ))}
        </ol>
      );
    }
    return (
      <p key={i} className="mb-3 leading-relaxed">
        {inline(chunk, `${kb}-${i}`)}
      </p>
    );
  });
}

type State =
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "notfound" }
  | {
      kind: "ready";
      comp: CompPayload;
      decl: DeclPayload | null;
      who: string;
    };

export default function AdminViewPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setState({ kind: "notfound" });
      return;
    }
    const compId = new URLSearchParams(window.location.search).get("comp");
    (async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session?.user || !isAdminEmail(session.user.email)) {
        setState({ kind: "denied" });
        return;
      }
      if (!compId) {
        setState({ kind: "notfound" });
        return;
      }
      const { data: comp } = await sb
        .from("compositions")
        .select("user_id,name,payload")
        .eq("id", compId)
        .maybeSingle();
      if (!comp) {
        setState({ kind: "notfound" });
        return;
      }
      const [{ data: decl }, { data: prof }] = await Promise.all([
        sb
          .from("declarations")
          .select("payload")
          .eq("user_id", comp.user_id)
          .maybeSingle(),
        sb
          .from("profiles")
          .select("full_name,email,company")
          .eq("id", comp.user_id)
          .maybeSingle(),
      ]);
      setState({
        kind: "ready",
        comp: comp.payload as CompPayload,
        decl: (decl?.payload as DeclPayload) ?? null,
        who:
          [prof?.full_name, prof?.company].filter(Boolean).join(" · ") ||
          prof?.email ||
          "Compte",
      });
    })();
  }, []);

  if (state.kind === "loading")
    return <main className="p-10 text-sm text-slate-500">Chargement…</main>;
  if (state.kind === "denied")
    return (
      <main className="p-10 text-sm text-slate-700">
        Accès réservé. Connectez-vous avec un compte associé.
      </main>
    );
  if (state.kind === "notfound")
    return (
      <main className="p-10 text-sm text-slate-700">
        Composition introuvable.{" "}
        <Link href="/admin/" className="underline">
          ← Admin
        </Link>
      </main>
    );

  const { comp, decl, who } = state;
  const branding = fontVars(comp.font ?? "source-serif");
  const titleStyle = comp.titleColor ? { color: comp.titleColor } : undefined;

  const items = compose(constitution, new Set(comp.active ?? []));

  // Principes ordonnés (comme dans la Déclaration).
  let declItems: { n: number; title: string; text: string }[] = [];
  if (decl) {
    const builtin = new Map(principes.principles.map((p) => [p.id, p]));
    const customById = new Map((decl.custom ?? []).map((c) => [c.id, c]));
    const allIds = [
      ...principes.principles.map((p) => p.id),
      ...(decl.custom ?? []).map((c) => c.id),
    ];
    const order = decl.order ?? [];
    const removed = new Set(decl.removed ?? []);
    const ordered = [
      ...order.filter((id) => allIds.includes(id)),
      ...allIds.filter((id) => !order.includes(id)),
    ].filter((id) => !(builtin.has(id) && removed.has(id)));
    declItems = ordered.map((id, i) => {
      const p = builtin.get(id);
      const c = customById.get(id);
      return {
        n: i + 1,
        title: p ? p.title : (c?.title ?? ""),
        text: p ? p.text : (c?.text ?? ""),
      };
    });
  }
  const names = (s?: string) =>
    (s ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6" style={branding}>
      <div className="mb-6 flex items-center justify-between text-sm">
        <Link href="/admin/" className="text-slate-500 underline hover:text-slate-800">
          ← Admin
        </Link>
        <span className="text-slate-400">{who}</span>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      {comp.logo && (
        <img src={comp.logo} alt="Logo" className="mb-3 max-h-16 w-auto" />
      )}
      <h1
        className="font-serif text-3xl font-semibold text-slate-900 sm:text-4xl"
        style={titleStyle}
      >
        {comp.title || constitution.meta.title}
      </h1>

      <article className="doc-prose mt-6 text-[1.05rem] text-slate-800">
        {items.map((it) => (
          <section key={it.key} className="mb-8">
            {it.heading && (
              <h2 className="mb-2 font-serif text-2xl font-semibold text-slate-900">
                {it.heading}
              </h2>
            )}
            <div
              className={
                it.kind === "block"
                  ? ""
                  : "rounded-r-md border-l-4 border-slate-200 py-2 pl-4"
              }
            >
              {it.kind !== "block" && it.moduleLabel && (
                <p className="mb-1 text-[0.7rem] uppercase tracking-wide text-slate-400">
                  {it.warning ? `Règle par défaut : ${it.moduleLabel}` : it.moduleLabel}
                </p>
              )}
              {prose(it.text, it.key)}
            </div>
          </section>
        ))}
      </article>

      {decl && (
        <article className="doc-prose mt-12 border-t border-slate-200 pt-8 text-[1.05rem] text-slate-800">
          <h1
            className="font-serif text-3xl font-semibold text-slate-900"
            style={titleStyle}
          >
            {principes.meta.title}
          </h1>
          {decl.devise && (
            <p className="mt-2 italic text-slate-600">« {decl.devise} »</p>
          )}
          {decl.raisonEtre && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Raison d&apos;Être
              </p>
              {prose(decl.raisonEtre, "re")}
            </div>
          )}
          <p className="mt-4 italic text-slate-600">{principes.intro}</p>
          {declItems.map((it) => (
            <section key={it.n} className="mt-6 border-l-2 border-slate-200 pl-4">
              <h2 className="font-serif text-lg font-semibold text-slate-900">
                {it.n}. {it.title}
              </h2>
              {it.text ? prose(it.text, `d${it.n}`) : null}
            </section>
          ))}
          <h2 className="mt-8 font-serif text-xl font-semibold text-slate-900">
            Adoption
          </h2>
          <p className="mt-2 leading-relaxed">{ADOPTION_TEXT}</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Ratificateurs
              </p>
              {names(decl.ratifiers).map((n, i) => (
                <p key={i} className="border-b border-slate-200 py-2">
                  {n}
                </p>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Signataires
              </p>
              {names(decl.signatories).map((n, i) => (
                <p key={i} className="border-b border-slate-200 py-2">
                  {n}
                </p>
              ))}
            </div>
          </div>
        </article>
      )}
    </main>
  );
}
