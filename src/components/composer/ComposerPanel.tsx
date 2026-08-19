import {
  type ConstitutionData,
  type Module,
  type Tier,
  defaultActive,
  normalizeActive,
  requiredByActive,
} from "@/lib/constitution";
import { type ChangeEvent } from "react";
import { type COMPOSER } from "@/lib/i18n";
import { MAX_COMPOSITIONS, type SavedComposition } from "@/lib/compositions";
import { ComposerIdentite } from "@/components/composer/ComposerIdentite";
import {
  Legend,
  ModuleToggle,
  TIER_UI,
  isGatedTier,
} from "@/components/composer/pieces";

// L'atelier du Composer : identité visuelle, modules par tier, versions
// enregistrées. Sorti de `Composer.tsx` (tâche #1057), redécoupé ensuite.
//
// Il ne compose rien : il pilote. Tout ce qu'il affiche vient de ses propriétés,
// groupées par sujet pour qu'on voie d'un coup d'œil ce qu'il lit du document, des
// versions et du compte.
//
// Le sommaire l'a quitté pour la marge du texte (`ComposerSommaire`) : il ouvrait
// la marche, six lignes avant la première commande, et ses 182 px étaient
// l'essentiel du débordement qui obligeait le rail à sa propre barre de
// défilement. Replier les tiers avait fait la moitié du chemin ; ce départ fait
// l'autre. Un repère de lecture n'est pas une commande d'atelier.
//
// L'identité visuelle l'a rejoint, venue du fronton du document, qui n'a à porter
// que ce dont le document est fait. Elle ouvre le rail parce qu'on y touche une
// fois — et reste repliée pour la même raison.

type Ui = (typeof COMPOSER)["fr"];

export interface PanelDoc {
  active: ReadonlySet<string>;
  toggle: (id: string) => void;
  setActive: (s: ReadonlySet<string>) => void;
  gaps: Module[];
  tierLabel: Record<string, string>;
  modulesByTier: (tier: Tier) => Module[];
}

export interface PanelIdentite {
  logo: string;
  onLogoChange: (e: ChangeEvent<HTMLInputElement>) => void;
  setLogo: (v: string) => void;
  font: string;
  setFont: (v: string) => void;
  titleColor: string;
  setTitleColor: (v: string) => void;
}

export interface PanelVersions {
  liste: SavedComposition[];
  message: string | null;
  illisible: boolean;
  occupe: boolean;
  pdfEnEchec: boolean;
  releaseMsg: string | null;
  aFiger: SavedComposition | null;
  aRejouer: SavedComposition | null;
  onSave: () => void;
  onLoad: (v: SavedComposition) => void;
  onRename: (v: SavedComposition) => void;
  onDelete: (v: SavedComposition) => void;
  onPin: (v: SavedComposition) => void;
  onMigrate: (v: SavedComposition) => void;
}

export function ComposerPanel({
  data,
  t,
  doc,
  versions,
  compte,
  identite,
}: {
  data: ConstitutionData;
  t: Ui;
  doc: PanelDoc;
  versions: PanelVersions;
  compte: { account: boolean; onGate: (g: "modules" | "save") => void };
  identite: PanelIdentite;
}) {
  const { active, toggle, setActive, gaps, tierLabel, modulesByTier } = doc;
  const { account } = compte;
  const setGate = compte.onGate;
  const versionMsg = versions.message;
  const versionsUnread = versions.illisible;
  const versionBusy = versions.occupe;
  const pdfError = versions.pdfEnEchec;
  const releaseMsg = versions.releaseMsg;
  const aFiger = versions.aFiger;
  const aRejouer = versions.aRejouer;
  const handleSaveVersion = versions.onSave;
  const handleLoadVersion = versions.onLoad;
  const handleRenameVersion = versions.onRename;
  const handleDeleteVersion = versions.onDelete;
  const handlePinVersion = versions.onPin;
  const handleMigrateVersion = versions.onMigrate;

  // L'état de départ du composer, pour savoir de quels tiers l'utilisateur s'est
  // déjà occupé (cf. l'ouverture automatique des volets plus bas).
  const parDefaut = defaultActive(data);

  // Lite = blocs retirables cochés ; au-delà = modules additifs. Ce décompte
  // n'existe que pour cette ligne du panneau : il vit donc ici.
  const retirableMods = data.modules.filter((m) => m.tier === "retirable");
  const removed = retirableMods.filter((m) => !active.has(m.id)).length;
  const addonsOn = data.modules.filter(
    (m) =>
      m.tier !== "retirable" && m.tier !== "pedagogique" && active.has(m.id),
  ).length;
  const countLabel =
    removed === 0 && addonsOn === 0
      ? t.liteFull
      : removed > 0 && addonsOn === 0
        ? t.blocksRetirable(retirableMods.length - removed, retirableMods.length)
        : t.blocksWithAddons(
            retirableMods.length - removed,
            retirableMods.length,
            addonsOn,
          );

  return (
    <div className="thin-scroll max-h-[calc(100vh-4rem)] overflow-y-auto pr-2">
      {/* Identité visuelle en volet, dans le même dessin que les tiers plus bas :
          l'atelier a une seule grammaire de repli. */}
      <details className="group/id">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded py-0.5">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t.identity}
          </span>
          <svg
            viewBox="0 0 16 16"
            className="ml-auto h-3 w-3 shrink-0 text-slate-400 transition group-open/id:rotate-90"
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
        <div className="mt-2">
          <ComposerIdentite
            t={t}
            logo={identite.logo}
            onLogoChange={identite.onLogoChange}
            setLogo={identite.setLogo}
            font={identite.font}
            setFont={identite.setFont}
            titleColor={identite.titleColor}
            setTitleColor={identite.setTitleColor}
          />
        </div>
      </details>

      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {t.composerLabel}
      </h2>
      <p className="mt-1 text-sm text-slate-500">{countLabel}</p>
      {gaps.length > 0 && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
          <span className="mt-px">⚠</span>
          <span>{t.gapWarning(gaps.length)}</span>
        </p>
      )}

      {/* `flex-wrap` et `whitespace-nowrap` : le rail s'est resserré pour laisser
          sa colonne au sommaire, et les libellés se coupaient en deux au milieu
          (« Tout / activer »). La rangée passe à la ligne entre les boutons, pas
          dedans. */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => {
            if (!account && data.modules.some((m) => isGatedTier(m.tier))) {
              setGate("modules");
              return;
            }
            setActive(normalizeActive(data, data.modules.map((m) => m.id)));
          }}
          className="whitespace-nowrap rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
        >
          {t.activateAll}
        </button>
        <button
          onClick={() => setActive(defaultActive(data))}
          className="whitespace-nowrap rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
          title={t.baseLiteTitle}
        >
          {t.baseLite}
        </button>
        <button
          onClick={() => setActive(new Set())}
          className="whitespace-nowrap rounded-full border border-slate-300 px-3 py-1 text-slate-600 transition hover:border-slate-500 hover:text-slate-900"
          title={t.coreOnlyTitle}
        >
          {t.coreOnly}
        </button>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t.myVersions}
          </h2>
          <span className="text-xs text-slate-400">
            {versions.liste.length}/{MAX_COMPOSITIONS}
          </span>
        </div>
        <button
          onClick={handleSaveVersion}
          disabled={versionBusy}
          className="mt-2 w-full rounded-full btn-ink px-3 py-1.5 text-xs font-medium transition disabled:opacity-60"
        >
          {versionBusy ? t.saving : t.saveVersion}
        </button>
        {/* De quel texte vient ce qu'on regarde. Muet quand la version est
            figée sur le texte courant : il n'y a rien à signaler. */}
        {releaseMsg && (
          <div
            role="status"
            className="mt-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900"
          >
            <p>{releaseMsg}</p>
            {aFiger && (
              <button
                onClick={() => handlePinVersion(aFiger)}
                className="mt-1.5 rounded-full bg-amber-900 px-2.5 py-1 text-[0.7rem] font-medium text-white transition hover:bg-amber-800"
              >
                {t.releasePinAction}
              </button>
            )}
            {aRejouer && (
              <button
                onClick={() => handleMigrateVersion(aRejouer)}
                className="mt-1.5 rounded-full bg-amber-900 px-2.5 py-1 text-[0.7rem] font-medium text-white transition hover:bg-amber-800"
              >
                {t.releaseMigrateAction}
              </button>
            )}
          </div>
        )}
        {versionsUnread && (
          <p role="alert" className="mt-1.5 text-xs text-rose-700">
            {t.versionsFailed}
          </p>
        )}
        {pdfError && (
          <p role="alert" className="mt-1.5 text-xs text-rose-700">
            {t.pdfFailed}
          </p>
        )}
        {versionMsg && (
          <p className="mt-1.5 text-xs text-slate-500">{versionMsg}</p>
        )}
        {!account && (
          <p className="mt-1.5 text-xs text-slate-400">
            {t.loginToSave}
          </p>
        )}
        {versions.liste.length > 0 && (
          <ul className="mt-2 space-y-1">
            {versions.liste.map((v) => (
              <li
                key={v.id}
                className="group flex items-center gap-1 rounded-md px-1.5 py-1 text-sm hover:bg-slate-100"
              >
                <button
                  onClick={() => handleLoadVersion(v)}
                  title={t.loadTitle}
                  className="min-w-0 flex-1 truncate text-left"
                >
                  <span className="block truncate text-slate-700">
                    {v.name || t.untitled}
                  </span>
                  <span className="block text-[0.7rem] text-slate-400">
                    {new Date(v.updated_at).toLocaleDateString(t.dateLocale, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </button>
                <button
                  onClick={() => handleRenameVersion(v)}
                  aria-label={t.rename}
                  title={t.rename}
                  className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition hover:text-slate-700 group-hover:opacity-100"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteVersion(v)}
                  aria-label={t.delete}
                  title={t.delete}
                  className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Les tiers en volets. Le rail présentait ses sept sections d'un bloc :
          quarante-trois lignes interactives sur plus de mille pixels, avec sa
          propre barre de défilement et la légende sous le pli. Tout y avait le
          même poids, alors que les blocs retirables sont le travail courant et
          que les trois autres tiers sont des ajouts qu'on va chercher.

          `<details>` et non un état React : le volet s'ouvre sans JavaScript, se
          pilote au clavier sans qu'on ait rien à écrire, et survit à un rendu
          serveur — la leçon de la matinée sur ce qui dépend de l'hydratation.

          Un tier s'ouvre de lui-même dès qu'on y a touché, c'est-à-dire dès que
          son état s'écarte du défaut : sans ça, activer une extension puis
          recharger la page la laissait active derrière un volet fermé, donc
          invisible. La règle porte sur l'écart et non sur « au moins un module
          actif », qui ne repliait jamais la piste pédagogique — ses cinq modules
          sont cochés par défaut, et le volet se rouvrait tout seul. */}
      {(["retirable", "pedagogique", "extension", "app"] as Tier[]).map((tier) => {
        const mods = modulesByTier(tier);
        if (mods.length === 0) return null;
        const actifs = mods.filter((m) => active.has(m.id)).length;
        const touche = mods.some((m) => active.has(m.id) !== parDefaut.has(m.id));
        return (
          <details
            key={tier}
            open={tier === "retirable" || touche}
            className="group/tier mt-6"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded py-0.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${TIER_UI[tier].dot}`} />
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {tierLabel[tier]}
              </span>
              <span className="ml-auto text-[0.7rem] tabular-nums text-slate-400">
                {actifs}/{mods.length}
              </span>
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3 shrink-0 text-slate-400 transition group-open/tier:rotate-90"
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
            <ul className="mt-2 space-y-1.5">
              {mods.map((m) => (
                <ModuleToggle
                  key={m.id}
                  mod={m}
                  on={active.has(m.id)}
                  premium={!account && isGatedTier(m.tier)}
                  lockedBy={requiredByActive(data, active, m.id).map(
                    (x) => x.label,
                  )}
                  requires={m.requires.flatMap((r) => {
                    const dep = data.modules.find((d) => d.id === r);
                    return dep ? [dep.label] : [];
                  })}
                  onToggle={() => toggle(m.id)}
                />
              ))}
            </ul>
          </details>
        );
      })}

      <Legend tierLabel={tierLabel} ui={t} />
    </div>
  );
}
