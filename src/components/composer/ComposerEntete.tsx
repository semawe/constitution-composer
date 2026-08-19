import { type ConstitutionData } from "@/lib/constitution";
import { COMPOSER, UI, type Locale } from "@/lib/i18n";

// L'en-tête du document composé : titre éditable, identité visuelle (logo,
// police, couleur), avancement de la composition, interrupteur des notes
// d'intention, bouton d'export. Sorti de `Composer.tsx` (#1057).
//
// La mention de dérivation reste ici et vient de `i18n.ts`, pas du `meta` des
// fonds : une version sauvegardée est rendue avec le fond archivé de son époque,
// donc une mention portée par la donnée manquerait aux documents enregistrés sous
// un texte plus ancien.

type Ui = (typeof COMPOSER)["fr"];

export function ComposerEntete({
  t,
  locale,
  data,
  title,
  setTitle,
  versionLabel,
  pct,
  showIntent,
  setShowIntent,
  pdfBusy,
  onPdf,
  precharger,
  logo,
  titleColor,
  actifs,
  reduce,
  compte,
}: {
  t: Ui;
  locale: Locale;
  data: ConstitutionData;
  title: string;
  setTitle: (v: string) => void;
  versionLabel: string;
  /** Part des modules actifs, pour la jauge (0 à 1). */
  pct: number;
  showIntent: boolean;
  setShowIntent: (v: boolean) => void;
  pdfBusy: boolean;
  onPdf: () => void;
  /** Demande le moteur PDF avant qu'on en ait besoin. */
  precharger: () => void;
  logo: string;
  titleColor: string;
  /** Nombre de modules actifs, pour le décompte de la jauge. */
  actifs: number;
  /** Réglage système « animations réduites » : la jauge ne glisse pas. */
  reduce: boolean;
  compte: { connecte: boolean; nom?: string; onSignOut: () => void };
}) {
  return (
        <header className="mb-8">
          {/* La mesure du fronton. La colonne qui la borde est posée une fois en
              amont, autour du fronton et du document à la fois : `66ch` se résout
              dans la police et la taille de l'élément, et deux colonnes calculées
              séparément se centraient sur deux largeurs différentes — 559 px ici,
              586 px pour le corps, soit 27 px de décalage entre leurs bords. */}
          <div className="doc-measure doc-titre-boite border-b border-rule pb-6">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">
              {t.editionKicker}
            </p>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt="Logo de l'organisation"
                className="mb-3 mt-1 max-h-16 w-auto"
              />
            )}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label={t.titleAriaLabel}
              placeholder={data.meta.title}
              spellCheck={false}
              style={titleColor ? { color: titleColor } : undefined}
              className="doc-titre mt-1 w-full rounded-sm border-0 border-b border-transparent bg-transparent font-serif font-semibold text-strong outline-none transition placeholder:text-muted hover:border-field focus:border-field-accent"
            />
            {/* Sous-titre du document : de quoi ce texte est dérivé, et ce qu'il
                n'est pas. Il suit le titre même quand l'utilisateur renomme sa
                Constitution — c'est l'édition qui est qualifiée, pas le nom. */}
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
              {UI[locale].derivation}
            </p>
            <p className="mt-2 text-xs text-muted">{t.titleHint}</p>


            <div className="mt-5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-body">{versionLabel}</span>
                <span className="text-muted">
                  {actifs}/{data.modules.length} modules
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-slate-400 via-teal-400 to-violet-500 ${
                    reduce ? "" : "transition-[width] duration-500 ease-out"
                  }`}
                  style={{ width: `${Math.max(pct * 100, 3)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {compte.connecte ? (
                  <>
                    {compte.nom ? t.loggedIn(compte.nom) : t.activeAccount}
                    {" · "}
                    <button
                      onClick={compte.onSignOut}
                      className="underline transition hover:text-body"
                    >
                      {t.signOut}
                    </button>
                  </>
                ) : (
                  t.freeTierMsg
                )}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={showIntent}
                    onChange={(e) => setShowIntent(e.target.checked)}
                    className="h-3.5 w-3.5 accent-slate-500"
                  />
                  {t.showIntent}
                </label>
              </div>
              <button
                onClick={onPdf}
                // Le moteur PDF (~468 Ko gzip) ne descend qu'au premier export.
                // On le demande dès que la personne s'approche du bouton : au clic,
                // il est souvent déjà là, et le premier chargement de la page n'a
                // rien porté de plus.
                onPointerEnter={precharger}
                onFocus={precharger}
                disabled={pdfBusy}
                className="inline-flex items-center gap-2 rounded-full btn-ink px-4 py-2 text-sm font-medium transition disabled:opacity-60"
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
                {pdfBusy ? t.pdfGenerating : t.pdfDownload}
              </button>
            </div>
          </div>
        </header>
  );
}
