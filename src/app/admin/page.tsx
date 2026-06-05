"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin";
import type { User } from "@supabase/supabase-js";

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  company: string | null;
  created_at: string;
}
interface CompositionRow {
  id: string;
  user_id: string;
  name: string;
  payload: { title?: string; active?: string[] } | null;
  updated_at: string;
}

type State =
  | { kind: "loading" }
  | { kind: "unconfigured" }
  | { kind: "denied" }
  | { kind: "ready"; profiles: ProfileRow[]; comps: CompositionRow[] };

function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

export default function AdminPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setState({ kind: "unconfigured" });
      return;
    }
    (async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();
      const user: User | null = session?.user ?? null;
      if (!user || !isAdminEmail(user.email)) {
        setState({ kind: "denied" });
        return;
      }
      const [p, c] = await Promise.all([
        sb
          .from("profiles")
          .select("id,email,full_name,company,created_at")
          .order("created_at", { ascending: false }),
        sb
          .from("compositions")
          .select("id,user_id,name,payload,updated_at")
          .order("updated_at", { ascending: false }),
      ]);
      setState({
        kind: "ready",
        profiles: (p.data ?? []) as ProfileRow[],
        comps: (c.data ?? []) as CompositionRow[],
      });
    })();
  }, []);

  const compsByUser = useMemo(() => {
    if (state.kind !== "ready") return new Map<string, CompositionRow[]>();
    const m = new Map<string, CompositionRow[]>();
    for (const c of state.comps) {
      const arr = m.get(c.user_id) ?? [];
      arr.push(c);
      m.set(c.user_id, arr);
    }
    return m;
  }, [state]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-slate-900">
          Admin — leads &amp; compositions
        </h1>
        <Link
          href="/"
          className="text-sm text-slate-500 underline transition hover:text-slate-800"
        >
          ← Retour au composeur
        </Link>
      </div>

      {state.kind === "loading" && (
        <p className="text-sm text-slate-500">Chargement…</p>
      )}

      {state.kind === "unconfigured" && (
        <p className="text-sm text-amber-700">
          Supabase n&apos;est pas configuré sur cet environnement : aucune donnée
          à afficher.
        </p>
      )}

      {state.kind === "denied" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm text-slate-700">
            Accès réservé. Connectez-vous depuis le composeur avec un compte
            associé pour consulter cet écran.
          </p>
        </div>
      )}

      {state.kind === "ready" && (
        <>
          <p className="mb-4 text-sm text-slate-500">
            {state.profiles.length} compte{state.profiles.length > 1 ? "s" : ""}{" "}
            · {state.comps.length} composition
            {state.comps.length > 1 ? "s" : ""} sauvegardée
            {state.comps.length > 1 ? "s" : ""}
          </p>
          {state.profiles.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun lead pour l&apos;instant.</p>
          ) : (
            <div className="space-y-3">
              {state.profiles.map((p) => {
                const comps = compsByUser.get(p.id) ?? [];
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {p.full_name || "—"}
                      </span>
                      <span className="text-xs text-slate-400">
                        inscrit le {fmtDate(p.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      {p.email || "—"}
                      {p.company ? ` · ${p.company}` : ""}
                    </p>
                    {comps.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                        {comps.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-baseline justify-between text-sm"
                          >
                            <span className="text-slate-700">
                              {c.name || c.payload?.title || "Sans titre"}
                            </span>
                            <span className="text-xs text-slate-400">
                              {c.payload?.active?.length ?? 0} blocs ·{" "}
                              {fmtDate(c.updated_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}
