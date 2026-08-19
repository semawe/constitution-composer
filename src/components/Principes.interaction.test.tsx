// @vitest-environment jsdom
//
// L'accessibilité de la Déclaration, conduite. Deux constats de la revue adverse
// se vérifient ici plutôt que sur parole : l'ordre des principes doit s'atteindre
// au clavier (le glisser-déposer HTML n'offre aucune voie), et la boîte de
// dialogue doit se comporter comme une boîte de dialogue.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const nue = (balise: string) =>
    function Nue({ children, ...props }: Record<string, unknown>) {
      const rest = { ...props };
      for (const p of [
        "initial", "animate", "exit", "transition", "layout", "layoutId",
        "whileInView", "viewport", "whileHover", "whileTap",
      ])
        delete rest[p];
      return React.createElement(balise, rest, children as React.ReactNode);
    };
  return {
    motion: new Proxy({}, { get: (_c, balise: string) => nue(balise) }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    MotionConfig: ({ children }: { children?: React.ReactNode }) => children,
    useReducedMotion: () => true,
  };
});

import Principes from "./Principes";
import { PRINCIPES_UI, COMPOSER } from "@/lib/i18n";
import principesFr from "@/data/principes.fr.json";
import type { PrincipesData } from "@/lib/principes-data";

const data = principesFr as unknown as PrincipesData;
const t = PRINCIPES_UI.fr;
const c = COMPOSER.fr;

function monter() {
  return render(
    <Principes
      data={data}
      logo=""
      font="source-serif"
      titleColor=""
      onTermClick={() => {}}
      locale="fr"
    />,
  );
}

/** Les titres des principes, dans l'ordre où l'écran les présente. */
function ordreAffiche(): string[] {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((h) => (h.textContent ?? "").replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("réordonner les principes au clavier", () => {
  it("chaque principe porte ses deux commandes, nommées", () => {
    monter();
    const premier = data.principles[0].title;
    const second = data.principles[1].title;
    // Le premier ne peut pas remonter, le second si : les commandes existent et
    // leur état dit ce qui est possible.
    expect(
      screen.getByRole("button", { name: t.moveUp(premier) }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: t.moveUp(second) })).toBeEnabled();
  });

  it("descendre un principe change l'ordre affiché et la numérotation", async () => {
    const utilisateur = userEvent.setup();
    monter();
    const [avantPremier, avantSecond] = ordreAffiche();

    await utilisateur.click(
      screen.getByRole("button", { name: t.moveDown(avantPremier) }),
    );

    await waitFor(() => {
      const [apresPremier, apresSecond] = ordreAffiche();
      expect(apresPremier).toBe(avantSecond);
      expect(apresSecond).toBe(avantPremier);
    });
    // La numérotation suit le rang, elle ne suit pas le principe.
    expect(
      screen.getAllByRole("heading", { level: 2 })[0].textContent,
    ).toMatch(/^1\./);
  });

  it("le déplacement se fait entièrement au clavier, sans souris", async () => {
    const utilisateur = userEvent.setup();
    monter();
    const [premier, second] = ordreAffiche();
    const bouton = screen.getByRole("button", { name: t.moveDown(premier) });

    bouton.focus();
    expect(bouton).toHaveFocus();
    await utilisateur.keyboard("{Enter}");

    await waitFor(() => expect(ordreAffiche()[0]).toBe(second));
  });
});

describe("la boîte de dialogue du compte", () => {
  async function ouvrirLeMur() {
    const utilisateur = userEvent.setup();
    monter();
    await utilisateur.click(
      screen.getByRole("button", { name: new RegExp(t.downloadPdf) }),
    );
    return utilisateur;
  }

  it("s'annonce comme une boîte de dialogue, nommée par son titre", async () => {
    await ouvrirLeMur();
    const boite = await screen.findByRole("dialog");
    expect(boite).toHaveAttribute("aria-modal", "true");
    expect(within(boite).getByRole("heading", { name: t.gateTitle })).toBeTruthy();
  });

  it("prend le focus à l'ouverture et le rend à la fermeture", async () => {
    const utilisateur = await ouvrirLeMur();
    const declencheur = screen.getByRole("button", {
      name: new RegExp(t.downloadPdf),
    });
    const boite = await screen.findByRole("dialog");
    // Le focus est entré dans la boîte : sans cela, la tabulation reprend
    // derrière le fond, sur la page qu'on ne voit plus.
    expect(boite.contains(document.activeElement)).toBe(true);

    await utilisateur.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(declencheur).toHaveFocus();
  });

  it("se ferme aussi par son bouton de fermeture", async () => {
    const utilisateur = await ouvrirLeMur();
    const boite = await screen.findByRole("dialog");
    await utilisateur.click(within(boite).getByRole("button", { name: c.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
