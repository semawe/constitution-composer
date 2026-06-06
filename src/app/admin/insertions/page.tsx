"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import type { ConstitutionData } from "@/lib/constitution";
import constitutionRaw from "@/data/constitution.fr.json";

const data = constitutionRaw as ConstitutionData;
const LS_KEY = "cc_insertion_spec";

// paragraphes d'un bloc (pour proposer "après le paragraphe …").
function paragraphsOf(blockId: string): string[] {
  const b = data.blocks.find((x) => x.id === blockId);
  return b ? b.text.split(/\n\n/) : [];
}
const preview = (s: string, n = 60) =>
  s.replace(/\*\*/g, "").trim().slice(0, n) + (s.length > n ? "…" : "");

interface Row {
  key: string;
  moduleId: string;
  label: string;
  tier: string;
  insIndex: number;
  insText: string;
  defaultAnchor: string;
}

// "start" | "end" | "p<index>"
type Pos = string;

export default function InsertionsConfigPage() {
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [cfg, setCfg] = useState<Record<string, { anchor: string; pos: Pos }>>(
    {},
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setAdmin(false);
      return;
    }
    sb.auth
      .getSession()
      .then(({ data: d }) => setAdmin(isAdminEmail(d.session?.user?.email)));
  }, []);

  const rows = useMemo<Row[]>(
    () =>
      data.modules.flatMap((m) =>
        m.insertions.map((ins, i) => ({
          key: `${m.id}#${i}`,
          moduleId: m.id,
          label: m.label,
          tier: m.tier,
          insIndex: i,
          insText: ins.text,
          defaultAnchor: ins.anchor,
        })),
      ),
    [],
  );

  useEffect(() => {
    let init: Record<string, { anchor: string; pos: Pos }> = {};
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) init = JSON.parse(raw);
    } catch {}
    // compléter avec les valeurs par défaut (ancre actuelle, fin du bloc).
    const merged = { ...init };
    for (const r of rows) {
      if (!merged[r.key])
        merged[r.key] = { anchor: r.defaultAnchor, pos: "end" };
    }
    setCfg(merged);
  }, [rows]);

  const update = (key: string, patch: Partial<{ anchor: string; pos: Pos }>) =>
    setCfg((c) => {
      const next = { ...c, [key]: { ...c[key], ...patch } };
      if (patch.anchor) next[key].pos = "end"; // reset position si on change de bloc
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const posLabel = (anchor: string, pos: Pos) => {
    if (pos === "start") return "tout début du bloc";
    if (pos === "end") return "fin du bloc";
    const idx = Number(pos.replace("p", ""));
    return `après : « ${preview(paragraphsOf(anchor)[idx] ?? "", 40)} »`;
  };

  const spec = rows.map((r) => {
    const c = cfg[r.key] ?? { anchor: r.defaultAnchor, pos: "end" };
    const block = data.blocks.find((b) => b.id === c.anchor);
    return {
      module: r.moduleId,
      label: r.label,
      insertion: r.insIndex,
      anchor: c.anchor,
      bloc: block?.heading ?? c.anchor,
      position: posLabel(c.anchor, c.pos),
      apercu_insertion: preview(r.insText, 70),
    };
  });

  const copySpec = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  if (admin === null)
    return <main className="p-10 text-sm text-slate-500">Chargement…</main>;
  if (!admin)
    return (
      <main className="p-10 text-sm text-slate-700">
        Accès réservé.{" "}
        <Link href="/admin/" className="underline">
          ← Admin
        </Link>
      </main>
    );

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-slate-900">
          Config des insertions
        </h1>
        <Link
          href="/admin/"
          className="text-sm text-slate-500 underline hover:text-slate-800"
        >
          ← Admin
        </Link>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Positionne chaque insertion (où le texte d&apos;un module vient
        s&apos;insérer dans la Constitution), puis copie la spécification et
        transmets-la-moi : je la reporte dans le code.
      </p>

      <div className="space-y-3">
        {rows.map((r) => {
          const c = cfg[r.key] ?? { anchor: r.defaultAnchor, pos: "end" };
          const paras = paragraphsOf(c.anchor);
          return (
            <div
              key={r.key}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-slate-900">{r.label}</span>
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  {r.tier}
                  {r.insIndex > 0 ? ` · insertion ${r.insIndex + 1}` : ""}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                « {preview(r.insText, 90)} »
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Bloc</span>
                  <select
                    value={c.anchor}
                    onChange={(e) => update(r.key, { anchor: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    {data.blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.heading}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Position</span>
                  <select
                    value={c.pos}
                    onChange={(e) => update(r.key, { pos: e.target.value })}
                    className="max-w-xs rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="start">Tout début du bloc</option>
                    {paras.map((p, i) => (
                      <option key={i} value={`p${i}`}>
                        Après : {preview(p, 40)}
                      </option>
                    ))}
                    <option value="end">Fin du bloc</option>
                  </select>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <button
          onClick={copySpec}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          {copied ? "Copié ✓" : "Copier la spécification"}
        </button>
        <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
          {JSON.stringify(spec, null, 2)}
        </pre>
      </div>
    </main>
  );
}
