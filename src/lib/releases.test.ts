// L'immuabilité d'une version sauvegardée tient à ce module : si sa résolution
// se laisse aller à un repli silencieux, le défaut qu'on vient de fermer revient
// exactement comme il était — un autre texte sous le même nom.

import { describe, expect, it } from "vitest";
import {
  CURRENT_RELEASE,
  type ContentRef,
  currentContentRef,
  isOutdated,
  releaseLabel,
  releaseSha,
  resolveContent,
  resolvePrincipes,
  shortSha,
} from "./releases";
import { ARCHIVED_FILES, ARCHIVED_RELEASES } from "../data/releases";
import { type ConstitutionData, compose, defaultActive } from "./constitution";
import frCourant from "../data/constitution.fr.json";

describe("archive des releases", () => {
  it("porte au moins une release, et la courante est la plus récente", () => {
    expect(ARCHIVED_RELEASES.length).toBeGreaterThan(0);
    expect(CURRENT_RELEASE).toBe(
      ARCHIVED_RELEASES[ARCHIVED_RELEASES.length - 1].id,
    );
  });

  it("chaque release archivée porte les deux langues et leurs empreintes", async () => {
    for (const r of ARCHIVED_RELEASES) {
      for (const locale of ["fr", "en"] as const)
        for (const kind of ["constitution", "principes"] as const) {
          const nom = `${kind}.${locale}.json`;
          expect(
            await ARCHIVED_FILES[r.id]?.[nom]?.(),
            `${r.id} ${kind} ${locale} : fond absent`,
          ).toBeTruthy();
          expect(
            r.sha256[nom],
            `${r.id} ${kind}.${locale} : empreinte absente`,
          ).toMatch(/^[0-9a-f]{64}$/);
        }
    }
  });

  it("la release courante est le fond que l'application sert", async () => {
    // Si ces deux-là divergent, une composition sauvegardée aujourd'hui serait
    // estampillée d'une release qui ne décrit pas ce qu'elle contient.
    // `npm run release:check` garde la même invariante sur les octets.
    const courant = (await ARCHIVED_FILES[CURRENT_RELEASE][
      "constitution.fr.json"
    ]()) as ConstitutionData;
    expect(courant.blocks.map((b) => b.id)).toEqual(
      frCourant.blocks.map((b) => b.id),
    );
    expect(courant.modules.map((m) => m.id)).toEqual(
      frCourant.modules.map((m) => m.id),
    );
  });

  it("le manifeste ne porte aucun texte : les fonds ne descendent qu'à la demande", () => {
    // Le coût que l'audit du 04/10/2026 a mesuré (F12) : douze fonds importés
    // d'office à l'ouverture du Composer. Le manifeste ne garde que de quoi
    // décider — identifiant et empreintes.
    for (const r of ARCHIVED_RELEASES)
      expect(Object.keys(r).sort()).toEqual(["id", "sha256"]);
  });
});

describe("resolveContent", () => {
  const ref = (over: Partial<ContentRef> = {}): ContentRef => ({
    ...currentContentRef("fr"),
    ...over,
  });

  it("résout une release archivée dont l'empreinte correspond", async () => {
    const r = await resolveContent(ref());
    expect(r.statut).toBe("resolue");
    if (r.statut === "resolue") {
      expect(r.release).toBe(CURRENT_RELEASE);
      expect(r.data.blocks.length).toBeGreaterThan(0);
    }
  });

  it("sans référence, dit « non figée » plutôt que de garantir quoi que ce soit", async () => {
    expect((await resolveContent(undefined)).statut).toBe("non-figee");
    expect((await resolveContent(null)).statut).toBe("non-figee");
    expect((await resolveContent(ref({ release: "" }))).statut).toBe("non-figee");
  });

  it("refuse une release absente de l'archive, sans repli sur le fond courant", async () => {
    const r = await resolveContent(ref({ release: "1999-01-01" }));
    expect(r.statut).toBe("release-absente");
    expect(r).not.toHaveProperty("data");
  });

  it("refuse une empreinte qui ne correspond pas à l'archive", async () => {
    const r = await resolveContent(ref({ sha256: "0".repeat(64) }));
    expect(r.statut).toBe("empreinte-divergente");
    expect(r).not.toHaveProperty("data");
  });

  it("tolère une référence sans empreinte, mais jamais une empreinte fausse", async () => {
    // Cas d'un payload écrit par une version antérieure du format : la release
    // suffit à retrouver le texte, l'empreinte n'y était pas encore.
    expect((await resolveContent(ref({ sha256: "" }))).statut).toBe("resolue");
  });

  it("chaque langue résout son propre fond", async () => {
    const fr = await resolveContent(currentContentRef("fr"));
    const en = await resolveContent(currentContentRef("en"));
    expect(fr.statut).toBe("resolue");
    expect(en.statut).toBe("resolue");
    if (fr.statut === "resolue" && en.statut === "resolue")
      expect(en.data.blocks[0].heading).not.toBe(fr.data.blocks[0].heading);
  });
});

describe("resolvePrincipes", () => {
  it("résout les Principes de la release courante", async () => {
    const r = await resolvePrincipes(currentContentRef("fr", "principes"));
    expect(r.statut).toBe("resolue");
    if (r.statut === "resolue") expect(r.data.principles.length).toBeGreaterThan(5);
  });

  it("refuse une release absente et une empreinte divergente", async () => {
    const ref = currentContentRef("fr", "principes");
    expect((await resolvePrincipes({ ...ref, release: "1999-01-01" })).statut).toBe(
      "release-absente",
    );
    expect((await resolvePrincipes({ ...ref, sha256: "0".repeat(64) })).statut).toBe(
      "empreinte-divergente",
    );
  });

  it("ne confond pas les deux fonds d'une même release", async () => {
    // Une référence de Constitution passée au résolveur des Principes ne doit
    // pas rendre les Principes : ce serait servir un document pour un autre.
    const constitution = currentContentRef("fr", "constitution");
    expect((await resolvePrincipes(constitution)).statut).toBe("non-figee");
    const principes = currentContentRef("fr", "principes");
    expect((await resolveContent(principes)).statut).toBe("non-figee");
    // Et leurs empreintes diffèrent : ce ne sont pas les mêmes fichiers.
    expect(constitution.sha256).not.toBe(principes.sha256);
  });

  it("une référence d'avant le genre est lue comme une Constitution", async () => {
    // Les premières références n'avaient pas de `kind` : elles ne parlaient que
    // de la Constitution, et doivent continuer à se résoudre ainsi.
    const { kind: _k, ...sansGenre } = currentContentRef("fr", "constitution");
    void _k;
    expect((await resolveContent(sansGenre)).statut).toBe("resolue");
    expect((await resolvePrincipes(sansGenre)).statut).toBe("non-figee");
  });
});

describe("état d'une référence", () => {
  it("une composition sur la release courante n'est pas dépassée", () => {
    expect(isOutdated(currentContentRef("fr"))).toBe(false);
  });

  it("une composition sur une autre release est dépassée", () => {
    expect(isOutdated({ ...currentContentRef("fr"), release: "2000-01-01" })).toBe(
      true,
    );
  });

  it("une composition sans référence n'est pas « dépassée » : elle n'est pas figée", () => {
    expect(isOutdated(undefined)).toBe(false);
  });

  it("une release se lit comme une date, dans la langue de qui regarde", () => {
    // Ce qui s'affiche à l'utilisateur ne doit pas être un identifiant technique.
    expect(releaseLabel("2026-08-19", "fr")).toBe("19 août 2026");
    expect(releaseLabel("2026-08-19", "en")).toBe("August 19, 2026");
    expect(releaseLabel("2026-01-01", "fr")).toBe("1 janvier 2026");
    // Deux releases le même jour portent la même date : l'empreinte les sépare.
    expect(releaseLabel("2026-08-19-2", "fr")).toBe("19 août 2026");
    // Un identifiant posé à la main n'est pas une date : il se rend tel quel.
    expect(releaseLabel("v6-alpha-gel", "fr")).toBe("v6-alpha-gel");
  });

  it("l'empreinte courte reste comparable à l'œil", () => {
    expect(shortSha(releaseSha(CURRENT_RELEASE, "fr")!)).toHaveLength(12);
  });
});

describe("ce que l'immuabilité protège", () => {
  it("une retouche du fond courant ne change pas ce qu'une version figée rend", async () => {
    // L'épreuve du chantier : c'est exactement le défaut d'origine. On compose
    // depuis la release archivée, on réécrit le fond **courant** sous les pieds,
    // et le document rendu doit être identique — sinon l'archive n'archive rien.
    const ref = currentContentRef("fr");
    const premier = await resolveContent(ref);
    if (premier.statut !== "resolue") throw new Error("release non résolue");
    const avant = JSON.stringify(compose(premier.data, defaultActive(premier.data)));

    const courant = frCourant as unknown as ConstitutionData;
    const memoire = courant.blocks[1].text;
    courant.blocks[1].text = "Texte réécrit après coup par une nouvelle release.";
    try {
      const second = await resolveContent(ref);
      if (second.statut !== "resolue") throw new Error("release non résolue");
      expect(
        JSON.stringify(compose(second.data, defaultActive(second.data))),
      ).toBe(avant);
      // Et la preuve que la retouche a bien eu lieu, sans quoi le test ne
      // prouverait rien : le fond courant, lui, a changé.
      expect(courant.blocks[1].text).not.toBe(memoire);
    } finally {
      courant.blocks[1].text = memoire;
    }
  });

  it("le fond résolu compose un document complet, comme le fond courant", async () => {
    const r = await resolveContent(currentContentRef("fr"));
    if (r.statut !== "resolue") throw new Error("release courante non résolue");
    const items = compose(r.data, defaultActive(r.data));
    expect(items.filter((i) => i.kind === "block")).toHaveLength(
      r.data.blocks.length,
    );
    expect(items.length).toBeGreaterThan(r.data.blocks.length);
  });

  it("deux résolutions de la même référence rendent le même texte", async () => {
    const a = await resolveContent(currentContentRef("fr"));
    const b = await resolveContent(currentContentRef("fr"));
    if (a.statut !== "resolue" || b.statut !== "resolue")
      throw new Error("release courante non résolue");
    expect(JSON.stringify(compose(a.data, defaultActive(a.data)))).toBe(
      JSON.stringify(compose(b.data, defaultActive(b.data))),
    );
  });
});
