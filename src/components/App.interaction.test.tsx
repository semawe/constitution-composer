// @vitest-environment jsdom
//
// Les onglets ne se montent qu'à l'ouverture. Ce que ce test protège n'est pas
// tant le poids du JavaScript (huit kilo-octets gagnés, les bibliothèques étant
// partagées) que les effets invisibles : avant, la Déclaration lisait le compte
// et l'App Store interrogeait les soumissions à chaque chargement de /composer,
// même si personne n'ouvrait ces onglets — et un bouton d'un onglet masqué
// restait cliquable, ce qui a faussé une vérification le 18/08.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
import { APP_UI, COMPOSER, MARKETPLACE } from "@/lib/i18n";

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

describe("l'onglet vit dans l'URL", () => {
  // L'onglet n'était qu'en mémoire : actualiser la Déclaration, suivre un lien
  // direct ou revenir en arrière ramenait à la Constitution (audit du
  // 04/10/2026, F14).
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("un lien direct ouvre l'onglet qu'il désigne", async () => {
    window.history.replaceState(null, "", "/composer?vue=principes");
    monter();
    expect(
      await screen.findByRole("button", { name: /PDF signable/ }),
    ).toBeTruthy();
  });

  it("changer d'onglet change l'URL, et Précédent ramène à l'onglet d'avant", async () => {
    const utilisateur = userEvent.setup();
    window.history.replaceState(null, "", "/composer");
    monter();

    await utilisateur.click(
      screen.getAllByRole("button", { name: t.tabs.principes })[0],
    );
    expect(window.location.search).toBe("?vue=principes");
    await screen.findByRole("button", { name: /PDF signable/ });

    await utilisateur.click(
      screen.getAllByRole("button", { name: t.tabs.glossaire })[0],
    );
    expect(window.location.search).toBe("?vue=glossaire");

    // Précédent : l'URL revient à la Déclaration, et l'écran avec elle.
    window.history.back();
    await waitFor(() => expect(window.location.search).toBe("?vue=principes"));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /PDF signable/ })
          .closest(".hidden"),
      ).toBeNull(),
    );
  });

  it("la Constitution est l'onglet sans paramètre", async () => {
    const utilisateur = userEvent.setup();
    window.history.replaceState(null, "", "/composer?vue=glossaire");
    monter();
    await utilisateur.click(
      screen.getAllByRole("button", { name: t.tabs.constitution })[0],
    );
    expect(window.location.search).toBe("");
  });

  it("une valeur inconnue dans l'URL laisse la Constitution", async () => {
    window.history.replaceState(null, "", "/composer?vue=nimportequoi");
    monter();
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.queryByRole("button", { name: /PDF signable/ })).toBeNull();
  });
});

describe("« Activer » dans l'App Store active le module", () => {
  // Le bouton changeait d'onglet et faisait défiler : ni insertion, ni demande
  // de connexion, ni un mot sur l'état du module (audit du 04/10/2026, F13).
  const donnees = constitution as unknown as ConstitutionData;
  const extension = donnees.modules.find((m) => m.tier === "extension")!;
  const c = COMPOSER.fr;

  afterEach(() => window.history.replaceState(null, "", "/"));

  /** Clique « Activer » sur la carte du module, dans le catalogue. */
  async function activerDepuisLeCatalogue(
    utilisateur: ReturnType<typeof userEvent.setup>,
  ) {
    await utilisateur.click(
      screen.getAllByRole("button", { name: t.tabs.appstore })[0],
    );
    const titreCarte = await screen.findByRole("heading", {
      name: extension.label,
      level: 2,
    });
    const carte = titreCarte.closest("div.flex-col") as HTMLElement;
    await utilisateur.click(
      within(carte).getByRole("button", { name: MARKETPLACE.fr.activate }),
    );
  }

  it("avec un compte : le module entre dans le document, et on le dit", async () => {
    localStorage.setItem("cc_account", "1");
    const utilisateur = userEvent.setup();
    monter();

    await activerDepuisLeCatalogue(utilisateur);

    await waitFor(() =>
      expect(document.getElementById(`ins-${extension.id}-0`)).not.toBeNull(),
    );
    expect(screen.getByRole("status").textContent).toBe(
      c.moduleActivated(extension.label),
    );
    // On est revenu sur la Constitution, là où le module vient d'entrer.
    expect(window.location.search).toBe("");
  });

  it("sans compte : la connexion est demandée, puis le module s'active", async () => {
    const utilisateur = userEvent.setup();
    monter();

    await activerDepuisLeCatalogue(utilisateur);

    // Le mur s'ouvre, et rien n'est encore entré dans le document.
    const boite = await screen.findByRole("dialog");
    expect(document.getElementById(`ins-${extension.id}-0`)).toBeNull();

    await utilisateur.click(
      within(boite).getByRole("button", { name: c.continueGoogle }),
    );

    // Une fois le compte établi, le geste demandé est repris : ce module-là.
    await waitFor(() =>
      expect(document.getElementById(`ins-${extension.id}-0`)).not.toBeNull(),
    );
  });

  it("déjà actif : on le dit, sans le retirer", async () => {
    localStorage.setItem("cc_account", "1");
    const utilisateur = userEvent.setup();
    monter();
    await activerDepuisLeCatalogue(utilisateur);
    await waitFor(() =>
      expect(document.getElementById(`ins-${extension.id}-0`)).not.toBeNull(),
    );

    await activerDepuisLeCatalogue(utilisateur);

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        c.moduleAlreadyActive(extension.label),
      ),
    );
    expect(document.getElementById(`ins-${extension.id}-0`)).not.toBeNull();
  });

  it("le lien d'une fiche (`?activer=`) active le module et nettoie l'URL", async () => {
    localStorage.setItem("cc_account", "1");
    window.history.replaceState(
      null,
      "",
      `/composer?activer=${extension.id}`,
    );
    monter();

    await waitFor(() =>
      expect(document.getElementById(`ins-${extension.id}-0`)).not.toBeNull(),
    );
    // Consommé : un rechargement ne le réactivera pas.
    expect(window.location.search).toBe("");
  });
});
