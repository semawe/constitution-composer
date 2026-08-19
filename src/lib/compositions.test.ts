// L'estampille de release se pose à la frontière de la sauvegarde. Ce fichier
// vérifie qu'aucun chemin d'écriture n'y échappe : sans elle, une composition
// redevient une simple configuration, et rouvrir une version rendrait le texte
// du jour plutôt que le sien.
//
// Le repli localStorage est le seul chemin éprouvable ici (l'autre demande un
// vrai Supabase). C'est aussi celui qui sert en développement et sans clés, donc
// il mérite sa garde.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENT_RELEASE, releaseSha } from "./releases";

/** Un localStorage minimal : node n'en a pas, et vitest tourne en node ici. */
function installerLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  });
  return store;
}

// `crypto.randomUUID` existe en node 20+, mais on ne dépend pas de l'entropie :
// l'identifiant n'est pas ce qu'on éprouve.
const charge = () => ({
  title: "Constitution de l'Organisation",
  values: "",
  active: ["scribe"],
});

describe("sauvegarde d'une composition (repli local)", () => {
  beforeEach(() => {
    installerLocalStorage();
    vi.resetModules();
  });

  it("estampille la release courante, sans que l'appelant ait à y penser", async () => {
    const { saveComposition } = await import("./compositions");
    const ligne = await saveComposition("Ma version", charge(), "fr");
    expect(ligne.payload.schemaVersion).toBe(2);
    expect(ligne.payload.content).toEqual({
      locale: "fr",
      release: CURRENT_RELEASE,
      sha256: releaseSha(CURRENT_RELEASE, "fr"),
    });
  });

  it("estampille la langue demandée, pas une langue par défaut", async () => {
    const { saveComposition } = await import("./compositions");
    const ligne = await saveComposition("My version", charge(), "en");
    expect(ligne.payload.content?.locale).toBe("en");
    expect(ligne.payload.content?.sha256).toBe(releaseSha(CURRENT_RELEASE, "en"));
  });

  it("écrase une estampille venue de l'extérieur plutôt que de la croire", async () => {
    const { saveComposition } = await import("./compositions");
    const ligne = await saveComposition(
      "Forgée",
      {
        ...charge(),
        schemaVersion: 2,
        content: { locale: "fr", release: "1999-01-01", sha256: "0".repeat(64) },
      },
      "fr",
    );
    expect(ligne.payload.content?.release).toBe(CURRENT_RELEASE);
  });

  it("refuse au-delà du plafond de cinq versions", async () => {
    const { saveComposition, MAX_COMPOSITIONS } = await import("./compositions");
    for (let i = 0; i < MAX_COMPOSITIONS; i++)
      await saveComposition(`v${i}`, charge(), "fr");
    await expect(saveComposition("une de trop", charge(), "fr")).rejects.toThrow(
      "LIMIT",
    );
  });

  it("rejouer une version en crée une autre, et laisse l'originale intacte", async () => {
    // La différence de fond avec « figer » : porter une version d'un texte à un
    // autre change le document. L'organisation doit garder celui qu'elle a
    // adopté, et obtenir le nouveau à côté.
    const { saveComposition, migrateComposition, listCompositions } = await import(
      "./compositions"
    );
    const ancienne = await saveComposition("Notre Constitution", charge(), "fr");
    // On la ramène à une release antérieure, comme le serait une version de l'an
    // dernier ouverte aujourd'hui. Écrit dans le magasin plutôt que par une
    // trappe exportée : le code de production n'a pas à porter de porte de test.
    localStorage.setItem(
      "cc_versions",
      JSON.stringify([
        {
          ...ancienne,
          payload: {
            ...ancienne.payload,
            content: { locale: "fr", release: "2000-01-01", sha256: "a".repeat(64) },
          },
        },
      ]),
    );
    const source = (await listCompositions())[0];

    const creee = await migrateComposition(source, "Notre Constitution (2026)", "fr");

    const apres = await listCompositions();
    expect(apres).toHaveLength(2);
    expect(creee.payload.content?.release).toBe(CURRENT_RELEASE);
    // L'originale, elle, porte toujours son texte d'origine.
    const intacte = apres.find((r) => r.id === source.id)!;
    expect(intacte.payload.content?.release).toBe("2000-01-01");
    expect(intacte.payload.title).toBe(source.payload.title);
  });

  it("rejouer refuse au plafond, sans toucher à l'originale", async () => {
    const { saveComposition, migrateComposition, listCompositions, MAX_COMPOSITIONS } =
      await import("./compositions");
    for (let i = 0; i < MAX_COMPOSITIONS; i++)
      await saveComposition(`v${i}`, charge(), "fr");
    const source = (await listCompositions())[0];
    await expect(
      migrateComposition(source, "une de trop", "fr"),
    ).rejects.toThrow("LIMIT");
    const apres = await listCompositions();
    expect(apres).toHaveLength(MAX_COMPOSITIONS);
    expect(apres.find((r) => r.id === source.id)).toEqual(source);
  });

  it("figer une version se fait en place : ni doublon, ni plafond atteint", async () => {
    // Le geste « L'enregistrer avec la Constitution d'aujourd'hui » doit marcher
    // même quand les cinq places sont prises — c'est le cas d'une organisation
    // qui a rempli ses versions avant l'archivage des textes.
    const { saveComposition, repinComposition, listCompositions, MAX_COMPOSITIONS } =
      await import("./compositions");
    for (let i = 0; i < MAX_COMPOSITIONS; i++)
      await saveComposition(`v${i}`, charge(), "fr");
    const rows = await listCompositions();
    const cible = rows[0];
    // On simule une version d'avant l'archivage : aucune référence de contenu.
    const { schemaVersion: _s, content: _c, ...sansReference } = cible.payload;
    void _s;
    void _c;

    await repinComposition(cible.id, sansReference, "fr");

    const apres = await listCompositions();
    expect(apres).toHaveLength(MAX_COMPOSITIONS);
    expect(apres.filter((r) => r.id === cible.id)).toHaveLength(1);
    const fige = apres.find((r) => r.id === cible.id)!;
    expect(fige.payload.schemaVersion).toBe(2);
    expect(fige.payload.content?.release).toBe(CURRENT_RELEASE);
    expect(fige.name).toBe(cible.name);
    expect(fige.payload.title).toBe(cible.payload.title);
  });
});
