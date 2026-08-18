import { describe, expect, it } from "vitest";
import { normalizeDeclaration } from "./declaration";
import principesFr from "../data/principes.fr.json";

const BUILTIN = principesFr.principles.map((p) => p.id);

describe("normalizeDeclaration", () => {
  it("d'un payload vide, tire un document complet dans l'ordre du fond", () => {
    const d = normalizeDeclaration({}, BUILTIN);
    expect(d.order).toEqual(BUILTIN);
    expect(d.custom).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.raisonEtre).toBe("");
  });

  it("écarte les identifiants inconnus de l'ordre et des retraits", () => {
    const d = normalizeDeclaration(
      { order: ["fantome", BUILTIN[1], BUILTIN[0]], removed: [BUILTIN[0], "fantome"] },
      BUILTIN,
    );
    expect(d.order.slice(0, 2)).toEqual([BUILTIN[1], BUILTIN[0]]);
    expect(d.order).not.toContain("fantome");
    expect(d.removed).toEqual([BUILTIN[0]]);
  });

  it("un ordre qui répète un identifiant ne duplique plus le principe", () => {
    // Cas du rapport : un ordre dupliqué sortait deux fois le même principe à
    // l'écran comme dans le PDF.
    const d = normalizeDeclaration(
      { order: [BUILTIN[0], BUILTIN[0], BUILTIN[1]] },
      BUILTIN,
    );
    expect(d.order.filter((id) => id === BUILTIN[0])).toHaveLength(1);
    expect(new Set(d.order).size).toBe(d.order.length);
  });

  it("un principe connu absent de l'ordre reprend sa place à la fin", () => {
    const d = normalizeDeclaration({ order: [BUILTIN[2]] }, BUILTIN);
    expect(d.order[0]).toBe(BUILTIN[2]);
    expect(new Set(d.order)).toEqual(new Set(BUILTIN));
  });

  it("rejette les principes personnalisés sans identifiant ou mal formés", () => {
    const d = normalizeDeclaration(
      {
        custom: [
          { id: "c1", title: "Un", text: "Texte" },
          { id: "", title: "Sans id", text: "x" },
          "pas un objet",
          null,
          { title: "Sans id du tout" },
        ],
      },
      BUILTIN,
    );
    expect(d.custom).toEqual([{ id: "c1", title: "Un", text: "Texte" }]);
  });

  it("un personnalisé qui collide avec un principe du fond est écarté", () => {
    const d = normalizeDeclaration(
      { custom: [{ id: BUILTIN[0], title: "Usurpateur", text: "x" }] },
      BUILTIN,
    );
    expect(d.custom).toEqual([]);
    expect(d.order.filter((id) => id === BUILTIN[0])).toHaveLength(1);
  });

  it("deux personnalisés de même identifiant : le second est écarté", () => {
    const d = normalizeDeclaration(
      {
        custom: [
          { id: "c1", title: "Premier", text: "a" },
          { id: "c1", title: "Doublon", text: "b" },
        ],
      },
      BUILTIN,
    );
    expect(d.custom.map((c) => c.title)).toEqual(["Premier"]);
  });

  it("les champs libres non textuels retombent sur une chaîne vide", () => {
    const d = normalizeDeclaration(
      { raisonEtre: 42, devise: null, ratifiers: ["a"], signatories: "Sarah" },
      BUILTIN,
    );
    expect([d.raisonEtre, d.devise, d.ratifiers]).toEqual(["", "", ""]);
    expect(d.signatories).toBe("Sarah");
  });

  it("est idempotente", () => {
    const une = normalizeDeclaration(
      { order: [BUILTIN[1], BUILTIN[1], "fantome"], custom: [{ id: "c1", title: "T", text: "x" }] },
      BUILTIN,
    );
    expect(normalizeDeclaration(une, BUILTIN)).toEqual(une);
  });
});
