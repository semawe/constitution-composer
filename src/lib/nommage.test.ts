// Le nommage de l'édition, tenu par un test.
//
// Contexte : le 18/08/2026, HolacracyOne (Olivier Compagne) a demandé que le
// branding de cet outil change. Le composer affichait « Constitution Holacracy
// v6 [Alpha] » — un numéro de version qui préempte la numérotation de H1, dont
// la prochaine version n'a pas encore de nom, et qui donnait au texte l'air
// d'être officiel : « il n'y a rien qui dit que ça ne l'est pas ». La priorité
// nommée était de dire que l'outil n'est PAS officiel, avant même de dire qu'il
// est expérimental.
//
// Ce que ce test tient, et que rien d'autre ne tient :
//  - aucune surface d'affichage ne porte de numéro de version de la Constitution
//    autre que la 5.0 de HolacracyOne, à laquelle on se réfère ;
//  - la mention de non-officialité existe dans les deux langues, aux deux
//    endroits qui la portent (la pastille du site, le sous-titre du document) ;
//  - le titre du fond nomme son éditeur plutôt qu'un rang dans une lignée.
//
// La provenance interne (`meta.version`, `meta.source`, le dossier `v6-alpha/`
// du sous-module, `REPO_V6_URL`) reste inchangée et hors du champ de ce test :
// elle dit d'où vient le texte, elle ne s'affiche pas.

import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMPOSER, INTRO_BANNER, PRINCIPES_UI, UI } from "./i18n";
import constitutionFr from "../data/constitution.fr.json";
import constitutionEn from "../data/constitution.en.json";

/** Un rang dans la lignée officielle, ou un état d'avancement qui s'y réfère. */
const VERSION_MIMEE = /\bv\s?6\b|version\s+6\b|\[\s*alpha\s*\]/i;

const SRC = fileURLToPath(new URL("..", import.meta.url));

/**
 * Les surfaces d'affichage : les pages (titres, descriptions, contenu) et les
 * composants. `src/data` et `src/lib` en sont exclus — c'est là que vit la
 * provenance, qui a le droit de nommer `v6-alpha`.
 */
function fichiersAffiches(): string[] {
  const out: string[] = [];
  const descendre = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) descendre(p);
      else if ([".ts", ".tsx"].includes(extname(e.name)) && !e.name.includes(".test."))
        out.push(p);
    }
  };
  descendre(join(SRC, "app"));
  descendre(join(SRC, "components"));
  return out;
}

describe("nommage : rien ne se présente comme une version officielle", () => {
  it("aucune page ni composant n'annonce une version 6 ni un état alpha", () => {
    const fautifs = fichiersAffiches()
      .map((f) => [f.slice(SRC.length), readFileSync(f, "utf8")] as const)
      .filter(([, contenu]) => VERSION_MIMEE.test(contenu))
      .map(([nom]) => nom);
    expect(fautifs).toEqual([]);
  });

  it("les dictionnaires d'interface n'annoncent aucune version 6", () => {
    const chaines = (o: unknown): string[] =>
      typeof o === "string"
        ? [o]
        : Array.isArray(o)
          ? o.flatMap(chaines)
          : o && typeof o === "object"
            ? Object.values(o).flatMap(chaines)
            : [];
    for (const dict of [UI, COMPOSER, PRINCIPES_UI, INTRO_BANNER])
      for (const s of chaines(dict))
        expect(s, "libellé annonçant une version 6").not.toMatch(VERSION_MIMEE);
  });

  it("chaque langue dit que l'outil n'est pas officiel", () => {
    for (const locale of ["fr", "en"] as const) {
      // La pastille du site, au-dessus du titre de la page d'accueil.
      expect(UI[locale].unofficial).toMatch(/non affilié|not affiliated/i);
      // Le sous-titre du document, à l'écran comme dans le PDF.
      expect(UI[locale].derivation).toMatch(/non officielle|Unofficial/);
      expect(UI[locale].derivation).toMatch(/5\.0/);
      expect(UI[locale].derivation).toMatch(/HolacracyOne/);
      // La ligne posée au-dessus du titre, à l'écran comme dans le PDF.
      expect(COMPOSER[locale].editionKicker).toMatch(/non officielle|unofficial/i);
      expect(PRINCIPES_UI[locale].editionKicker).toMatch(/non officielle|unofficial/i);
    }
  });

  it("le titre du fond nomme son éditeur, pas un rang de version", () => {
    for (const fond of [constitutionFr, constitutionEn]) {
      expect(fond.meta.title).toMatch(/Sémawé/);
      expect(fond.meta.title).not.toMatch(VERSION_MIMEE);
    }
  });

  it("le fond attribue la marque à son titulaire", () => {
    expect(constitutionFr.meta.notice).toMatch(/marque déposée de HolacracyOne/);
    expect(constitutionEn.meta.notice).toMatch(
      /registered trademark of HolacracyOne/,
    );
  });
});
