// @vitest-environment jsdom
//
// L'épreuve de l'immuabilité, à l'écran cette fois.
//
// `releases.test.ts` prouve que la résolution rend le bon fond ; ce fichier
// prouve que **l'interface affiche ce fond-là**. C'est le défaut d'origine pris
// par le bon bout : une organisation ouvre la version qu'elle a adoptée et doit
// relire son texte, pas celui du jour.
//
// L'archive est simulée (deux releases dont une ancienne, portant une phrase que
// le texte du jour n'a pas) : le dépôt n'en contient qu'une, et fabriquer une
// vraie seconde release pour un test figerait un faux état du fond.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const PHRASE_ANCIENNE =
  "Disposition retirée depuis : elle n'existe que dans le texte de janvier.";
const RELEASE_ANCIENNE = "2026-01-01";
const RELEASE_COURANTE = "2026-08-19";
const SHA_ANCIENNE = "1".repeat(64);
const SHA_COURANTE = "2".repeat(64);

// L'archive vue par `src/lib/releases.ts`. Le fond ancien est le fond réel plus
// une phrase, ce qui rend la différence observable à l'écran.
// La fabrique est hissée au-dessus du module : elle ne peut lire aucune de ses
// constantes, d'où les valeurs répétées ici. Le premier test vérifie qu'elles
// concordent avec celles du fichier, pour qu'une retouche d'un seul côté rougisse.
vi.mock("@/data/releases", async () => {
  const courant = (await import("@/data/constitution.fr.json")).default;
  const anglais = (await import("@/data/constitution.en.json")).default;
  const principes = (await import("@/data/principes.fr.json")).default;
  const ancien = structuredClone(courant) as typeof courant;
  ancien.blocks[1].text = `${ancien.blocks[1].text}\n\nDisposition retirée depuis : elle n'existe que dans le texte de janvier.`;
  return {
    ARCHIVED_RELEASES: [
      {
        id: "2026-01-01",
        sha256: {
          "constitution.fr.json": "1".repeat(64),
          "constitution.en.json": "1".repeat(64),
          "principes.fr.json": "1".repeat(64),
          "principes.en.json": "1".repeat(64),
        },
        constitution: { fr: ancien, en: ancien },
        principes: { fr: principes, en: principes },
      },
      {
        id: "2026-08-19",
        sha256: {
          "constitution.fr.json": "2".repeat(64),
          "constitution.en.json": "2".repeat(64),
          "principes.fr.json": "2".repeat(64),
          "principes.en.json": "2".repeat(64),
        },
        constitution: { fr: courant, en: anglais },
        principes: { fr: principes, en: principes },
      },
    ],
  };
});

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const nue = (balise: string) =>
    function Nue({ children, ...props }: Record<string, unknown>) {
      const rest = { ...props };
      for (const p of [
        "initial", "animate", "exit", "transition", "layout", "layoutId",
        "whileInView", "viewport", "whileHover", "whileTap", "onAnimationComplete",
      ])
        delete rest[p];
      return React.createElement(balise, rest, children as React.ReactNode);
    };
  return {
    motion: new Proxy({}, { get: (_cible, balise: string) => nue(balise) }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    MotionConfig: ({ children }: { children?: React.ReactNode }) => children,
    useReducedMotion: () => true,
  };
});

import Composer from "./Composer";
import { type ConstitutionData } from "@/lib/constitution";
import { COMPOSER } from "@/lib/i18n";
import { releaseLabel } from "@/lib/releases";
import frJson from "@/data/constitution.fr.json";

const data = frJson as unknown as ConstitutionData;
const t = COMPOSER.fr;

const branding = {
  logo: "",
  setLogo: () => {},
  font: "source-serif",
  setFont: () => {},
  titleColor: "",
  setTitleColor: () => {},
};

function semer(release: string, sha256: string) {
  localStorage.setItem("cc_account", "1");
  localStorage.setItem(
    "cc_versions",
    JSON.stringify([
      {
        id: "id-adoptee",
        name: "Notre Constitution",
        updated_at: "2026-01-15T10:00:00.000Z",
        payload: {
          schemaVersion: 2,
          content: { locale: "fr", release, sha256 },
          title: "Constitution de l'Organisation",
          values: "",
          active: ["scribe"],
        },
      },
    ]),
  );
}

async function ouvrirLaVersion() {
  const utilisateur = userEvent.setup();
  render(
    <Composer data={data} branding={branding} onTermClick={() => {}} locale="fr" />,
  );
  const etiquette = await screen.findByText("Notre Constitution");
  await utilisateur.click(etiquette.closest("button")!);
  return utilisateur;
}

const compte = (aiguille: string) =>
  screen.queryAllByText((contenu) => contenu.includes(aiguille)).length;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("relire une version telle qu'elle a été adoptée", () => {
  it("l'archive simulée est bien celle que ce fichier décrit", async () => {
    // Garde contre une retouche d'un seul côté : la fabrique hissée ne peut pas
    // partager les constantes, donc on vérifie la concordance ici.
    const { ARCHIVED_RELEASES } = await import("@/data/releases");
    expect(ARCHIVED_RELEASES.map((r) => r.id)).toEqual([
      RELEASE_ANCIENNE,
      RELEASE_COURANTE,
    ]);
    expect(ARCHIVED_RELEASES[0].sha256["constitution.fr.json"]).toBe(SHA_ANCIENNE);
    expect(ARCHIVED_RELEASES[1].sha256["constitution.fr.json"]).toBe(SHA_COURANTE);
    expect(ARCHIVED_RELEASES[0].constitution.fr.blocks[1].text).toContain(
      PHRASE_ANCIENNE,
    );
    expect(ARCHIVED_RELEASES[1].constitution.fr.blocks[1].text).not.toContain(
      PHRASE_ANCIENNE,
    );
  });

  it("affiche le texte de sa release, pas celui du jour", async () => {
    semer(RELEASE_ANCIENNE, SHA_ANCIENNE);
    await ouvrirLaVersion();

    // Le cœur du chantier : la phrase de janvier, absente du texte du jour,
    // s'affiche parce que c'est le document de cette organisation.
    await waitFor(() => expect(compte(PHRASE_ANCIENNE)).toBeGreaterThan(0));
    expect(
      screen.getByText(t.releasePinned(releaseLabel(RELEASE_ANCIENNE, "fr"))),
    ).toBeTruthy();
  });

  it("propose d'en créer une version sur le texte du jour, sans perdre l'ancienne", async () => {
    semer(RELEASE_ANCIENNE, SHA_ANCIENNE);
    const utilisateur = await ouvrirLaVersion();
    await waitFor(() => expect(compte(PHRASE_ANCIENNE)).toBeGreaterThan(0));

    await utilisateur.click(
      await screen.findByRole("button", { name: t.releaseMigrateAction }),
    );

    // À l'écran, le texte du jour : la phrase de janvier a disparu.
    await waitFor(() => expect(compte(PHRASE_ANCIENNE)).toBe(0));

    const versions = JSON.parse(localStorage.getItem("cc_versions")!);
    expect(versions).toHaveLength(2);
    const origine = versions.find(
      (v: { id: string }) => v.id === "id-adoptee",
    );
    expect(origine.payload.content.release).toBe(RELEASE_ANCIENNE);
    const creee = versions.find((v: { id: string }) => v.id !== "id-adoptee");
    expect(creee.payload.content.release).toBe(RELEASE_COURANTE);
    expect(creee.name).toContain("Notre Constitution");
  });

  it("une version sur le texte du jour s'ouvre sans rien signaler", async () => {
    semer(RELEASE_COURANTE, SHA_COURANTE);
    await ouvrirLaVersion();
    await waitFor(() =>
      expect(screen.getByText(t.loaded("Notre Constitution"))).toBeTruthy(),
    );
    expect(compte(PHRASE_ANCIENNE)).toBe(0);
    expect(
      screen.queryByRole("button", { name: t.releaseMigrateAction }),
    ).toBeNull();
  });
});
