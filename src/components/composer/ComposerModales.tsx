import { type User } from "@supabase/supabase-js";
import Modale from "@/components/Modale";
import { type COMPOSER } from "@/lib/i18n";

// Les trois boîtes de dialogue du Composer : mur du compte, saisie de
// l'entreprise, réservation d'une session de découverte.
//
// Sorties de `Composer.tsx` (tâche #1057) parce qu'elles n'ont rien à voir avec
// la composition d'un document : elles ne lisent que le compte et leurs propres
// champs. Le contrat d'accessibilité (rôle, focus, Échap) vit dans `Modale`.

export interface Coach {
  name: string;
  url: string;
}

type Ui = (typeof COMPOSER)["fr"];

export function ComposerModales({
  t,
  gate,
  setGate,
  user,
  email,
  setEmail,
  otpSent,
  signInGoogle,
  signInOtp,
  needsCompany,
  setNeedsCompany,
  account,
  company,
  setCompany,
  submitCompany,
  booking,
  setBooking,
  coaches,
}: {
  t: Ui;
  gate: "pdf" | "save" | "modules" | "account" | null;
  setGate: (g: "pdf" | "save" | "modules" | "account" | null) => void;
  user: User | null;
  email: string;
  setEmail: (v: string) => void;
  otpSent: boolean;
  signInGoogle: () => void;
  signInOtp: () => void;
  needsCompany: boolean;
  setNeedsCompany: (v: boolean) => void;
  account: boolean;
  company: string;
  setCompany: (v: string) => void;
  submitCompany: () => void;
  booking: boolean;
  setBooking: (v: boolean) => void;
  coaches: Coach[];
}) {
  return (
    <>
      {/* Mur freemium : création de compte (rendu conditionnel simple) */}
      {gate && (
          <Modale onClose={() => setGate(null)} labelledBy="titre-mur-compte">
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
                <h2
                  id="titre-mur-compte"
                  className="mt-1 font-serif text-2xl font-semibold"
                >
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
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-field-strong bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
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
                      className="min-w-0 flex-1 rounded-lg border border-field-strong px-3 py-2 text-sm outline-none transition focus:border-slate-500"
                    />
                    <button
                      onClick={signInOtp}
                      disabled={!email.trim()}
                      className="shrink-0 rounded-lg btn-ink px-3 py-2 text-sm font-medium transition disabled:opacity-50"
                    >
                      {t.sendLink}
                    </button>
                  </div>
                )}
                <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-slate-400">
                  {t.accountNotice}
                </p>
              </div>
          </Modale>
        )}

      {/* Onboarding : entreprise (non fournie par Google) */}
      {needsCompany && account && (
        <Modale
          onClose={() => setNeedsCompany(false)}
          labelledBy="titre-entreprise"
          className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 shadow-2xl"
        >
            <h2
              id="titre-entreprise"
              className="font-serif text-xl font-semibold text-slate-900"
            >
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
              className="mt-1 w-full rounded-lg border border-field-strong px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-500"
            />
            <button
              onClick={submitCompany}
              disabled={!company.trim()}
              className="mt-4 w-full rounded-lg btn-ink px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
            >
              {t.continue}
            </button>
            <button
              onClick={() => setNeedsCompany(false)}
              className="mt-2 w-full rounded-lg px-4 py-2 text-xs text-slate-400 transition hover:text-slate-600"
            >
              {t.later}
            </button>
        </Modale>
      )}

      {/* Réservation coaching (pages Google Agenda) */}
      {booking && (
        <Modale onClose={() => setBooking(false)} labelledBy="titre-coaching">
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
              <h2 id="titre-coaching" className="mt-1 font-serif text-2xl font-semibold">
                {t.coachTitle}
              </h2>
              <p className="mt-2 text-sm text-white/90">
                {t.coachSubtitle}
              </p>
            </div>
            <div className="px-6 py-6">
              <div className="space-y-2">
                {coaches.map((c) => (
                  <a
                    key={c.name}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setBooking(false)}
                    className="flex items-center justify-between rounded-lg border border-field-strong px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:bg-slate-50"
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
        </Modale>
      )}
    </>
  );
}
