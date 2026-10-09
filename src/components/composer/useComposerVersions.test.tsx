// @vitest-environment jsdom
//
// La liste des versions, quand le compte ne répond pas ou change.
//
// Deux défauts de l'audit du 04/10/2026. F11 : la première lecture avalait son
// erreur, et une panne s'affichait comme un compte vide. F06 : la liste se
// réglait sur « connecté ou pas », si bien qu'un compte qui en remplaçait un
// autre sans passer par la déconnexion héritait de sa liste — et d'une réponse
// partie pour le premier.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

const lectures = vi.hoisted(() => ({
  suivante: [] as Array<() => Promise<unknown[]>>,
}));
vi.mock("@/lib/compositions", async (original) => {
  const reel = await original<typeof import("@/lib/compositions")>();
  return {
    ...reel,
    listCompositions: () => {
      const prochaine = lectures.suivante.shift();
      return prochaine ? prochaine() : Promise.resolve([]);
    },
  };
});

import { useComposerVersions } from "./useComposerVersions";
import { type ConstitutionData } from "@/lib/constitution";
import { COMPOSER } from "@/lib/i18n";
import { currentContentRef } from "@/lib/releases";
import frJson from "@/data/constitution.fr.json";

const data = frJson as unknown as ConstitutionData;

const ligne = (nom: string) => ({
  id: `id-${nom}`,
  name: nom,
  updated_at: "2026-10-04T09:00:00.000Z",
  payload: { title: nom, values: "", active: [] },
});

function monter(identite: string | null) {
  return renderHook(
    ({ identite }: { identite: string | null }) =>
      useComposerVersions({
        t: COMPOSER.fr,
        locale: "fr",
        account: identite !== null,
        identite,
        fondCourant: data,
        onGate: () => {},
        onApply: () => {},
        composition: () => ({ title: "", values: "", active: [] }),
        reference: () => currentContentRef("fr"),
      }),
    { initialProps: { identite } },
  );
}

beforeEach(() => {
  lectures.suivante = [];
});
afterEach(() => cleanup());

describe("la première lecture des versions", () => {
  it("une lecture ratée se dit : ce n'est pas un compte vide", async () => {
    lectures.suivante.push(() => Promise.reject(new Error("réseau")));
    const { result } = monter("compte-a");
    await waitFor(() => expect(result.current.versionsUnread).toBe(true));
    expect(result.current.versions).toEqual([]);
  });

  it("réessayer relit la liste et lève l'alerte", async () => {
    lectures.suivante.push(() => Promise.reject(new Error("réseau")));
    const { result } = monter("compte-a");
    await waitFor(() => expect(result.current.versionsUnread).toBe(true));

    lectures.suivante.push(() => Promise.resolve([ligne("Retrouvée")]));
    await act(async () => {
      await result.current.refreshVersions();
    });

    expect(result.current.versionsUnread).toBe(false);
    expect(result.current.versions.map((v) => v.name)).toEqual(["Retrouvée"]);
  });
});

describe("d'un compte à l'autre", () => {
  it("la liste du premier ne reste pas devant le second", async () => {
    lectures.suivante.push(() => Promise.resolve([ligne("De A")]));
    const { result, rerender } = monter("compte-a");
    await waitFor(() => expect(result.current.versions).toHaveLength(1));

    lectures.suivante.push(() => Promise.resolve([ligne("De B")]));
    rerender({ identite: "compte-b" });

    await waitFor(() =>
      expect(result.current.versions.map((v) => v.name)).toEqual(["De B"]),
    );
  });

  it("une réponse partie pour le premier n'arrive pas chez le second", async () => {
    let lacher!: (rows: unknown[]) => void;
    lectures.suivante.push(
      () => new Promise<unknown[]>((r) => (lacher = r)),
    );
    const { result, rerender } = monter("compte-a");

    // B arrive pendant que la lecture de A est encore en vol, et n'a rien.
    lectures.suivante.push(() => Promise.resolve([]));
    rerender({ identite: "compte-b" });
    await act(async () => {
      lacher([ligne("De A, en retard")]);
      await Promise.resolve();
    });

    expect(result.current.versions).toEqual([]);
  });

  it("à la déconnexion, la liste et ses messages s'effacent", async () => {
    lectures.suivante.push(() => Promise.resolve([ligne("De A")]));
    const { result, rerender } = monter("compte-a");
    await waitFor(() => expect(result.current.versions).toHaveLength(1));
    act(() => result.current.setVersionMsg("« De A » chargée."));

    rerender({ identite: null });

    await waitFor(() => expect(result.current.versions).toEqual([]));
    expect(result.current.versionMsg).toBeNull();
  });
});
