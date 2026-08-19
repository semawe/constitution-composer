// Le rendu réel : on fabrique de vrais PDF et on vérifie qu'ils sortent.
//
// `pdf.test.tsx` parcourt l'arbre d'éléments — il voit ce que le document
// contient, pas s'il s'imprime. C'est une garde nécessaire mais aveugle à tout
// ce qui casse dans le moteur : ce test-ci est né d'un défaut qu'elle ne pouvait
// pas voir. Le PDF de la Déclaration de Principes ne sortait pas du tout en
// production — @react-pdf refuse de résoudre `fontStyle: "italic"` quand la
// famille n'a pas de variante italique enregistrée (les cinq polices embarquées
// sont en 400 et 700 seulement), et il jette. L'intro de la Déclaration est en
// italique : l'export échouait à chaque fois, en silence, le bouton reprenait
// son état normal et aucun fichier n'arrivait.
//
// Ce que ce test couvre : le document, le moteur PDF, et la table de résolution
// des polices. Ce qu'il ne couvre pas : le chargement des polices par le
// navigateur (`ensureFonts()` les sert depuis /fonts, hors de portée ici) — d'où
// l'enregistrement ci-dessous, qui reproduit exactement les mêmes descripteurs
// (400, 700 et l'italique embarquée depuis le 19/08). Un italique non résoluble
// rougit donc ici comme il échouerait chez l'utilisateur.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { type DocumentProps, Font, pdf } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";
import { ComposedDoc, PrincipesDoc, type PrincipesPdfData } from "./pdf";
import {
  type ConstitutionData,
  defaultActive,
  normalizeActive,
} from "./constitution";
import frJson from "../data/constitution.fr.json";
import enJson from "../data/constitution.en.json";
import principesFr from "../data/principes.fr.json";

const fr = frJson as unknown as ConstitutionData;
const en = enJson as unknown as ConstitutionData;

/** Les mêmes familles, les mêmes graisses que `ensureFonts()`, depuis le disque. */
const FAMILIES: [string, string][] = [
  ["Source Serif 4", "source-serif"],
  ["EB Garamond", "eb-garamond"],
  ["Lora", "lora"],
  ["Inter", "inter"],
  ["IBM Plex Sans", "ibm-plex"],
];

function fontPath(file: string): string {
  return fileURLToPath(new URL(`../../public/fonts/${file}`, import.meta.url));
}

beforeAll(() => {
  for (const [family, file] of FAMILIES) {
    // Les fichiers sont ceux servis par l'application : s'ils manquent, le
    // dire ici plutôt que de laisser @react-pdf échouer sur autre chose.
    for (const variante of ["400", "700", "400-italic"])
      expect(
        () => readFileSync(fontPath(`${file}-${variante}.woff`)),
        `public/fonts/${file}-${variante}.woff manquante`,
      ).not.toThrow();
    Font.register({
      family,
      fonts: [
        { src: fontPath(`${file}-400.woff`), fontWeight: 400 },
        { src: fontPath(`${file}-700.woff`), fontWeight: 700 },
        // La même table que `ensureFonts()`, italique comprise depuis le 19/08 :
        // c'est ce qui rend ce test capable de voir un italique non résoluble.
        {
          src: fontPath(`${file}-400-italic.woff`),
          fontWeight: 400,
          fontStyle: "italic",
        },
      ],
    });
  }
});

/** Rend un document et rend ses octets. Jette si le moteur jette. */
async function render(element: ReactElement<DocumentProps>): Promise<Buffer> {
  const flux = (await pdf(element).toBuffer()) as unknown as AsyncIterable<Buffer>;
  const morceaux: Buffer[] = [];
  for await (const morceau of flux) morceaux.push(Buffer.from(morceau));
  return Buffer.concat(morceaux);
}

function estUnPdf(octets: Buffer, quoi: string) {
  expect(octets.subarray(0, 5).toString(), `${quoi} : ce n'est pas un PDF`).toBe(
    "%PDF-",
  );
  // Un PDF d'une Constitution complète pèse des dizaines de kilo-octets : un
  // document vide ou tronqué se voit à la taille.
  expect(octets.length, `${quoi} : PDF suspicieusement léger`).toBeGreaterThan(
    20_000,
  );
  expect(octets.subarray(-1024).toString("latin1"), `${quoi} : PDF non clos`).toContain(
    "%%EOF",
  );
}

describe("rendu réel du document composé", () => {
  it("sort un PDF avec la police par défaut, en français", async () => {
    const octets = await render(
      <ComposedDoc
        data={fr}
        active={defaultActive(fr)}
        title="Constitution de l'Organisation"
        values="Sobriété, franchise."
        date="18 août 2026"
      />,
    );
    estUnPdf(octets, "composé fr");
  }, 60_000);

  it("sort un PDF avec tous les modules, en anglais", async () => {
    const tous = normalizeActive(en, en.modules.map((m) => m.id));
    const octets = await render(
      <ComposedDoc
        data={en}
        active={tous}
        title="Constitution of the Organization"
        values=""
        locale="en"
      />,
    );
    estUnPdf(octets, "composé en, tous modules");
  }, 60_000);

  it.each(["eb-garamond", "lora", "inter", "ibm-plex"])(
    "sort un PDF avec la police %s (les faces italiques diffèrent selon la famille)",
    async (font) => {
      const octets = await render(
        <ComposedDoc
          data={fr}
          active={defaultActive(fr)}
          title="Constitution"
          values=""
          font={font}
        />,
      );
      estUnPdf(octets, `composé ${font}`);
    },
    60_000,
  );
});

describe("rendu réel de la Déclaration de Principes", () => {
  const base: PrincipesPdfData = {
    meta: principesFr.meta,
    intro: principesFr.intro,
    adoptionText: "Les Ratificateurs adoptent les principes ci-dessus.",
    items: principesFr.principles.map((p) => ({
      n: Number(p.n),
      title: p.title,
      text: p.text,
    })),
    ratifiers: ["Aliocha Iordanoff"],
    signatories: ["Juliette Bourdon"],
    locale: "fr",
  };

  it("sort un PDF : c'est l'export qui échouait en production", async () => {
    estUnPdf(await render(<PrincipesDoc d={base} />), "principes");
  }, 60_000);

  it("sort un PDF avec devise et raison d'être, tous deux en italique", async () => {
    const octets = await render(
      <PrincipesDoc
        d={{
          ...base,
          devise: "Décider là où l'on sait.",
          raisonEtre: "Rendre l'autorité lisible.",
          font: "inter",
        }}
      />,
    );
    estUnPdf(octets, "principes, devise et raison d'être");
  }, 60_000);
});
