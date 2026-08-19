// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Glossaire from "./Glossaire";
import glossaireFr from "@/data/glossaire.fr.json";
import { GLOSSAIRE_UI } from "@/lib/i18n";

afterEach(() => cleanup());

describe("le glossaire navigable", () => {
  it("filtre les termes sur leur nom ou leur définition, sans dépendre des accents", async () => {
    const utilisateur = userEvent.setup();
    render(<Glossaire font="source-serif" locale="fr" />);

    await utilisateur.type(
      screen.getByRole("searchbox", { name: GLOSSAIRE_UI.fr.search }),
      "raison d'etre",
    );

    expect(screen.getByText("Raison d'Être")).toBeTruthy();
    expect(screen.queryByText("Accords Relationnels")).toBeNull();
  });

  it("annonce une recherche sans résultat", async () => {
    const utilisateur = userEvent.setup();
    render(<Glossaire font="source-serif" locale="fr" />);

    await utilisateur.type(
      screen.getByRole("searchbox", { name: GLOSSAIRE_UI.fr.search }),
      "terme qui n'existe pas",
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      GLOSSAIRE_UI.fr.noResult,
    );
  });

  it("offre le retour au passage d'origine quand il existe", async () => {
    const utilisateur = userEvent.setup();
    const onBack = vi.fn();
    render(<Glossaire font="source-serif" locale="fr" onBack={onBack} />);

    await utilisateur.click(
      screen.getByRole("button", { name: new RegExp(GLOSSAIRE_UI.fr.back) }),
    );

    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("term")).toHaveLength(glossaireFr.terms.length);
  });
});
