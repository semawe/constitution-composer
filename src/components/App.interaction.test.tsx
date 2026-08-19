// @vitest-environment jsdom
//
// Les onglets ne se montent qu'à l'ouverture. Ce que ce test protège n'est pas
// tant le poids du JavaScript (huit kilo-octets gagnés, les bibliothèques étant
// partagées) que les effets invisibles : avant, la Déclaration lisait le compte
// et l'App Store interrogeait les soumissions à chaque chargement de /composer,
// même si personne n'ouvrait ces onglets — et un bouton d'un onglet masqué
// restait cliquable, ce qui a faussé une vérification le 18/08.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const nue = (b: string) =>
    function N({ children, ...p }: Record<string, unknown>) {
      for (const k of ["initial","animate","exit","transition","layout","layoutId","whileInView","viewport","whileHover","whileTap"]) delete p[k];
      return React.createElement(b, p, children as React.ReactNode);
    };
  return {
    motion: new Proxy({}, { get: (_c, b: string) => nue(b) }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    MotionConfig: ({ children }: { children?: React.ReactNode }) => children,
    useReducedMotion: () => true,
  };
});

import App from "./App";
import constitution from "@/data/constitution.fr.json";
import principes from "@/data/principes.fr.json";
import type { ConstitutionData } from "@/lib/constitution";
import type { PrincipesData } from "@/lib/principes-data";
import { APP_UI } from "@/lib/i18n";

const t = APP_UI.fr;

function monter() {
  return render(
    <App
      constitution={constitution as unknown as ConstitutionData}
      principes={principes as unknown as PrincipesData}
      locale="fr"
    />,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("les onglets se montent à l'ouverture", () => {
  it("au premier rendu, seul l'onglet Constitution est monté", async () => {
    monter();
    // Le document est là…
    expect(
      screen.getByRole("heading", { name: /Préambule/, level: 2 }),
    ).toBeTruthy();
    // …et on laisse aux imports différés le temps d'arriver. Sans cette attente,
    // l'absence du bouton ne prouverait rien : il n'aurait pas encore eu le
    // temps de descendre, monté ou pas.
    await new Promise((r) => setTimeout(r, 120));
    // L'export de la Déclaration vit dans un autre onglet : ni bouton fantôme
    // cliquable, ni effet lancé à son montage (lecture du compte, requêtes).
    expect(screen.queryByRole("button", { name: /PDF signable/ })).toBeNull();
  });

  it("ouvrir l'onglet le monte, et le refermer ne le démonte pas", async () => {
    const utilisateur = userEvent.setup();
    monter();
    // La barre d'onglets est rendue deux fois (bureau et mobile) : le premier
    // exemplaire suffit à conduire l'application.
    await utilisateur.click(
      screen.getAllByRole("button", { name: t.tabs.principes })[0],
    );

    const bouton = await screen.findByRole("button", { name: /PDF signable/ });
    expect(bouton).toBeTruthy();

    // Retour à la Constitution : l'onglet reste monté (son brouillon en cours ne
    // doit pas se recharger à chaque aller-retour), simplement masqué.
    await utilisateur.click(
      screen.getAllByRole("button", { name: t.tabs.constitution })[0],
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /PDF signable/ })).toBeTruthy(),
    );
  });
});
