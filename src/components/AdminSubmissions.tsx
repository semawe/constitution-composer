"use client";

import { useEffect, useState } from "react";
import {
  listAllSubmissions,
  reviewSubmission,
  type AppSubmission,
  type SubmissionStatus,
} from "@/lib/submissions";

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
};
const STATUS_CLS: Record<SubmissionStatus, string> = {
  pending: "bg-warning-soft text-warning-text ring-warning-border",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-surface-muted text-muted ring-rule",
};

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

export default function AdminSubmissions() {
  const [rows, setRows] = useState<AppSubmission[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () =>
    listAllSubmissions()
      .then(setRows)
      .catch(() => setRows([]));

  useEffect(() => {
    refresh();
  }, []);

  const review = async (id: string, status: SubmissionStatus) => {
    setBusy(id);
    try {
      await reviewSubmission(id, status, notes[id] ?? "");
      refresh();
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) return null;

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <section className="mb-8">
      <h2 className="mb-1 font-serif text-lg font-semibold text-strong">
        Propositions d&apos;apps
      </h2>
      <p className="mb-3 text-sm text-muted">
        {rows.length} soumission{rows.length > 1 ? "s" : ""} · {pending} en
        attente
      </p>
      <div className="space-y-3">
        {rows.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-rule bg-surface p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-strong">
                {s.name}{" "}
                <span className="text-xs font-normal text-muted">
                  ({s.kind === "extension" ? "extension" : "app"})
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${STATUS_CLS[s.status]}`}
              >
                {STATUS_LABEL[s.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-body">{s.description}</p>
            {s.integration_point && (
              <p className="mt-1 text-xs text-muted">
                Intégration : {s.integration_point}
              </p>
            )}
            {s.rationale && (
              <p className="mt-1 text-xs italic text-muted">
                {s.rationale}
              </p>
            )}
            <p className="mt-1 text-xs text-muted">
              soumise le {fmtDate(s.created_at)}
              {s.reviewed_at ? ` · traitée le ${fmtDate(s.reviewed_at)}` : ""}
            </p>
            {s.admin_note && (
              <p className="mt-1 text-xs text-muted">
                Note : {s.admin_note}
              </p>
            )}
            {s.status === "pending" && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule-soft pt-3">
                <input
                  value={notes[s.id] ?? ""}
                  onChange={(e) =>
                    setNotes((n) => ({ ...n, [s.id]: e.target.value }))
                  }
                  placeholder="Note (optionnelle)"
                  className="flex-1 rounded-lg border border-field px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:border-field-accent"
                />
                <button
                  onClick={() => review(s.id, "approved")}
                  disabled={busy === s.id}
                  className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  Approuver
                </button>
                <button
                  onClick={() => review(s.id, "rejected")}
                  disabled={busy === s.id}
                  className="rounded-full border border-field px-4 py-1.5 text-sm font-medium text-body transition hover:border-field-accent disabled:opacity-40"
                >
                  Refuser
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
