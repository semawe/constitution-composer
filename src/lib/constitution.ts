// Moteur de composition. Consomme le modèle de données du fond
// (source de vérité : holacracy-constitution/composer/SCHEMA.md).

export type Tier = "core" | "integral" | "extension" | "app";

export interface TierDef {
  id: Tier;
  label: string;
  hint: string;
}

export interface Block {
  id: string;
  type: "preamble" | "article" | "section";
  anchor: string;
  tier: Tier;
  always: boolean;
  heading: string;
  intent?: string;
  text: string;
}

export interface Insertion {
  anchor: string;
  position: string;
  text: string;
  /** Insertion conditionnelle : incluse seulement si TOUS ces modules sont actifs. */
  whenActive?: string[];
}

export interface Fallback {
  anchor: string;
  text: string;
}

export interface Module {
  id: string;
  label: string;
  tier: Tier;
  description: string;
  requires: string[];
  conflicts: string[];
  insertions: Insertion[];
  fallback: Fallback | null;
}

export interface ConstitutionData {
  meta: Record<string, string>;
  tiers: TierDef[];
  blocks: Block[];
  modules: Module[];
}

/** Type visuel d'un élément rendu — `warning` = insertion obligatoire de remplacement. */
export type RenderKind = "block" | "insertion" | "fallback";

export interface RenderedItem {
  key: string;
  kind: RenderKind;
  tier: Tier;
  warning: boolean;
  anchor: string;
  heading?: string;
  intent?: string;
  text: string;
  moduleLabel?: string;
}

/**
 * Compose le document : socle dans l'ordre, puis pour chaque ancre,
 * les insertions des modules actifs, puis les remplacements obligatoires
 * des modules inactifs qui en portent un.
 */
export function compose(
  data: ConstitutionData,
  active: ReadonlySet<string>,
): RenderedItem[] {
  const items: RenderedItem[] = [];

  for (const block of data.blocks) {
    items.push({
      key: `block:${block.id}`,
      kind: "block",
      tier: block.tier,
      warning: false,
      anchor: block.anchor,
      heading: block.heading,
      intent: block.intent,
      text: block.text,
    });

    // Insertions des modules actifs ancrées sur ce bloc.
    for (const mod of data.modules) {
      if (!active.has(mod.id)) continue;
      mod.insertions.forEach((ins, i) => {
        if (ins.anchor !== block.anchor) return;
        // Insertion conditionnelle : tous les modules requis doivent être actifs.
        if (ins.whenActive && !ins.whenActive.every((id) => active.has(id)))
          return;
        items.push({
          key: `ins:${mod.id}:${i}`,
          kind: "insertion",
          tier: mod.tier,
          warning: false,
          anchor: ins.anchor,
          text: ins.text,
          moduleLabel: mod.label,
        });
      });
    }

    // Remplacements obligatoires des modules inactifs.
    for (const mod of data.modules) {
      if (active.has(mod.id)) continue;
      if (!mod.fallback || mod.fallback.anchor !== block.anchor) continue;
      items.push({
        key: `fb:${mod.id}`,
        kind: "fallback",
        tier: mod.tier,
        warning: true,
        anchor: mod.fallback.anchor,
        text: mod.fallback.text,
        moduleLabel: mod.label,
      });
    }
  }

  return items;
}

/** Modules actifs qui requièrent `id` (→ `id` est verrouillé tant qu'ils le sont). */
export function requiredByActive(
  data: ConstitutionData,
  active: ReadonlySet<string>,
  id: string,
): Module[] {
  return data.modules.filter(
    (m) => active.has(m.id) && m.requires.includes(id),
  );
}

/** Modules dont une insertion s'ancre sur ce bloc (pour les "+" inline). */
export function modulesForAnchor(
  data: ConstitutionData,
  anchor: string,
): Module[] {
  return data.modules.filter((m) =>
    m.insertions.some((ins) => ins.anchor === anchor),
  );
}

/**
 * Applique une bascule en respectant requires/conflicts.
 * Activer → ajoute les prérequis. Désactiver → retire les modules qui en dépendent.
 */
export function toggleModule(
  data: ConstitutionData,
  active: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(active);
  const byId = new Map(data.modules.map((m) => [m.id, m]));

  if (next.has(id)) {
    next.delete(id);
    // Retirer les modules qui requièrent celui-ci.
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of data.modules) {
        if (next.has(m.id) && m.requires.some((r) => !next.has(r))) {
          next.delete(m.id);
          changed = true;
        }
      }
    }
  } else {
    next.add(id);
    // Ajouter les prérequis.
    const stack = [id];
    while (stack.length) {
      const cur = byId.get(stack.pop()!);
      cur?.requires.forEach((r) => {
        if (!next.has(r)) {
          next.add(r);
          stack.push(r);
        }
      });
    }
    // Désactiver les conflits.
    const cur = byId.get(id);
    cur?.conflicts.forEach((c) => next.delete(c));
  }

  return next;
}
