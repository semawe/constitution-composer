// Fidélité du fond servi par le Composer à la source canonique de la
// Constitution (sous-module `vendor/holacracy-constitution`).
//
// `src/data/constitution.{fr,en}.json` n'est pas généré : c'est une recomposition
// éditoriale du tier lite (le socle incompressible d'un côté, les blocs
// retirables extraits en modules de l'autre), avec ses propres choix de forme —
// listes reflowées, guillemets sans gras, tirets cadratins purgés (convention
// éditoriale Sémawé). Une comparaison littérale n'a donc aucun sens ici.
//
// Ce qui se compare, et qui suffit à voir passer une divergence de fond :
// les titres des articles, les notes d'intention (reprises mot pour mot de la
// source, à la ponctuation près) et les termes que la source définit en gras.
// Un article renommé, une note réécrite ou un terme nouveau côté canonique
// rougit ici — c'est le seul endroit qui le verra.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type ConstitutionData,
  compose,
  normalizeActive,
} from "./constitution";
import frJson from "../data/constitution.fr.json";
import enJson from "../data/constitution.en.json";

type Lang = "fr" | "en";

const FONDS: [Lang, ConstitutionData][] = [
  ["fr", frJson as unknown as ConstitutionData],
  ["en", enJson as unknown as ConstitutionData],
];

const SOURCES: Record<Lang, string> = {
  fr: "v6-alpha/fr/HC-v6-lite.md",
  en: "v6-alpha/en/HC-v6-lite.md",
};

/**
 * Divergences connues et assumées entre la source canonique et le fond servi.
 * Toute autre divergence doit rougir. Vider cette liste quand la source est
 * corrigée en amont.
 */
const DIVERGENCES_ASSUMEES: Record<Lang, string[]> = {
  // La source définit « Leader du Cercle » puis écrit « Leader de Cercle »
  // douze fois. L'application a retenu la forme majoritaire.
  fr: ["Leader du Cercle"],
  en: [],
};

function sourceCanonique(lang: Lang): string {
  const chemin = new URL(
    `../../vendor/holacracy-constitution/${SOURCES[lang]}`,
    import.meta.url,
  );
  try {
    return readFileSync(chemin, "utf8").replace(/\r\n/g, "\n");
  } catch {
    throw new Error(
      `Source canonique introuvable : vendor/holacracy-constitution/${SOURCES[lang]}\n` +
        "Le sous-module n'est pas initialisé. Lance :\n" +
        "  git submodule update --init --recursive",
    );
  }
}

/** Comparaison sur la matière : ni casse, ni ponctuation, ni espaces. */
function mots(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Les titres d'articles de la source, dans l'ordre (préambule compris). */
function titresCanoniques(markdown: string): string[] {
  return [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);
}

/** Les notes d'intention de la source, appariées au titre qui les précède. */
function notesCanoniques(markdown: string): Map<string, string> {
  const notes = new Map<string, string>();
  for (const m of markdown.matchAll(/^##\s+(.+?)\s*$/gm)) {
    const suite = markdown.slice(m.index! + m[0].length);
    const note = /^\s*\n\*(?:Note d'intention|Intent note)\s*:\s*([^\n]+?)\*\s*\n/.exec(
      suite,
    );
    if (note) notes.set(m[1], note[1].trim());
  }
  return notes;
}

/** Les termes que la source définit, c'est-à-dire cite en gras entre guillemets. */
function termesCanoniques(markdown: string): string[] {
  return [
    ...new Set(
      [...markdown.matchAll(/\*\*[«"“]\s*([^»"”]{2,60}?)\s*[»"”]\*\*/g)].map((m) =>
        m[1].trim(),
      ),
    ),
  ];
}

/** Tout le texte qu'une composition peut produire, modules compris. */
function texteMaximal(data: ConstitutionData): string {
  const tous = normalizeActive(data, data.modules.map((m) => m.id));
  const items = compose(data, tous)
    .map((i) => [i.heading ?? "", i.intent ?? "", i.text].join("\n"))
    .join("\n");
  // Les remplacements obligatoires ne sortent que modules décochés : on les
  // ajoute, ils font partie du fond servi.
  const replis = data.modules
    .filter((m) => m.fallback)
    .map((m) => m.fallback!.text)
    .join("\n");
  return `${items}\n${replis}`;
}

describe.each(FONDS)("fidélité du fond à la source canonique (%s)", (lang, data) => {
  const markdown = sourceCanonique(lang);

  it("le fond déclare la source à laquelle on le compare", () => {
    // Sans ce contrôle, le fond pourrait dériver d'un autre fichier que celui
    // que ce test lit : la garde protégerait le mauvais document.
    expect(data.meta.source.startsWith(SOURCES[lang])).toBe(true);
  });

  it("les articles du socle reprennent les titres canoniques, dans l'ordre", () => {
    expect(data.blocks.map((b) => mots(b.heading))).toEqual(
      titresCanoniques(markdown).map(mots),
    );
  });

  it("chaque note d'intention reprend celle de la source", () => {
    const notes = notesCanoniques(markdown);
    const titres = titresCanoniques(markdown);
    expect(notes.size, "aucune note d'intention lue dans la source").toBe(
      titres.length,
    );
    data.blocks.forEach((bloc, i) => {
      const attendue = notes.get(titres[i]);
      expect(bloc.intent, `${bloc.id} : note d'intention absente du fond`).toBeTruthy();
      expect(mots(bloc.intent!), `${bloc.id} : note d'intention divergente`).toBe(
        mots(attendue!),
      );
    });
  });

  it("chaque terme défini par la source existe dans le document composable", () => {
    const texte = texteMaximal(data);
    const termes = termesCanoniques(markdown);
    expect(termes.length, "aucun terme défini lu dans la source").toBeGreaterThan(20);
    const absents = termes.filter((t) => !texte.includes(t));
    expect(absents).toEqual(DIVERGENCES_ASSUMEES[lang]);
  });
});

// ---------------------------------------------------------------------------
// Parité structurelle FR/EN. `i18n.test.ts` compare les identifiants ; ici on
// compare ce qui fabrique le document : une insertion ajoutée d'un seul côté
// donne une Constitution anglaise amputée d'une section, sans rien casser.
// ---------------------------------------------------------------------------

describe("parité structurelle FR/EN du fond", () => {
  const [, fr] = FONDS[0];
  const [, en] = FONDS[1];

  it("les blocs portent le même type, le même rang et la même ancre", () => {
    const forme = (d: ConstitutionData) =>
      d.blocks.map((b) => ({
        id: b.id,
        type: b.type,
        anchor: b.anchor,
        tier: b.tier,
        always: b.always,
        intent: Boolean(b.intent),
      }));
    expect(forme(en)).toEqual(forme(fr));
  });

  it("les modules portent le même tier, le même graphe et les mêmes ancrages", () => {
    const forme = (d: ConstitutionData) =>
      d.modules.map((m) => ({
        id: m.id,
        tier: m.tier,
        default: Boolean(m.default),
        requires: [...m.requires].sort(),
        conflicts: [...m.conflicts].sort(),
        insertions: m.insertions.map((i) => ({
          anchor: i.anchor,
          position: i.position,
          whenActive: [...(i.whenActive ?? [])].sort(),
        })),
        fallback: m.fallback?.anchor ?? null,
      }));
    expect(forme(en)).toEqual(forme(fr));
  });

  it("aucun texte du fond n'est resté en français côté anglais", () => {
    // Garde grossière mais efficace, comme dans i18n.test.ts : un bloc ou une
    // insertion recopiée telle quelle est une section non traduite.
    const textesFr = new Set([
      ...fr.blocks.map((b) => b.text),
      ...fr.modules.flatMap((m) => m.insertions.map((i) => i.text)),
    ]);
    for (const bloc of en.blocks)
      expect(textesFr, `bloc ${bloc.id} non traduit`).not.toContain(bloc.text);
    for (const m of en.modules)
      for (const ins of m.insertions)
        expect(textesFr, `insertion de ${m.id} non traduite`).not.toContain(ins.text);
  });
});
