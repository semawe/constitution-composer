// L'export est l'artefact que des organisations adoptent : une section perdue en
// route est le défaut le plus grave que cette application puisse produire, et le
// plus silencieux — rien ne plante, le PDF sort, il est simplement incomplet.
//
// Ces tests parcourent l'arbre d'éléments des documents (`ComposedDoc`,
// `PrincipesDoc`) sans faire tourner le moteur PDF : celui-ci réclame les polices
// et un environnement navigateur, et ce n'est pas la mise en page qu'on éprouve
// ici, c'est la présence de la matière.

import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ComposedDoc, PrincipesDoc, type PrincipesPdfData } from "./pdf";
import {
  type ConstitutionData,
  compose,
  defaultActive,
  normalizeActive,
} from "./constitution";
import { COMPOSER, type Locale, PRINCIPES_UI } from "./i18n";
import { releaseLabel } from "./releases";
import frJson from "../data/constitution.fr.json";
import enJson from "../data/constitution.en.json";
import principesFr from "../data/principes.fr.json";

const FONDS: [Locale, ConstitutionData][] = [
  ["fr", frJson as unknown as ConstitutionData],
  ["en", enJson as unknown as ConstitutionData],
];

/**
 * Suite des chaînes que l'arbre rendra, dans l'ordre du document. Les primitives
 * de @react-pdf sont des chaînes (`"TEXT"`, `"VIEW"`) : un `type` qui est une
 * fonction est donc un composant à nous, qu'on appelle pour ne pas rater ce
 * qu'il porte dans ses props (les listes de signatures, par exemple).
 */
function pieces(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string") return [node];
  if (typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(pieces);
  if (typeof node === "object" && "props" in node) {
    const el = node as { type?: unknown; props?: { children?: ReactNode } };
    if (typeof el.type === "function") {
      const render = el.type as (p: unknown) => ReactNode;
      return pieces(render(el.props));
    }
    return pieces(el.props?.children);
  }
  return [];
}

/**
 * Le texte du document. Les morceaux se recollent sans séparateur : c'est ainsi
 * qu'ils s'affichent, les espaces vivant à l'intérieur des morceaux (le
 * découpage gras/italique tombe au milieu d'une phrase). Les retours à la ligne
 * deviennent des espaces, la mise en page ne nous concerne pas.
 */
function flatten(node: ReactNode): string {
  return pieces(node).join("").replace(/\s+/g, " ").trim();
}

/**
 * Ce qu'une ligne du fond doit donner dans l'export : sans balisage de liste ni
 * d'emphase, espaces normalisés. On cherche ensuite cette chaîne dans le
 * document — l'inclusion suffit, la mise en page ne nous concerne pas.
 */
function needle(line: string): string {
  return line
    .trim()
    .replace(/^(?:-\s+|\d+\.\s+)/, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Les lignes attendues d'un texte du fond : une par ligne non vide. */
function lines(text: string): string[] {
  return text
    .split("\n")
    .map(needle)
    .filter((l) => l.length > 0);
}

/** Toutes les lignes du fond, socle et modules confondus, doublons compris. */
function toutesLesLignes(data: ConstitutionData): string[] {
  return [
    ...data.blocks.flatMap((b) => lines(b.text)),
    ...data.modules.flatMap((m) => [
      ...m.insertions.flatMap((i) => lines(i.text)),
      ...(m.fallback ? lines(m.fallback.text) : []),
    ]),
  ];
}

/** Lignes d'un texte qu'aucun autre texte du fond ne porte à l'identique. */
function lignesPropres(data: ConstitutionData, text: string): string[] {
  const toutes = toutesLesLignes(data);
  return lines(text).filter(
    (l) => toutes.filter((autre) => autre === l).length === 1,
  );
}

const doc = (
  locale: Locale,
  data: ConstitutionData,
  active: ReadonlySet<string>,
  opts: Partial<Parameters<typeof ComposedDoc>[0]> = {},
) =>
  ComposedDoc({
    data,
    active,
    title: "Constitution de l'Organisation",
    values: "",
    locale,
    ...opts,
  });

describe.each(FONDS)("export du document composé (%s)", (locale, data) => {
  const t = COMPOSER[locale];
  const tous = normalizeActive(data, data.modules.map((m) => m.id));

  it("chaque bloc du socle atteint l'export : titre, note d'intention, texte", () => {
    const rendu = flatten(doc(locale, data, defaultActive(data)));
    for (const item of compose(data, defaultActive(data))) {
      if (item.kind !== "block") continue;
      expect(rendu, `titre du bloc ${item.anchor}`).toContain(needle(item.heading!));
      if (item.intent)
        expect(rendu, `note d'intention de ${item.anchor}`).toContain(needle(item.intent));
      for (const l of lines(item.text))
        expect(rendu, `${item.anchor} : ligne perdue « ${l.slice(0, 60)} »`).toContain(l);
    }
  });

  it("chaque insertion et chaque remplacement atteint l'export, avec l'étiquette de son module", () => {
    const rendu = flatten(doc(locale, data, defaultActive(data)));
    for (const item of compose(data, defaultActive(data))) {
      if (item.kind === "block") continue;
      for (const l of lines(item.text))
        expect(rendu, `${item.key} : ligne perdue « ${l.slice(0, 60)} »`).toContain(l);
      expect(rendu, `étiquette de ${item.key}`).toContain(needle(item.moduleLabel!));
    }
  });

  it("tous les modules actifs : aucune insertion ne manque", () => {
    const rendu = flatten(doc(locale, data, tous));
    for (const m of data.modules) {
      for (const ins of m.insertions) {
        // Une insertion conditionnelle non satisfaite est légitimement absente.
        if (ins.whenActive?.some((id) => !tous.has(id))) continue;
        for (const l of lines(ins.text))
          expect(rendu, `${m.id} : insertion perdue « ${l.slice(0, 60)} »`).toContain(l);
      }
    }
  });

  it("un module inactif ne fuit pas dans l'export, et son remplacement prend sa place", () => {
    // Le Scribe est le cas complet : coché par défaut, et porteur d'un
    // remplacement obligatoire quand on le décoche.
    const scribe = data.modules.find((m) => m.id === "scribe")!;
    const sans = new Set(defaultActive(data));
    sans.delete("scribe");
    const rendu = flatten(doc(locale, data, sans));

    // Le fond répète volontairement certaines phrases d'un Rôle à l'autre : on
    // ne juge la fuite que sur les lignes que le Scribe est seul à porter.
    const propres = lignesPropres(data, scribe.insertions[0].text);
    expect(propres.length, "aucune ligne propre au Scribe : le test ne prouve rien").toBeGreaterThan(0);
    for (const l of propres)
      expect(rendu, `Scribe décoché, ligne restée à l'export : « ${l.slice(0, 60)} »`).not.toContain(l);

    for (const l of lines(scribe.fallback!.text))
      expect(rendu, `remplacement du Scribe absent de l'export`).toContain(l);
    expect(rendu).toContain(needle(t.pdfDefaultRule(scribe.label)));
  });

  it("aucune astérisque de balisage ne survit dans l'export", () => {
    // `runs()` consomme **gras** et *italique*. Une astérisque dans le document
    // signale un motif que l'export n'a pas su lire : elle sort telle quelle.
    expect(flatten(doc(locale, data, tous))).not.toContain("*");
  });

  it("aucun marqueur de liste brut ne survit dans l'export", () => {
    // Une liste rendue met son marqueur dans sa propre cellule : un « - » ou un
    // « 1. » encore collé à un saut de ligne veut dire que le bloc est sorti en
    // texte brut, marqueurs compris (cas rencontré sur la version anglaise du
    // Processus de Décision Intégrative).
    for (const piece of pieces(doc(locale, data, tous))) {
      expect(piece, `marqueur de liste brut : « ${piece.slice(0, 80)} »`).not.toMatch(
        /\n\s*(?:-|\d+\.)\s/,
      );
    }
  });

  it("l'en-tête porte le titre, la version et la date, le pied la licence et la mention", () => {
    const rendu = flatten(
      doc(locale, data, defaultActive(data), { date: "18 août 2026" }),
    );
    expect(rendu).toContain("Constitution de l'Organisation");
    expect(rendu).toContain(data.meta.version.toUpperCase());
    expect(rendu).toContain(`${t.pdfComposedOn} 18 août 2026`);
    expect(rendu).toContain(needle(t.pdfFooter(data.meta.license, data.meta.notice)));
  });

  it("le pied de page dit de quel texte le document est tiré", () => {
    // Sans cette mention, deux PDF du même nom peuvent différer sans qu'on
    // puisse le savoir après coup.
    const rendu = flatten(
      doc(locale, data, defaultActive(data), {
        contentRef: { release: "2026-08-19", sha256: "abcdef0123456789".repeat(4) },
      }),
    );
    expect(rendu).toContain(
      needle(t.pdfContentRef(releaseLabel("2026-08-19", locale), "abcdef012345")),
    );
  });

  it("sans référence de texte, le pied de page n'invente rien", () => {
    const rendu = flatten(doc(locale, data, defaultActive(data)));
    expect(rendu).not.toContain(needle(t.pdfContentRef("", "")).trim());
  });

  it("les valeurs de l'organisation sortent après le préambule et avant l'article 1", () => {
    const valeurs = "Sobriété, franchise, plaisir du travail bien fait.";
    const rendu = flatten(
      doc(locale, data, defaultActive(data), { values: valeurs }),
    );
    const preambule = data.blocks[0].heading;
    const article1 = data.blocks[1].heading;
    expect(rendu.indexOf(needle(t.pdfValuesHeading))).toBeGreaterThan(
      rendu.indexOf(needle(preambule)),
    );
    expect(rendu.indexOf(needle(t.pdfValuesHeading))).toBeLessThan(
      rendu.indexOf(needle(article1)),
    );
    expect(rendu).toContain(valeurs);
  });

  it("sans valeurs saisies, la rubrique n'apparaît pas", () => {
    const rendu = flatten(doc(locale, data, defaultActive(data), { values: "   " }));
    expect(rendu).not.toContain(needle(t.pdfValuesHeading));
  });

  it("les notes d'intention suivent l'interrupteur de l'écran", () => {
    const avecIntention = data.blocks.find((b) => b.intent)!;
    const affichees = flatten(
      doc(locale, data, defaultActive(data), { showIntent: true }),
    );
    const masquees = flatten(
      doc(locale, data, defaultActive(data), { showIntent: false }),
    );
    expect(affichees).toContain(needle(avecIntention.intent!));
    expect(masquees).not.toContain(needle(avecIntention.intent!));
    // Le texte constitutionnel, lui, reste dans les deux cas.
    expect(masquees).toContain(lines(avecIntention.text)[0]);
  });
});

// ---------------------------------------------------------------------------
// L'autre export : la page Principes, avec son adoption et ses signatures.
// ---------------------------------------------------------------------------

describe("export du document des principes", () => {
  const t = PRINCIPES_UI.fr;
  const fixture: PrincipesPdfData = {
    meta: principesFr.meta,
    intro: principesFr.intro,
    raisonEtre: "Rendre l'autorité lisible.",
    devise: "Décider là où l'on sait.",
    adoptionText: "Les Ratificateurs adoptent les principes ci-dessus.",
    items: principesFr.principles.map((p) => ({
      n: Number(p.n),
      title: p.title,
      text: p.text,
    })),
    ratifiers: ["Aliocha Iordanoff", "Juliette Bourdon"],
    signatories: ["Sarah Vidal"],
    locale: "fr",
  };
  const rendu = flatten(PrincipesDoc({ d: fixture }));

  it("porte le titre, la devise, la raison d'être et l'introduction", () => {
    expect(rendu).toContain(needle(fixture.meta.title));
    expect(rendu).toContain(needle(fixture.devise!));
    expect(rendu).toContain(needle(t.pdfPurpose));
    expect(rendu).toContain(needle(fixture.raisonEtre!));
    expect(rendu).toContain(needle(fixture.intro));
  });

  it("porte chaque principe : son numéro, son titre et tout son texte", () => {
    for (const item of fixture.items) {
      expect(rendu, `numéro du principe ${item.n}`).toContain(`${item.n}.`);
      expect(rendu, `titre du principe ${item.n}`).toContain(needle(item.title));
      for (const l of lines(item.text))
        expect(rendu, `principe ${item.n} : ligne perdue « ${l.slice(0, 60)} »`).toContain(l);
    }
  });

  it("porte l'adoption, les ratificateurs et les signataires", () => {
    expect(rendu).toContain(needle(t.adoption));
    expect(rendu).toContain(needle(fixture.adoptionText));
    expect(rendu).toContain(t.pdfRatifiers.toUpperCase());
    expect(rendu).toContain(t.pdfSignatories.toUpperCase());
    for (const nom of [...fixture.ratifiers, ...fixture.signatories])
      expect(rendu, `signature manquante : ${nom}`).toContain(nom);
  });

  it("sans ratificateur ni signataire, aucune rubrique de signature vide", () => {
    const nu = flatten(
      PrincipesDoc({ d: { ...fixture, ratifiers: [], signatories: [] } }),
    );
    expect(nu).not.toContain(t.pdfRatifiers.toUpperCase());
    expect(nu).not.toContain(t.pdfSignatories.toUpperCase());
    // Le fond, lui, reste complet.
    expect(nu).toContain(needle(fixture.adoptionText));
  });

  it("porte la licence et la mention en pied de page", () => {
    expect(rendu).toContain(
      needle(t.footer(fixture.meta.license, fixture.meta.notice)),
    );
  });
});
