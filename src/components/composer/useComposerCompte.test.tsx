// @vitest-environment jsdom
//
// La sortie, vue de l'application : quand le service ne répond pas, on se tient
// pour sorti quand même.
//
// C'est sur l'identité tombée à null que se purgent le document, le brouillon,
// la liste des versions et la Déclaration (audit du 04/10/2026, F06). Une
// sortie qui laisserait l'identité en place, parce que le service a échoué,
// laisserait tout cela devant la personne suivante.

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { Compte, Service } from "@/lib/service";
import { useComposerCompte } from "./useComposerCompte";

afterEach(() => cleanup());

const compteA: Compte = {
  id: "compte-a",
  email: "a@example.invalid",
  nom: "Personne A",
  prenom: "Personne",
  organisation: "Organisation A",
};

function service(sortir: Service["sortir"]): Service {
  return {
    lireSession: async () => compteA,
    ecouterSession: () => () => {},
    rattacherProfil: async () => {},
    sortir,
  } as Partial<Service> as Service;
}

function monter(s: Service) {
  return renderHook(() =>
    useComposerCompte({
      service: s,
      onAvantRedirection: () => {},
      onConnexionSimulee: () => {},
    }),
  );
}

describe("sortir quand le service ne répond pas", () => {
  it("le service lève : l'application se tient pour déconnectée", async () => {
    const sortir = vi.fn(async () => {
      throw new Error("réseau");
    });
    const { result } = monter(service(sortir));
    await waitFor(() => expect(result.current.identite).toBe("compte-a"));

    await act(async () => {
      await result.current.signOut();
    });

    expect(sortir).toHaveBeenCalledTimes(1);
    expect(result.current.identite).toBeNull();
    expect(result.current.account).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("le service répond : même issue", async () => {
    const { result } = monter(service(async () => {}));
    await waitFor(() => expect(result.current.identite).toBe("compte-a"));
    await act(async () => {
      await result.current.signOut();
    });
    expect(result.current.identite).toBeNull();
  });
});
