import { type COMPOSER } from "@/lib/i18n";
import { type Connexion } from "@/components/compte/useConnexion";

// Les deux voies de connexion, telles qu'elles s'affichent dans une boîte de
// dialogue : Google, ou un lien reçu par e-mail. Partagé par le mur du Composer
// et celui de la Déclaration, pour que l'un ne dise pas « envoyé » quand l'autre
// dit « refusé ».

type Ui = (typeof COMPOSER)["fr"];

export function ConnexionChoix({
  t,
  connexion,
}: {
  t: Ui;
  connexion: Connexion;
}) {
  const {
    email,
    setEmail,
    envoi,
    googleEchec,
    infolettre,
    setInfolettre,
    signInGoogle,
    signInOtp,
  } = connexion;
  return (
    <>
      <button
        onClick={signInGoogle}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-field bg-surface px-4 py-2.5 text-sm font-medium text-body shadow-sm transition hover:bg-surface-subtle"
      >
        <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        {t.continueGoogle}
      </button>
      {googleEchec && (
        <p role="alert" className="mt-2 text-xs text-danger-text">
          {t.googleFailed}
        </p>
      )}
      <div className="my-3 flex items-center gap-3 text-[0.7rem] uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-surface-strong" />
        {t.orByEmail}
        <span className="h-px flex-1 bg-surface-strong" />
      </div>
      {envoi === "envoye" ? (
        <p
          role="status"
          className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-teal-800"
        >
          {t.emailSent}
        </p>
      ) : (
        <>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              signInOtp();
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              aria-label={t.emailLabel}
              autoComplete="email"
              className="min-w-0 flex-1 rounded-lg border border-field px-3 py-2 text-sm outline-none transition focus:border-field-accent"
            />
            <button
              type="submit"
              disabled={!email.trim() || envoi === "encours"}
              className="shrink-0 rounded-lg btn-ink px-3 py-2 text-sm font-medium transition disabled:opacity-50"
            >
              {envoi === "encours" ? t.emailSending : t.sendLink}
            </button>
          </form>
          {envoi === "echec" && (
            <p role="alert" className="mt-2 text-xs text-danger-text">
              {t.emailFailed}
            </p>
          )}
        </>
      )}
      {envoi !== "envoye" && (
        <label className="mt-3 flex items-start gap-2 text-xs leading-snug text-muted">
          <input
            type="checkbox"
            checked={infolettre}
            onChange={(e) => setInfolettre(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
          />
          <span>{t.newsOptIn}</span>
        </label>
      )}
    </>
  );
}
