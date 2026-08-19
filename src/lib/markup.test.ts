// La grammaire du balisage est désormais partagée par tous les rendus (HTML du
// Composer, des pages /lite et /micro, et PDF).
// Ce qui se casse ici se casse partout à la fois : c'est le prix de la
// mutualisation, et la raison de la couvrir directement.

import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline } from "./markup";
import { type ConstitutionData } from "./constitution";
import frJson from "../data/constitution.fr.json";
import enJson from "../data/constitution.en.json";

describe("parseInline", () => {
  it("laisse un texte sans balisage en un seul segment", () => {
    expect(parseInline("Un Rôle est une unité de travail.")).toEqual([
      { emphasis: "plain", text: "Un Rôle est une unité de travail." },
    ]);
  });

  it("lit le gras et l'italique, et garde le texte autour", () => {
    expect(parseInline("Le **Scribe** tient les *registres* du Cercle.")).toEqual([
      { emphasis: "plain", text: "Le " },
      { emphasis: "bold", text: "Scribe" },
      { emphasis: "plain", text: " tient les " },
      { emphasis: "italic", text: "registres" },
      { emphasis: "plain", text: " du Cercle." },
    ]);
  });

  it("écarte les segments vides plutôt que de rendre du vide", () => {
    expect(parseInline("**Par défaut.** Le Leader décide.")).toEqual([
      { emphasis: "bold", text: "Par défaut." },
      { emphasis: "plain", text: " Le Leader décide." },
    ]);
  });

  it("une astérisque non appariée reste littérale", () => {
    // Limite assumée : la grammaire ne devine pas. Le test « aucune astérisque
    // ne survit dans l'export » interdit qu'un tel texte entre dans le fond.
    expect(parseInline("un * isolé")).toEqual([
      { emphasis: "plain", text: "un * isolé" },
    ]);
  });

  it("un texte vide ne produit aucun segment", () => {
    expect(parseInline("")).toEqual([]);
  });
});

describe("parseBlocks", () => {
  it("sépare les paragraphes sur la ligne vide", () => {
    expect(parseBlocks("Un.\n\nDeux.")).toEqual([
      { kind: "paragraph", text: "Un." },
      { kind: "paragraph", text: "Deux." },
    ]);
  });

  it("reconnaît une liste à puces et retire les marqueurs", () => {
    expect(parseBlocks("- premier ;\n- second.")).toEqual([
      { kind: "bullets", items: ["premier ;", "second."] },
    ]);
  });

  it("reconnaît une liste numérotée et conserve le numéro écrit", () => {
    expect(parseBlocks("1. **Un.** a\n2. **Deux.** b")).toEqual([
      {
        kind: "numbered",
        items: [
          { marker: "1.", text: "**Un.** a" },
          { marker: "2.", text: "**Deux.** b" },
        ],
      },
    ]);
  });

  it("un bloc qui mêle deux formes de liste retombe en paragraphe", () => {
    // Les listes imbriquées ne sont pas rendues : le bloc sort tel quel,
    // marqueurs visibles. C'est le défaut qu'avait la version anglaise du
    // Processus de Décision Intégrative, et que la garde de l'export attrape.
    const mixte = "1. premier\n   - sous-point\n2. second";
    expect(parseBlocks(mixte)).toEqual([{ kind: "paragraph", text: mixte }]);
  });

  it("un item de liste isolé reste un paragraphe", () => {
    // Autre limite assumée, gardée côté fond (« aucun item de liste isolé »).
    expect(parseBlocks("- tout seul")).toEqual([
      { kind: "paragraph", text: "- tout seul" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Propriété sur le fond réel : la grammaire ne perd rien et n'invente rien.
// ---------------------------------------------------------------------------

const FONDS: [string, ConstitutionData][] = [
  ["fr", frJson as unknown as ConstitutionData],
  ["en", enJson as unknown as ConstitutionData],
];

/** Les mots d'un texte, balisage retiré : la matière, indépendamment de la forme. */
function words(text: string): string[] {
  return text
    .replace(/^(?:-\s+|\d+\.\s+)/gm, "")
    .replace(/\*/g, "")
    .split(/[^\p{L}\p{N}'’]+/u)
    .filter(Boolean);
}

/** Les mots que la grammaire restitue, dans l'ordre où les rendus les affichent. */
function parsedWords(text: string): string[] {
  return parseBlocks(text)
    .flatMap((bloc) =>
      bloc.kind === "paragraph"
        ? [bloc.text]
        : bloc.kind === "bullets"
          ? bloc.items
          : bloc.items.map((i) => i.text),
    )
    .flatMap((ligne) => parseInline(ligne).map((s) => s.text))
    .flatMap(words);
}

describe.each(FONDS)("la grammaire sur le fond réel (%s)", (_lang, data) => {
  const textes: [string, string][] = [
    ...data.blocks.map((b) => [`bloc ${b.id}`, b.text] as [string, string]),
    ...data.blocks
      .filter((b) => b.intent)
      .map((b) => [`intention ${b.id}`, b.intent!] as [string, string]),
    ...data.modules.flatMap((m) => [
      ...m.insertions.map(
        (ins, i) => [`${m.id} insertion ${i}`, ins.text] as [string, string],
      ),
      ...(m.fallback
        ? [[`${m.id} remplacement`, m.fallback.text] as [string, string]]
        : []),
    ]),
  ];

  it("restitue chaque mot de chaque texte, dans l'ordre", () => {
    expect(textes.length).toBeGreaterThan(20);
    for (const [nom, texte] of textes) {
      expect(parsedWords(texte), `${nom} : mot perdu ou ajouté`).toEqual(
        words(texte),
      );
    }
  });
});
