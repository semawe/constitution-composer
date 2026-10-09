// @vitest-environment jsdom
//
// La page où mène le lien reçu par courriel : rien à l'ouverture, la connexion
// sur un clic seulement, et un refus qui se dit avec la possibilité de
// redemander un lien.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import type { Service } from "@/lib/service";

const faux = vi.hoisted(() => ({ service: null as Service | null }));
vi.mock("@/lib/service", () => ({
  getService: () => faux.service,
  serviceConfigure: true,
}));

import ConfirmerConnexion, { lireAdresse } from "./ConfirmerConnexion";
import { TEXTES_CONFIRMATION } from "./confirmer-textes";

const JETON = "A".repeat(43);

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

function ouvrir(adresse: string, service: Partial<Service> = {}) {
  faux.service = service as Service;
  window.history.replaceState(null, "", adresse);
  return render(<ConfirmerConnexion locale="fr" />);
}

describe("lire l'adresse de la page", () => {
  it("un jeton bien formé, un motif de refus, ou rien d'utilisable", () => {
    expect(lireAdresse(`?jeton=${JETON}`)).toEqual({ jeton: JETON, motif: null });
    expect(lireAdresse("?erreur=NAVIGATEUR")).toEqual({ jeton: null, motif: "NAVIGATEUR" });
    expect(lireAdresse("?erreur=LIEN_INVALIDE")).toEqual({ jeton: null, motif: "LIEN_INVALIDE" });
    expect(lireAdresse("?erreur=ORIGINE")).toEqual({ jeton: null, motif: "AUTRE" });
    expect(lireAdresse("?jeton=court")).toEqual({ jeton: null, motif: "INCOMPLET" });
    expect(lireAdresse("")).toEqual({ jeton: null, motif: "INCOMPLET" });
  });
});

describe("la page de confirmation", () => {
  it("n'envoie rien à l'ouverture : un formulaire attend le clic, et le jeton quitte l'adresse", async () => {
    const appels = vi.fn();
    ouvrir(`/connexion/confirmer?jeton=${JETON}`, { demanderLien: appels });
    const bouton = await screen.findByRole("button", { name: TEXTES_CONFIRMATION.fr.bouton });
    const formulaire = bouton.closest("form")!;
    expect(formulaire.getAttribute("method")).toBe("post");
    expect(formulaire.getAttribute("action")).toBe("/api/connexion/lien/consommer");
    const champs = Object.fromEntries(new FormData(formulaire).entries());
    expect(champs).toEqual({ jeton: JETON, langue: "fr" });
    expect(window.location.search).toBe("");
    expect(appels).not.toHaveBeenCalled();
  });

  it("ouvert dans un autre navigateur : le refus se dit, et un nouveau lien se demande ici, pour le Composer", async () => {
    const demanderLien = vi.fn<Service["demanderLien"]>(async () => ({ ok: true }));
    ouvrir("/connexion/confirmer?erreur=NAVIGATEUR", { demanderLien });
    expect(await screen.findByRole("alert")).toHaveTextContent("autre navigateur");
    fireEvent.change(screen.getByLabelText(TEXTES_CONFIRMATION.fr.adresse), {
      target: { value: "ada@exemple.test" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: TEXTES_CONFIRMATION.fr.envoyer }));
    });
    expect(demanderLien).toHaveBeenCalledWith("ada@exemple.test", `${window.location.origin}/composer`, false);
    expect(await screen.findByRole("status")).toHaveTextContent("Lien envoyé");
  });

  it("un lien expiré ou déjà servi se dit aussi", async () => {
    ouvrir("/connexion/confirmer?erreur=LIEN_INVALIDE");
    expect(await screen.findByRole("alert")).toHaveTextContent("expiré");
  });

  it("sans service (démonstration), la page le dit au lieu de proposer un formulaire inerte", async () => {
    faux.service = null;
    window.history.replaceState(null, "", `/connexion/confirmer?jeton=${JETON}`);
    render(<ConfirmerConnexion locale="fr" />);
    expect(screen.getByText(TEXTES_CONFIRMATION.fr.indisponible)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("les deux langues disent les mêmes choses", () => {
    const fr = TEXTES_CONFIRMATION.fr;
    const en = TEXTES_CONFIRMATION.en;
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    expect(Object.keys(en.motifs).sort()).toEqual(Object.keys(fr.motifs).sort());
    expect(en.composer).toBe("/en/composer");
  });
});
