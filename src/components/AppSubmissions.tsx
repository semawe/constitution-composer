"use client";

import { useCallback, useEffect, useState } from "react";
import { MARKETPLACE, type Locale } from "@/lib/i18n";
import {
  createSubmission,
  listMySubmissions,
  type AppSubmission,
  type SubmissionKind,
  type SubmissionStatus,
} from "@/lib/submissions";

const STATUS_CLS: Record<SubmissionStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-slate-100 text-slate-500 ring-slate-200",
};

export default function AppSubmissions({
  signedIn,
  onRequestSignIn,
  locale = "fr",
}: {
  signedIn: boolean;
  onRequestSignIn: () => void;
  locale?: Locale;
}) {
  const t = MARKETPLACE[locale];
  const statusLabel: Record<SubmissionStatus, string> = {
    pending: t.statusPending,
    approved: t.statusApproved,
    rejected: t.statusRejected,
  };

  const [mine, setMine] = useState<AppSubmission[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SubmissionKind>("app");
  const [integrationPoint, setIntegrationPoint] = useState("");
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(() => {
    if (!signedIn) {
      setMine([]);
      return;
    }
    listMySubmissions()
      .then(setMine)
      .catch(() => setMine([]));
  }, [signedIn]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canSubmit = name.trim() && description.trim() && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(false);
    try {
      await createSubmission({
        name: name.trim(),
        kind,
        integrationPoint: integrationPoint.trim(),
        description: description.trim(),
        rationale: rationale.trim(),
      });
      setName("");
      setIntegrationPoint("");
      setDescription("");
      setRationale("");
      setKind("app");
      setDone(true);
      refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 border-t border-slate-200 pt-8">
      <h2 className="font-serif text-xl font-semibold text-slate-900">
        {t.proposeTitle}
      </h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">{t.proposeDesc}</p>

      {!signedIn ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
          <p className="text-sm text-slate-600">{t.formSignIn}</p>
          <button
            onClick={onRequestSignIn}
            className="mt-3 inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            {t.formSignInCta}
          </button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2"
        >
          <label className="text-sm sm:col-span-1">
            <span className="text-slate-600">{t.formName}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
              required
            />
          </label>
          <label className="text-sm sm:col-span-1">
            <span className="text-slate-600">{t.formKind}</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as SubmissionKind)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
            >
              <option value="app">{t.formKindApp}</option>
              <option value="extension">{t.formKindExtension}</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-600">{t.formIntegration}</span>
            <input
              value={integrationPoint}
              onChange={(e) => setIntegrationPoint(e.target.value)}
              placeholder={t.formIntegrationPlaceholder}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-600">{t.formDescription}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
              required
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-600">{t.formRationale}</span>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              {busy ? t.formSubmitting : t.formSubmit}
            </button>
            {done && !error && (
              <span className="text-sm text-emerald-700">{t.formThanks}</span>
            )}
            {error && <span className="text-sm text-rose-700">{t.formError}</span>}
          </div>
        </form>
      )}

      {mine.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">
            {t.mySubmissions}
          </h3>
          <ul className="mt-2 space-y-2">
            {mine.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.description}</p>
                  {s.admin_note && (
                    <p className="mt-1 text-xs italic text-slate-400">
                      {s.admin_note}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${STATUS_CLS[s.status]}`}
                >
                  {statusLabel[s.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
