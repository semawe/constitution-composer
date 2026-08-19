"use client";

import { useMemo } from "react";
import {
  type ConstitutionData,
  type Module,
  type RenderedItem,
  type Tier,
  compose,
  modulesForAnchor,
  toggleModule,
} from "@/lib/constitution";
import { type COMPOSER } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { isGatedTier } from "@/components/composer/pieces";

// Ce que l'écran doit savoir du document, dérivé du fond et de l'état actif —
// rien d'autre. Sorti de `Composer.tsx` (tâche #1057).
//
// Le point important : `composedFor` groupe la sortie de `compose()` par bloc, et
// c'est la seule source du document affiché. L'écran ne recalcule plus les
// insertions ni les remplacements de son côté ; c'est ce qui garantit qu'il
// raconte la même chose que le PDF, qui lit le même moteur.

type Ui = (typeof COMPOSER)["fr"];

export function useComposition({
  data,
  active,
  t,
  setActive,
  estConnecte,
  onGate,
  viser,
}: {
  data: ConstitutionData;
  active: ReadonlySet<string>;
  t: Ui;
  setActive: (s: ReadonlySet<string>) => void;
  estConnecte: () => boolean;
  /** Le mur du compte, quand la bascule demande une extension ou une app. */
  onGate: () => void;
  /** Ce vers quoi défiler pour montrer ce que la bascule vient de changer. */
  viser: (cible: { primary?: string; fallback?: string }) => void;
}) {
  const parBloc = useMemo(() => {
    const groupes = new Map<string, RenderedItem[]>();
    let courant: string | null = null;
    for (const item of compose(data, active)) {
      if (item.kind === "block") {
        courant = item.anchor;
        groupes.set(item.anchor, []);
        continue;
      }
      if (courant) groupes.get(courant)!.push(item);
    }
    return groupes;
  }, [data, active]);

  const toggle = (id: string) => {
    const mod = data.modules.find((m) => m.id === id);
    const next = toggleModule(data, active, id);
    const activating = next.size > active.size;
    // Paliers : activer une Extension ou une App requiert un compte.
    if (!estConnecte() && activating && mod && isGatedTier(mod.tier)) {
      onGate();
      track("gate", { contexte: "modules", module: id });
      return;
    }
    // Cible de défilement : on amène la modification dans le champ de vision
    // pour qu'on voie ce que la bascule vient de changer dans le texte.
    if (mod) {
      const anchor = mod.insertions[0]?.anchor;
      const section = data.blocks.find((b) => b.anchor === anchor)?.id;
      const primary = activating
        ? `ins-${id}-0` // l'insertion qui vient d'apparaître
        : mod.tier === "retirable"
          ? `reins-${id}` // le marqueur « + » de réinsertion
          : mod.fallback
            ? `fb-${id}` // la règle par défaut qui reprend la place
            : section; // sinon, la section concernée
      viser({ primary, fallback: section });
    }
    setActive(next);
  };

  const composedFor = (anchor: string) => parBloc.get(anchor) ?? [];

  const availableChips = (anchor: string) =>
    modulesForAnchor(data, anchor).filter(
      (m) => !active.has(m.id) && m.tier !== "retirable",
    );

  // Blocs retirables retirés, ancrés ici → marqueur de réinsertion dans le fil.
  const removedRetirables = (anchor: string) =>
    data.modules.filter(
      (m) =>
        m.tier === "retirable" &&
        !active.has(m.id) &&
        m.insertions.some((ins) => ins.anchor === anchor),
    );

  // Modules extension/app inactifs ancrés ici : ce que ce tier ne couvre pas.
  const inactiveAdvanced = (anchor: string) =>
    data.modules.filter(
      (m) =>
        (m.tier === "extension" || m.tier === "app") &&
        !active.has(m.id) &&
        m.insertions.some((ins) => ins.anchor === anchor),
    );

  // Modules inactifs qui portent un remplacement obligatoire = trous comblés.
  const gaps = data.modules.filter((m) => !active.has(m.id) && m.fallback);

  const tierLabel = useMemo(
    () => Object.fromEntries(data.tiers.map((x) => [x.id, x.label])),
    [data.tiers],
  );

  const modulesByTier = (tier: Tier): Module[] =>
    data.modules.filter((m) => m.tier === tier);

  const pct = data.modules.length ? active.size / data.modules.length : 0;

  // Le nom de la version composée, affiché dans l'en-tête du document.
  const retirables = data.modules.filter((m) => m.tier === "retirable");
  const removed = retirables.filter((m) => !active.has(m.id)).length;
  const addonsOn = data.modules.filter(
    (m) =>
      m.tier !== "retirable" && m.tier !== "pedagogique" && active.has(m.id),
  ).length;
  const versionLabel =
    removed === 0 && addonsOn === 0
      ? t.versionLite
      : active.size === data.modules.length
        ? t.versionFull
        : removed > 0 && addonsOn === 0
          ? t.versionReduced(removed)
          : t.versionCustom;

  return {
    toggle,
    composedFor,
    availableChips,
    removedRetirables,
    inactiveAdvanced,
    gaps,
    tierLabel,
    modulesByTier,
    pct,
    versionLabel,
  };
}
