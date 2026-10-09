// @vitest-environment jsdom
//
// Le contrat clavier des boîtes de dialogue, éprouvé en tapant vraiment dedans.
//
// Les tests existants ouvraient la boîte, vérifiaient où était le focus, puis la
// fermaient : aucun ne saisissait un caractère. C'est ainsi qu'est passé le
// défaut relevé par l'audit du 04/10/2026 (F03) — le focus repartait sur le
// bouton de fermeture à chaque lettre, et l'adresse de connexion ne se tapait
// pas. Un champ contrôlé rerend son parent à chaque frappe : c'est ce rerendu
// qu'il faut traverser.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const nue = (balise: string) =>
    function Nue({ children, ...props }: Record<string, unknown>) {
      const rest = { ...props };
      for (const p of ["initial", "animate", "exit", "transition"]) delete rest[p];
      return React.createElement(balise, rest, children as React.ReactNode);
    };
  return {
    motion: new Proxy({}, { get: (_cible, balise: string) => nue(balise) }),
  };
});

import Modale from "./Modale";
import { ComposerTiroir } from "./composer/ComposerTiroir";

afterEach(() => cleanup());

/** Une boîte comme celles de l'application : `onClose` neuf à chaque rendu. */
function Exemple({ onFerme }: { onFerme: () => void }) {
  const [ouverte, setOuverte] = useState(false);
  const [adresse, setAdresse] = useState("");
  const [note, setNote] = useState("");
  return (
    <>
      <button onClick={() => setOuverte(true)}>ouvrir</button>
      {ouverte && (
        <Modale
          label="essai"
          onClose={() => {
            setOuverte(false);
            onFerme();
          }}
        >
          <button onClick={() => setOuverte(false)}>fermer</button>
          <input
            aria-label="adresse"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
          />
          <textarea
            aria-label="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Modale>
      )}
    </>
  );
}

describe("saisir dans une boîte de dialogue", () => {
  it("le focus reste dans le champ, caractère après caractère", async () => {
    const utilisateur = userEvent.setup();
    render(<Exemple onFerme={() => {}} />);
    await utilisateur.click(screen.getByRole("button", { name: "ouvrir" }));
    const champ = screen.getByLabelText("adresse") as HTMLInputElement;

    await utilisateur.click(champ);
    await utilisateur.keyboard("prenom.nom@exemple.fr");

    // Avant la correction, seule la première lettre arrivait : le focus était
    // reparti sur « fermer » et le reste se perdait.
    expect(champ.value).toBe("prenom.nom@exemple.fr");
    expect(champ).toHaveFocus();
  });

  it("plusieurs phrases dans une zone de texte, sans reprendre le focus à la main", async () => {
    const utilisateur = userEvent.setup();
    render(<Exemple onFerme={() => {}} />);
    await utilisateur.click(screen.getByRole("button", { name: "ouvrir" }));
    const zone = screen.getByLabelText("note") as HTMLTextAreaElement;

    await utilisateur.click(zone);
    await utilisateur.keyboard("Une phrase. Puis une autre.");

    expect(zone.value).toBe("Une phrase. Puis une autre.");
    expect(zone).toHaveFocus();
  });

  // La boucle de tabulation n'est pas éprouvée ici : le piège écarte les
  // contrôles invisibles par `offsetParent`, que jsdom, sans mise en page, rend
  // toujours nul. Elle se vérifie dans un navigateur.

  it("Échap ferme avec la fermeture du rendu courant, et rend le focus", async () => {
    const utilisateur = userEvent.setup();
    const ferme = vi.fn();
    render(<Exemple onFerme={ferme} />);
    const ouvrir = screen.getByRole("button", { name: "ouvrir" });
    await utilisateur.click(ouvrir);
    // Une frappe d'abord : la fermeture appelée doit être celle d'après le
    // rerendu, pas celle capturée à l'ouverture.
    await utilisateur.click(screen.getByLabelText("adresse"));
    await utilisateur.keyboard("a{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ferme).toHaveBeenCalledTimes(1);
    expect(ouvrir).toHaveFocus();
  });
});

describe("le tiroir mobile du Composer", () => {
  function Tiroir() {
    const [ouvert, setOuvert] = useState(false);
    return (
      <>
        <button onClick={() => setOuvert(true)}>Sommaire & modules</button>
        <ComposerTiroir
          ouvert={ouvert}
          onClose={() => setOuvert(false)}
          fermer="Fermer"
          nom="Sommaire & modules"
        >
          <button>un module</button>
        </ComposerTiroir>
      </>
    );
  }

  it("est une boîte de dialogue nommée, qui prend le focus et fige le fond", async () => {
    const utilisateur = userEvent.setup();
    render(<Tiroir />);
    await utilisateur.click(
      screen.getByRole("button", { name: "Sommaire & modules" }),
    );

    const boite = screen.getByRole("dialog", { name: "Sommaire & modules" });
    expect(boite).toHaveAttribute("aria-modal", "true");
    expect(boite.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("Échap le ferme, rend le défilement et le focus à son bouton", async () => {
    const utilisateur = userEvent.setup();
    render(<Tiroir />);
    const ouvrir = screen.getByRole("button", { name: "Sommaire & modules" });
    await utilisateur.click(ouvrir);

    await utilisateur.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.body.style.overflow).toBe("");
    expect(ouvrir).toHaveFocus();
  });
});
