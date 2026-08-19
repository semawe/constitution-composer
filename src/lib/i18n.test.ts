import { describe, expect, it } from "vitest";
import {
  APP_UI,
  COMPOSER,
  GLOSSAIRE_UI,
  INTRO_BANNER,
  MARKETPLACE,
  PRINCIPES_UI,
  UI,
} from "./i18n";
import { glossary } from "./glossary";
import constitutionFr from "../data/constitution.fr.json";
import constitutionEn from "../data/constitution.en.json";
import principesFr from "../data/principes.fr.json";
import principesEn from "../data/principes.en.json";

// ---------------------------------------------------------------------------
// Parité FR/EN. Un libellé oublié dans un dictionnaire ne se voit pas au build :
// il ressort en français dans l'interface anglaise, ou fait planter l'accès.
// ---------------------------------------------------------------------------

function keys(o: unknown, prefix = ""): string[] {
  if (!o || typeof o !== "object") return [prefix];
  return Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? keys(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

const DICTS: [string, { fr: unknown; en: unknown }][] = [
  ["UI", UI],
  ["APP_UI", APP_UI],
  ["COMPOSER", COMPOSER],
  ["MARKETPLACE", MARKETPLACE],
  ["PRINCIPES_UI", PRINCIPES_UI],
  ["GLOSSAIRE_UI", GLOSSAIRE_UI],
  // Le bandeau d'introduction manquait à cette liste : c'est le premier texte
  // que lit un visiteur, et rien ne l'aurait empêché de rester en français.
  ["INTRO_BANNER", INTRO_BANNER],
];

describe("dictionnaires i18n : parité FR/EN", () => {
  for (const [name, dict] of DICTS) {
    it(`${name} expose les mêmes clés dans les deux langues`, () => {
      expect(keys(dict.en).sort()).toEqual(keys(dict.fr).sort());
    });
  }

  it("aucune valeur anglaise n'est restée identique au français", () => {
    // Garde-fou grossier mais efficace : on ne compare que les chaînes assez
    // longues pour être des phrases (les noms propres et les libellés communs
    // comme « Composer » ou « Adoption » sont légitimement identiques).
    const flat = (o: unknown, out: Record<string, string> = {}, p = "") => {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (typeof v === "string") out[`${p}${k}`] = v;
        else if (v && typeof v === "object" && !Array.isArray(v))
          flat(v, out, `${p}${k}.`);
      }
      return out;
    };
    for (const [name, dict] of DICTS) {
      const fr = flat(dict.fr);
      const en = flat(dict.en);
      for (const [k, v] of Object.entries(fr)) {
        if (v.length < 25) continue;
        expect(en[k], `${name}.${k} non traduit`).not.toBe(v);
      }
    }
  });
});

describe("données bilingues : structures alignées", () => {
  it("le glossaire expose les mêmes clés de terme", () => {
    expect(glossary("en").map((t) => t.key).sort()).toEqual(
      glossary("fr").map((t) => t.key).sort(),
    );
  });

  it("les principes portent les mêmes identifiants", () => {
    expect(principesEn.principles.map((p) => p.id)).toEqual(
      principesFr.principles.map((p) => p.id),
    );
  });

  it("la Constitution expose les mêmes blocs, ancres et modules", () => {
    expect(constitutionEn.blocks.map((b) => b.id)).toEqual(
      constitutionFr.blocks.map((b) => b.id),
    );
    expect(constitutionEn.blocks.map((b) => b.anchor)).toEqual(
      constitutionFr.blocks.map((b) => b.anchor),
    );
    expect(constitutionEn.modules.map((m) => m.id)).toEqual(
      constitutionFr.modules.map((m) => m.id),
    );
  });
});
