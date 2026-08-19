import { type ChangeEvent } from "react";
import { type ConstitutionData } from "@/lib/constitution";
import { FONT_OPTIONS } from "@/lib/branding";
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
  onLogoChange,
  font,
  setFont,
  titleColor,
  setTitleColor,
  setLogo,
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
  onLogoChange: (e: ChangeEvent<HTMLInputElement>) => void;
  font: string;
  setFont: (v: string) => void;
  titleColor: string;
  setTitleColor: (v: string) => void;
  setLogo: (v: string) => void;
  /** Nombre de modules actifs, pour le décompte de la jauge. */
  actifs: number;
  /** Réglage système « animations réduites » : la jauge ne glisse pas. */
  reduce: boolean;
  compte: { connecte: boolean; nom?: string; onSignOut: () => void };
}) {
  return (
        <header className="doc-measure mx-auto mb-8 border-b border-slate-200 pb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
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
            className="mt-1 w-full rounded-sm border-0 border-b border-transparent bg-transparent font-serif text-xl font-semibold text-slate-900 outline-none transition placeholder:text-slate-300 hover:border-slate-200 focus:border-slate-400 sm:text-4xl"
          />
          {/* Sous-titre du document : de quoi ce texte est dérivé, et ce qu'il
              n'est pas. Il suit le titre même quand l'utilisateur renomme sa
              Constitution — c'est l'édition qui est qualifiée, pas le nom. */}
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-500">
            {UI[locale].derivation}
          </p>
          <p className="mt-2 text-xs text-slate-400">{t.titleHint}</p>

          {/* Identité visuelle en volet. L'en-tête empilait cinq registres en
              cent pixels : surtitre, titre éditable, ligne de dérivation, puis
              police / logo / couleur en onze pixels, puis l'avancement, la case
              des notes et l'export. Les réglages d'atelier n'appartiennent pas
              au fronton du document — on y touche une fois, au début, et le
              document se lit ensuite. Repliés, ils cessent de disputer
              l'attention au titre ; le volet dit ce qu'il contient et où ça
              s'applique. */}
          <details className="group/id mt-3">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400 transition hover:text-slate-600">
              {t.identity}
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3 transition group-open/id:rotate-90"
                fill="none"
                aria-hidden
              >
                <path
                  d="M6 3.5L10.5 8L6 12.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </summary>
            <p className="mt-2 text-xs text-slate-400">{t.identityHint}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              {t.fontLabel}
              <select
                value={font}
                onChange={(e) => setFont(e.target.value)}
                aria-label="Police du document"
                className="rounded border border-slate-200 bg-transparent px-1.5 py-0.5 outline-none focus:border-slate-400"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </span>
            <span className="flex items-center gap-1.5">
              Logo
              <label className="cursor-pointer underline transition hover:text-slate-600">
                {logo ? t.logoChange : t.logoAdd}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onLogoChange}
                  className="hidden"
                />
              </label>
              {logo && (
                <button
                  onClick={() => setLogo("")}
                  className="underline transition hover:text-slate-600"
                >
                  {t.logoRemove}
                </button>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              {t.colorLabel}
              <input
                type="color"
                value={titleColor || "#0f172a"}
                onChange={(e) => setTitleColor(e.target.value)}
                aria-label="Couleur du titre"
                className="h-5 w-6 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
              />
              <input
                type="text"
                value={titleColor}
                onChange={(e) => setTitleColor(e.target.value)}
                placeholder="#0f172a"
                spellCheck={false}
                className="w-20 rounded border border-slate-200 bg-transparent px-1.5 py-0.5 font-mono outline-none focus:border-slate-400"
              />
              {titleColor && (
                <button
                  onClick={() => setTitleColor("")}
                  className="underline transition hover:text-slate-600"
                >
                  {t.colorReset}
                </button>
              )}
            </span>
            </div>
          </details>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">{versionLabel}</span>
              <span className="text-slate-400">
                {actifs}/{data.modules.length} modules
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-slate-400 via-teal-400 to-violet-500 ${
                  reduce ? "" : "transition-[width] duration-500 ease-out"
                }`}
                style={{ width: `${Math.max(pct * 100, 3)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              {compte.connecte ? (
                <>
                  {compte.nom ? t.loggedIn(compte.nom) : t.activeAccount}
                  {" · "}
                  <button
                    onClick={compte.onSignOut}
                    className="underline transition hover:text-slate-600"
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
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-500">
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
        </header>
  );
}
