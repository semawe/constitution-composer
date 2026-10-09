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

// ---------------------------------------------------------------------------
// La langue du document, et les libellés que les dictionnaires ne voyaient pas.
// La parité des clés ne dit rien d'un texte écrit en dur dans un composant, ni
// de la langue que la page déclare : l'audit du 04/10/2026 (F15) a trouvé les
// pages anglaises annoncées `lang="fr"`, et du français dans leur document.
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

describe("langue déclarée par les pages", () => {
  const racine = (groupe: string) =>
    readFileSync(join("src/app", groupe, "layout.tsx"), "utf8");

  it("chaque langue a son layout racine, et il déclare la sienne", () => {
    expect(racine("(fr)")).toMatch(/<html\s+lang="fr"/);
    expect(racine("(en)")).toMatch(/<html\s+lang="en"/);
  });

  it("toutes les pages anglaises vivent sous la racine anglaise", () => {
    // Une page `/en/…` posée ailleurs hériterait d'une autre racine, donc d'une
    // autre langue : c'est le défaut d'origine.
    const pages = fichiers("src/app").filter((f) => f.endsWith("page.tsx"));
    const anglaises = pages.filter((f) => /[\\/]en[\\/]/.test(f));
    expect(anglaises.length).toBeGreaterThan(0);
    for (const page of anglaises)
      expect(page, `${page} : hors de la racine anglaise`).toContain("(en)");
    for (const page of pages.filter((f) => f.includes("(en)")))
      expect(page, `${page} : page non anglaise sous la racine anglaise`).toMatch(
        /[\\/]en[\\/]/,
      );
  });
});

describe("aucun libellé français écrit en dur dans le document composé", () => {
  // Les composants que les deux langues partagent, sur le chemin du document.
  // Un texte visible y passe par un dictionnaire ; écrit en dur, il sort en
  // français dans l'interface anglaise.
  //
  // La garde est une heuristique, et elle le dit : elle reconnaît une phrase
  // française à ses accents et à ses apostrophes. Une phrase sans accent lui
  // échappe ; la relecture des pages `/en` rendues reste nécessaire.
  const PARTAGES = [
    "src/components/composer/ComposerDocument.tsx",
    "src/components/composer/ComposerEntete.tsx",
    "src/components/composer/ComposerIdentite.tsx",
    "src/components/composer/ComposerPanel.tsx",
    "src/components/composer/ComposerModales.tsx",
    "src/components/composer/pieces.tsx",
    "src/components/compte/ConnexionChoix.tsx",
    "src/components/VersionDoc.tsx",
  ];

  /** Le source sans ses commentaires, qui sont en français par convention. */
  const sansCommentaires = (source: string) =>
    source
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\s\/\/ .*$/gm, "");

  it.each(PARTAGES)("%s", (chemin) => {
    const source = sansCommentaires(readFileSync(chemin, "utf8"));
    // Texte de balise, attribut lisible ou gabarit portant une lettre accentuée
    // ou une apostrophe typée : la signature d'une phrase française.
    const suspects = [
      ...source.matchAll(/>([^<>{}]*[àâçéèêëîïôùûœ][^<>{}]*)</gi),
      ...source.matchAll(
        /(?:alt|title|placeholder|aria-label)="([^"]*[a-zà-ÿ]{3,}[^"]*)"/gi,
      ),
      // Gabarits d'une seule ligne : ceux qui courent sur plusieurs sont des
      // listes de classes, pas des phrases.
      ...source.matchAll(/`([^`\n]*[àâçéèêëîïôùûœ][^`\n]*)`/gi),
      ...source.matchAll(/&apos;/g),
    ]
      .map((m) => (m[1] ?? m[0]).trim())
      // Un nom propre n'est pas un libellé.
      .filter((texte) => texte !== "Sémawé");
    expect(suspects).toEqual([]);
  });
});
