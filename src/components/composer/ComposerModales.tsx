import type { Compte } from "@/lib/service";
import Modale from "@/components/Modale";
import { ConnexionChoix } from "@/components/compte/ConnexionChoix";
import { type Connexion } from "@/components/compte/useConnexion";
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
  connexion,
  needsCompany,
  setNeedsCompany,
  account,
  company,
  setCompany,
  companyEchec,
  submitCompany,
  booking,
  setBooking,
  coaches,
}: {
  t: Ui;
  gate: "pdf" | "save" | "modules" | "account" | null;
  setGate: (g: "pdf" | "save" | "modules" | "account" | null) => void;
  user: Compte | null;
  connexion: Connexion;
  needsCompany: boolean;
  setNeedsCompany: (v: boolean) => void;
  account: boolean;
  company: string;
  setCompany: (v: string) => void;
  /** L'organisation n'a pas pu être enregistrée : la boîte reste et le dit. */
  companyEchec: boolean;
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
                className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition hover:bg-surface/20 hover:text-white"
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
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-accent-border bg-accent-soft p-3">
                  <span className="text-xl leading-none">🎁</span>
                  <p className="text-sm text-accent-strong">
                    <strong>{t.coachOffer}</strong> {t.coachOfferDetail}
                    <span className="mt-0.5 block text-xs text-accent-text">
                      {t.coachOfferSub}
                    </span>
                  </p>
                </div>
                <ConnexionChoix t={t} connexion={connexion} />
                <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-muted">
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
          className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface p-6 shadow-2xl"
        >
            <h2
              id="titre-entreprise"
              className="font-serif text-xl font-semibold text-strong"
            >
              {t.welcome}
              {user?.prenom
                ? `, ${user.prenom}`
                : ""}{" "}
              !
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t.lastStep}
            </p>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-muted">
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
              className="mt-1 w-full rounded-lg border border-field px-3 py-2 text-sm text-body outline-none transition focus:border-field-accent"
            />
            <button
              onClick={submitCompany}
              disabled={!company.trim()}
              className="mt-4 w-full rounded-lg btn-ink px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
            >
              {t.continue}
            </button>
            {companyEchec && (
              <p role="alert" className="mt-2 text-xs text-danger-text">
                {t.companyFailed}
              </p>
            )}
            <button
              onClick={() => setNeedsCompany(false)}
              className="mt-2 w-full rounded-lg px-4 py-2 text-xs text-muted transition hover:text-body"
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
              className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition hover:bg-surface/20 hover:text-white"
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
                    className="flex items-center justify-between rounded-lg border border-field px-4 py-3 text-sm font-medium text-body transition hover:border-field-accent hover:bg-surface-subtle"
                  >
                    <span>{t.bookWith(c.name)}</span>
                    <span aria-hidden>→</span>
                  </a>
                ))}
              </div>
              <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-muted">
                {t.coachingPricing}
              </p>
            </div>
        </Modale>
      )}
    </>
  );
}
