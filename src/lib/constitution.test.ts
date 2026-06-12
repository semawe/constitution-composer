import { describe, expect, it } from "vitest";
import {
  type ConstitutionData,
  type Module,
  compose,
  defaultActive,
  modulesForAnchor,
  requiredByActive,
  toggleModule,
} from "./constitution";
import real from "../data/constitution.fr.json";

// ---------------------------------------------------------------------------
// Fixture synthétique : 3 blocs, 4 modules couvrant default / requires /
// conflicts / fallback / insertion conditionnelle.
// ---------------------------------------------------------------------------

const mod = (over: Partial<Module> & { id: string }): Module => ({
  label: over.id,
  tier: "extension",
  description: "",
  requires: [],
  conflicts: [],
  insertions: [],
  fallback: null,
  ...over,
});

const data: ConstitutionData = {
  meta: {},
  tiers: [],
  blocks: [
    { id: "b1", type: "article", anchor: "a1", tier: "core", always: true, heading: "Un", text: "T1" },
    { id: "b2", type: "article", anchor: "a2", tier: "core", always: true, heading: "Deux", text: "T2" },
    { id: "b3", type: "article", anchor: "a3", tier: "core", always: true, heading: "Trois", text: "T3" },
  ],
  modules: [
    // Bloc retirable de la Lite : coché par défaut, avec remplacement obligatoire.
    mod({
      id: "lite",
      tier: "retirable",
      default: true,
      insertions: [{ anchor: "a1", position: "after", text: "ins-lite" }],
      fallback: { anchor: "a1", text: "fb-lite" },
    }),
    // Extension qui requiert le bloc lite.
    mod({
      id: "ext",
      requires: ["lite"],
      insertions: [{ anchor: "a2", position: "after", text: "ins-ext" }],
    }),
    // Extension de second niveau : chaîne de prérequis ext -> lite.
    mod({
      id: "ext2",
      requires: ["ext"],
      insertions: [
        // Conditionnelle : ne sort que si "app" est aussi actif.
        { anchor: "a3", position: "after", text: "ins-cond", whenActive: ["app"] },
      ],
    }),
    // App en conflit avec ext.
    mod({
      id: "app",
      tier: "app",
      conflicts: ["ext"],
      insertions: [{ anchor: "a2", position: "after", text: "ins-app" }],
    }),
  ],
};

const texts = (active: Set<string>) => compose(data, active).map((i) => i.text);

describe("defaultActive", () => {
  it("active les modules default:true et eux seuls", () => {
    expect(defaultActive(data)).toEqual(new Set(["lite"]));
  });
});

describe("compose", () => {
  it("rend tous les blocs du socle, dans l'ordre", () => {
    const items = compose(data, new Set());
    const blocks = items.filter((i) => i.kind === "block");
    expect(blocks.map((b) => b.heading)).toEqual(["Un", "Deux", "Trois"]);
  });

  it("insère le texte d'un module actif à son ancre, après le bloc", () => {
    const items = compose(data, new Set(["lite"]));
    const idx = items.findIndex((i) => i.text === "ins-lite");
    expect(idx).toBeGreaterThan(-1);
    expect(items[idx - 1].key).toBe("block:b1");
    expect(items[idx].kind).toBe("insertion");
    expect(items[idx].moduleLabel).toBe("lite");
  });

  it("module inactif avec fallback : le remplacement sort, marqué warning", () => {
    const items = compose(data, new Set());
    const fb = items.find((i) => i.kind === "fallback");
    expect(fb).toBeDefined();
    expect(fb!.text).toBe("fb-lite");
    expect(fb!.warning).toBe(true);
    expect(texts(new Set())).not.toContain("ins-lite");
  });

  it("module actif avec fallback : pas de remplacement", () => {
    const items = compose(data, new Set(["lite"]));
    expect(items.some((i) => i.kind === "fallback")).toBe(false);
  });

  it("insertion conditionnelle : absente tant que whenActive n'est pas satisfait", () => {
    expect(texts(new Set(["lite", "ext", "ext2"]))).not.toContain("ins-cond");
    expect(texts(new Set(["lite", "ext", "ext2", "app"]))).toContain("ins-cond");
  });
});

describe("toggleModule", () => {
  it("activer ajoute les prérequis, en chaîne", () => {
    const next = toggleModule(data, new Set(), "ext2");
    expect(next).toEqual(new Set(["ext2", "ext", "lite"]));
  });

  it("activer désactive les modules en conflit", () => {
    const next = toggleModule(data, new Set(["lite", "ext"]), "app");
    expect(next.has("app")).toBe(true);
    expect(next.has("ext")).toBe(false);
  });

  it("désactiver retire en cascade les modules dépendants", () => {
    const next = toggleModule(data, new Set(["lite", "ext", "ext2"]), "lite");
    expect(next).toEqual(new Set());
  });

  it("activer puis désactiver un module isolé revient à l'état initial", () => {
    const on = toggleModule(data, new Set(["lite"]), "ext");
    const off = toggleModule(data, on, "ext");
    expect(off).toEqual(new Set(["lite"]));
  });
});

describe("requiredByActive / modulesForAnchor", () => {
  it("signale les modules actifs qui verrouillent un prérequis", () => {
    const locks = requiredByActive(data, new Set(["lite", "ext"]), "lite");
    expect(locks.map((m) => m.id)).toEqual(["ext"]);
    expect(requiredByActive(data, new Set(["lite"]), "lite")).toEqual([]);
  });

  it("liste les modules qui s'ancrent sur un bloc", () => {
    expect(modulesForAnchor(data, "a2").map((m) => m.id)).toEqual(["ext", "app"]);
  });
});

// ---------------------------------------------------------------------------
// Intégrité du JSON réel : toute référence pointe vers quelque chose qui existe.
// ---------------------------------------------------------------------------

describe("constitution.fr.json — intégrité", () => {
  const d = real as unknown as ConstitutionData;
  const moduleIds = new Set(d.modules.map((m) => m.id));
  const anchors = new Set(d.blocks.map((b) => b.anchor));

  it("requires et conflicts référencent des modules existants", () => {
    for (const m of d.modules) {
      for (const r of m.requires) expect(moduleIds, `${m.id} requiert ${r}`).toContain(r);
      for (const c of m.conflicts) expect(moduleIds, `${m.id} conflit ${c}`).toContain(c);
    }
  });

  it("insertions, fallbacks et whenActive pointent vers des ancres/modules existants", () => {
    for (const m of d.modules) {
      for (const ins of m.insertions) {
        expect(anchors, `${m.id} ancre ${ins.anchor}`).toContain(ins.anchor);
        for (const w of ins.whenActive ?? [])
          expect(moduleIds, `${m.id} whenActive ${w}`).toContain(w);
      }
      if (m.fallback)
        expect(anchors, `${m.id} fallback ${m.fallback.anchor}`).toContain(m.fallback.anchor);
    }
  });

  it("compose(defaultActive) produit un document complet sans erreur", () => {
    const items = compose(d, defaultActive(d));
    expect(items.length).toBeGreaterThanOrEqual(d.blocks.length);
    // Aucun fallback ne doit sortir pour un module coché par défaut.
    for (const i of items.filter((x) => x.kind === "fallback")) {
      const owner = d.modules.find((m) => m.label === i.moduleLabel);
      expect(owner?.default ?? false).toBe(false);
    }
  });

  it("chaque module activé un à un compose sans jeter", () => {
    for (const m of d.modules) {
      const active = toggleModule(d, defaultActive(d), m.id);
      expect(() => compose(d, active)).not.toThrow();
    }
  });
});
