// @vitest-environment jsdom
//
// La connexion ne s'annonce réussie que si le service a répondu qu'elle l'est.
//
// L'audit du 04/10/2026 (F09) a injecté un refus de quota dans l'envoi du lien
// et observé « lien envoyé » : la réponse n'était pas lue. La personne attendait
// un message qui n'était jamais parti.

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { Service } from "@/lib/service";
import { useConnexion } from "./useConnexion";

afterEach(() => cleanup());

/** Un double du port de service, réduit aux deux gestes de connexion. */
function service(gestes: Partial<Service>) {
  return gestes as Service;
}

function monter(service: Service | null) {
  const avant = vi.fn();
  const simulee = vi.fn();
  const rendu = renderHook(() =>
    useConnexion({ service, onAvantRedirection: avant, onSimulee: simulee }),
  );
  return { ...rendu, avant, simulee };
}

describe("le lien de connexion par e-mail", () => {
  it("un refus du service se dit, et n'annonce pas d'envoi", async () => {
    const { result } = monter(
      service({
        // Refus de quota d'envoi.
        demanderLien: async () => ({ ok: false }),
      }),
    );
    act(() => result.current.setEmail("personne@example.invalid"));
    await act(async () => {
      await result.current.signInOtp();
    });
    expect(result.current.envoi).toBe("echec");
  });

  it("un service injoignable se dit aussi", async () => {
    const { result } = monter(
      service({
        demanderLien: async () => {
          throw new Error("réseau");
        },
      }),
    );
    act(() => result.current.setEmail("personne@example.invalid"));
    await act(async () => {
      await result.current.signInOtp();
    });
    expect(result.current.envoi).toBe("echec");
  });

  it("le succès ne s'annonce que sur une réponse réussie", async () => {
    const envoyer = vi.fn<Service["demanderLien"]>(async () => ({ ok: true }));
    const { result, avant } = monter(service({ demanderLien: envoyer }));
    act(() => result.current.setEmail("  personne@example.invalid "));
    await act(async () => {
      await result.current.signInOtp();
    });
    expect(result.current.envoi).toBe("envoye");
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(envoyer.mock.calls[0][0]).toBe("personne@example.invalid");
    // Le brouillon et le geste en cours ont été mis à l'abri avant l'envoi.
    expect(avant).toHaveBeenCalledTimes(1);
  });

  it("après un refus, on peut réessayer ; pendant un envoi, on ne double pas", async () => {
    let lacher!: () => void;
    const attente = new Promise<void>((r) => (lacher = r));
    let appels = 0;
    const { result } = monter(
      service({
        demanderLien: async () => {
          appels += 1;
          if (appels === 1) return { ok: false };
          await attente;
          return { ok: true };
        },
      }),
    );
    act(() => result.current.setEmail("personne@example.invalid"));
    await act(async () => {
      await result.current.signInOtp();
    });
    expect(result.current.envoi).toBe("echec");

    // Nouvelle tentative, laissée en vol : une seconde demande ne part pas.
    let enVol!: Promise<void>;
    act(() => {
      enVol = result.current.signInOtp();
    });
    expect(result.current.envoi).toBe("encours");
    await act(async () => {
      await result.current.signInOtp();
    });
    expect(appels).toBe(2);

    await act(async () => {
      lacher();
      await enVol;
    });
    expect(result.current.envoi).toBe("envoye");
  });

  it("corriger l'adresse efface le refus précédent", async () => {
    const { result } = monter(
      service({
        demanderLien: async () => ({ ok: false }),
      }),
    );
    act(() => result.current.setEmail("faute@example.invalid"));
    await act(async () => {
      await result.current.signInOtp();
    });
    expect(result.current.envoi).toBe("echec");
    act(() => result.current.setEmail("juste@example.invalid"));
    expect(result.current.envoi).toBe("repos");
  });
});

describe("la connexion Google", () => {
  it("un refus au démarrage se dit", async () => {
    const { result } = monter(
      service({
        // Fournisseur non activé.
        partirChezGoogle: async () => ({ ok: false }),
      }),
    );
    await act(async () => {
      await result.current.signInGoogle();
    });
    expect(result.current.googleEchec).toBe(true);
  });

  it("l'adresse de retour est la page nue, sans rien du document", async () => {
    const demarrer = vi.fn<Service["partirChezGoogle"]>(async () => ({
      ok: true,
    }));
    window.history.replaceState(null, "", "/composer?vue=principes#ancre");
    const { result } = monter(service({ partirChezGoogle: demarrer }));
    await act(async () => {
      await result.current.signInGoogle();
    });
    expect(demarrer.mock.calls[0][0]).toBe(`${window.location.origin}/composer`);
    window.history.replaceState(null, "", "/");
  });

  it("retour de Google en échec : l'échec se dit une fois, la connexion se rouvre, l'ancre part", () => {
    window.history.replaceState(null, "", "/composer?vue=principes#connexion-echouee");
    const rouvrir = vi.fn();
    const { result } = renderHook(() =>
      useConnexion({
        service: service({}),
        onAvantRedirection: () => {},
        onSimulee: () => {},
        onRetourEnEchec: rouvrir,
      }),
    );
    expect(result.current.googleEchec).toBe(true);
    expect(rouvrir).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?vue=principes");
    window.history.replaceState(null, "", "/");
  });

  it("l'adresse de retour peut être imposée (page de confirmation d'un lien)", async () => {
    const envoyer = vi.fn<Service["demanderLien"]>(async () => ({ ok: true }));
    const { result } = renderHook(() =>
      useConnexion({
        service: service({ demanderLien: envoyer }),
        onAvantRedirection: () => {},
        onSimulee: () => {},
        retour: () => "https://composer.test/composer",
      }),
    );
    act(() => result.current.setEmail("personne@example.invalid"));
    await act(async () => {
      await result.current.signInOtp();
    });
    expect(envoyer.mock.calls[0][1]).toBe("https://composer.test/composer");
  });

  it("sans service, c'est le compte simulé qui prend le relais", async () => {
    const { result, simulee, avant } = monter(null);
    await act(async () => {
      await result.current.signInGoogle();
    });
    expect(simulee).toHaveBeenCalledTimes(1);
    expect(avant).not.toHaveBeenCalled();
  });
});
